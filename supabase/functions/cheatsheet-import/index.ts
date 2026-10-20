// cheatsheet-import — приём «Конспекта курса» БЕЗ Studio. Пишет ТОЛЬКО в public.cheatsheet.
//
// Авторизация: заголовок x-import-key, constant-time сравнение с env CHEATSHEET_IMPORT_KEY
// (НЕ JWT; verify_jwt=false для этой функции). Нет/не совпал → 401 без деталей.
// Вход (POST JSON): { course_id, sections, mode?: 'merge'|'replace' (деф. merge), status?: 'draft'|'reviewed' (деф. draft) }.
// Проверки: курс существует; в sections только ключи algorithms/faq/apply/glossary; массивы блоков
//   {title, body, lesson}; размер <= 300 КБ; в строках нет <script>/<iframe>.
// merge: верхнеуровневое слияние с существующими разделами (пришедшие ключи побеждают); replace:
//   sections = пришедшие как есть. version+1. Возвращает счётчики по разделам и итоговый status.
// Логирует каждый вызов (course_id, mode, status, counts) — БЕЗ текста контента.
//
// Деплой — как stream-pay-link (копия папки в volumes/functions/ + рестарт edge-runtime), НЕ `supabase functions deploy`.

import { SUPABASE_URL as SB_URL_CONST } from '../_shared/og.mjs';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? SB_URL_CONST; // env рантайма приоритетнее, иначе константа из _shared
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const IMPORT_KEY = Deno.env.get('CHEATSHEET_IMPORT_KEY') ?? '';
const KEYS = ['algorithms', 'faq', 'apply', 'glossary'];
const MAX_BYTES = 300 * 1024;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

// Constant-time сравнение через SHA-256-дайджесты (всегда 32 байта, не зависит от длины ключа).
async function keyOk(provided: string | null): Promise<boolean> {
  if (!IMPORT_KEY || !provided) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(provided)),
    crypto.subtle.digest('SHA-256', enc.encode(IMPORT_KEY)),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < 32; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function rest(method: string, path: string, body?: unknown, extra?: Record<string, string>) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'content-type': 'application/json',
      Prefer: 'return=representation',
      ...(extra || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function validateSections(sections: any): string[] {
  const p: string[] = [];
  if (!sections || typeof sections !== 'object' || Array.isArray(sections)) return ['sections не объект'];
  for (const k of Object.keys(sections)) if (!KEYS.includes(k)) p.push(`неизвестный ключ: ${k}`);
  for (const k of KEYS) {
    if (sections[k] === undefined) continue;
    if (!Array.isArray(sections[k])) { p.push(`${k}: не массив`); continue; }
    sections[k].forEach((b: any, i: number) => {
      if (!b || typeof b !== 'object') { p.push(`${k}[${i}]: не объект`); return; }
      if (!b.title || typeof b.title !== 'string') p.push(`${k}[${i}]: title`);
      if (typeof b.body !== 'string') p.push(`${k}[${i}]: body`);
      if (!('lesson' in b)) p.push(`${k}[${i}]: lesson`);
      if (/<\s*(script|iframe)/i.test(`${b.title || ''}\n${b.body || ''}`)) p.push(`${k}[${i}]: <script>/<iframe>`);
    });
  }
  return p;
}

const counts = (s: any) => Object.fromEntries(KEYS.map((k) => [k, Array.isArray(s?.[k]) ? s[k].length : 0]));

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!(await keyOk(req.headers.get('x-import-key')))) return json({ error: 'unauthorized' }, 401);
  if (!SERVICE_KEY) return json({ error: 'server_misconfigured' }, 500);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }

  const courseId = String(payload?.course_id || '');
  const mode = payload?.mode === 'replace' ? 'replace' : 'merge';
  // status опционален: если задан — только 'draft'/'reviewed'; если НЕ задан — сохраняем существующий
  // статус записи (для новой записи → 'draft'). Так merge без флага не меняет reviewed.
  const hasStatus = payload?.status !== undefined && payload?.status !== null;
  if (hasStatus && payload.status !== 'draft' && payload.status !== 'reviewed') return json({ error: 'bad_status' }, 400);
  const reqStatus = hasStatus ? payload.status : null;
  const incoming = payload?.sections;

  if (!/^[0-9a-f-]{36}$/i.test(courseId)) return json({ error: 'bad_course_id' }, 400);
  const vErr = validateSections(incoming);
  if (vErr.length) return json({ error: 'bad_sections', details: vErr.slice(0, 20) }, 400);
  if (JSON.stringify(incoming).length > MAX_BYTES) return json({ error: 'too_large' }, 413);

  try {
    // курс существует?
    const cRes = await rest('GET', `course?id=eq.${courseId}&select=id`);
    const cRows = await cRes.json();
    if (!Array.isArray(cRows) || !cRows.length) return json({ error: 'course_not_found' }, 404);

    // существующая запись (для merge/version)
    const eRes = await rest('GET', `cheatsheet?course_id=eq.${courseId}&select=sections,version,status`);
    const eRows = await eRes.json();
    const existing = Array.isArray(eRows) && eRows[0] ? eRows[0] : null;

    // итоговый статус: явный из запроса → он; иначе существующий; иначе (новая запись) → draft
    const status = reqStatus ?? (existing?.status ?? 'draft');

    let finalSections: any;
    if (mode === 'replace' || !existing) {
      finalSections = incoming;
    } else {
      finalSections = { ...(existing.sections || {}), ...incoming }; // merge: пришедшие ключи побеждают
    }

    let wRes: Response;
    if (existing) {
      wRes = await rest('PATCH', `cheatsheet?course_id=eq.${courseId}`, {
        sections: finalSections, status, version: (existing.version || 0) + 1, updated_at: new Date().toISOString(),
      });
    } else {
      wRes = await rest('POST', 'cheatsheet', {
        course_id: courseId, sections: finalSections, status, version: 1, updated_at: new Date().toISOString(),
      });
    }
    if (!wRes.ok) {
      const t = await wRes.text();
      console.error('[cheatsheet-import] write-failed', courseId, wRes.status, t.slice(0, 120));
      return json({ error: 'write_failed' }, 502);
    }

    const c = counts(finalSections);
    console.log('[cheatsheet-import] ok', JSON.stringify({ course_id: courseId, mode, status, counts: c }));
    return json({ ok: true, mode, status, counts: c });
  } catch (err) {
    console.error('[cheatsheet-import] error', courseId, (err as Error)?.message ?? err);
    return json({ error: 'internal' }, 500);
  }
});
