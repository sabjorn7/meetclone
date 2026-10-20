#!/usr/bin/env node
// import-cheatsheet.mjs — парсит .md «Конспект курса» → structured sections для таблицы cheatsheet.
//
// Разделы (## ) → вкладки: «Алгоритмы»→algorithms, «Частые вопросы»→faq, «Как применять»→apply.
// Блоки (### ) → {title, body, lesson}. Строку «*Урок: [название](ссылка)*» вырезаем из body,
// ссылку убираем, оставляем только название в поле lesson (plain text) — ссылку в контент НЕ тащим.
//
// Использование:
//   node scripts/import-cheatsheet.mjs <file.md> --course <uuid> [--status draft|reviewed]   # DRY-RUN (по умолчанию)
//   node scripts/import-cheatsheet.mjs <file.md> --course <uuid> --apply                      # печатает SQL для Studio
// DRY-RUN ничего не пишет: печатает разобранную структуру, отчёт валидации и предпросмотр SQL.
// --apply НЕ ходит в БД сам: печатает готовый `select upsert_cheatsheet(...)` — запускаешь в Studio.

import { readFileSync } from 'node:fs';

const SECTION_MAP = [
  { key: 'algorithms', names: ['алгоритмы'] },
  { key: 'faq',        names: ['частые вопросы', 'частые вопрос', 'faq', 'вопросы'] },
  { key: 'apply',      names: ['как применять', 'применение'] },
];
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const sectionKey = (heading) => {
  const h = norm(heading);
  for (const s of SECTION_MAP) if (s.names.includes(h)) return s.key;
  return null;
};

function parseArgs(argv) {
  const a = { file: null, course: null, status: 'draft', apply: false };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--apply') a.apply = true;
    else if (t === '--course') a.course = argv[++i];
    else if (t === '--status') a.status = argv[++i];
    else if (!t.startsWith('--') && !a.file) a.file = t;
  }
  return a;
}

// Вырезать строку урока из блока. Возвращает {body, lesson}. Поддерживает:
//   *Урок: [Название](url)*   |   Урок: [Название](url)   |   *Урок: Название*
function extractLesson(bodyLines) {
  const out = [];
  let lesson = null;
  const re = /^\s*\*?\s*Урок:\s*(?:\[([^\]]+)\]\([^)]*\)|(.+?))\s*\*?\s*$/i;
  for (const ln of bodyLines) {
    const m = ln.match(re);
    if (m) { lesson = (m[1] || m[2] || '').trim() || null; continue; } // строку урока убираем из body
    out.push(ln);
  }
  // обрезать хвостовые/ведущие пустые строки
  while (out.length && out[0].trim() === '') out.shift();
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  return { body: out.join('\n'), lesson };
}

function parse(md) {
  const errors = [], warnings = [];
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const sections = { algorithms: [], faq: [], apply: [] };

  let curSecKey = null, curSecHeading = null;
  let curBlock = null; // {title, bodyLines}
  const flushBlock = () => {
    if (!curBlock) return;
    if (!curSecKey) { errors.push(`Блок «${curBlock.title}» вне известного раздела`); curBlock = null; return; }
    const { body, lesson } = extractLesson(curBlock.bodyLines);
    if (!body.trim()) warnings.push(`Пустое тело блока «${curBlock.title}» (${curSecHeading})`);
    sections[curSecKey].push({ title: curBlock.title.trim(), body, lesson });
    curBlock = null;
  };

  for (const ln of lines) {
    const h2 = ln.match(/^##\s+(?!#)(.+?)\s*$/);
    const h3 = ln.match(/^###\s+(.+?)\s*$/);
    if (h2) {
      flushBlock();
      const key = sectionKey(h2[1]);
      if (!key) { errors.push(`Неизвестный раздел «${h2[1].trim()}» — ожидаются: Алгоритмы / Частые вопросы / Как применять`); curSecKey = null; }
      else curSecKey = key;
      curSecHeading = h2[1].trim();
    } else if (h3) {
      flushBlock();
      if (!curSecKey) errors.push(`Блок «${h3[1].trim()}» идёт до первого известного раздела (##)`);
      curBlock = { title: h3[1].trim(), bodyLines: [] };
    } else {
      if (curBlock) curBlock.bodyLines.push(ln);
      else if (ln.trim() && curSecKey) warnings.push(`Текст вне блока (###) в разделе «${curSecHeading}»: ${ln.trim().slice(0, 40)}…`);
    }
  }
  flushBlock();

  // структурные проверки
  for (const b of [...sections.algorithms, ...sections.faq, ...sections.apply])
    if (!b.title) errors.push('Блок без заголовка (###)');
  const total = sections.algorithms.length + sections.faq.length + sections.apply.length;
  if (total === 0) errors.push('Не найдено ни одного блока');

  return { sections, errors, warnings };
}

// ---- main ----
const args = parseArgs(process.argv);
if (!args.file) { console.error('Укажи путь к .md'); process.exit(2); }
if (!/^[0-9a-f-]{36}$/i.test(args.course || '')) { console.error('--course <uuid> обязателен'); process.exit(2); }
if (!['draft', 'reviewed'].includes(args.status)) { console.error('--status draft|reviewed'); process.exit(2); }

const md = readFileSync(args.file, 'utf8');
const { sections, errors, warnings } = parse(md);

const cnt = (k) => sections[k].length;
console.log('=== РАЗБОР cheatsheet ===');
console.log(`файл: ${args.file}`);
console.log(`курс: ${args.course}  статус: ${args.status}`);
console.log(`разделы: Алгоритмы=${cnt('algorithms')}  Частые вопросы=${cnt('faq')}  Как применять=${cnt('apply')}`);
for (const key of ['algorithms', 'faq', 'apply'])
  for (const b of sections[key])
    console.log(`  [${key}] «${b.title}»  body=${b.body.length} симв.  урок=${b.lesson ? '«' + b.lesson + '» (ссылка вырезана)' : '—'}`);

if (warnings.length) { console.log('\n--- ПРЕДУПРЕЖДЕНИЯ ---'); warnings.forEach((w) => console.log('  ⚠️ ' + w)); }
if (errors.length) {
  console.log('\n--- ОШИБКИ СТРУКТУРЫ (импорт остановлен) ---');
  errors.forEach((e) => console.log('  ⛔ ' + e));
  process.exit(1);
}

console.log('\n=== sections JSON (то, что ляжет в cheatsheet.sections) ===');
const json = JSON.stringify(sections);
console.log(JSON.stringify(sections, null, 2));

if (args.apply) {
  const esc = json.replace(/'/g, "''");
  console.log('\n=== SQL ДЛЯ STUDIO — ПРЯМОЙ upsert (запускаешь ТЫ как postgres; status=' + args.status + ') ===');
  console.log('-- Сид пилота делается прямым upsert: в Studio роль postgres обходит RLS,');
  console.log('-- а RPC upsert_cheatsheet требует auth.uid()=owner/admin (в Studio uid=null → forbidden).');
  console.log(`insert into public.cheatsheet (course_id, sections, status, version, updated_at, updated_by)`);
  console.log(`values ('${args.course}', '${esc}'::jsonb, '${args.status}', 1, now(), null)`);
  console.log(`on conflict (course_id) do update`);
  console.log(`  set sections = excluded.sections, status = excluded.status,`);
  console.log(`      version = public.cheatsheet.version + 1, updated_at = now();`);
  console.log('\n-- Откат этого сида:  delete from public.cheatsheet where course_id = \'' + args.course + '\';');
  console.log('\n-- (Для записи С ФРОНТА авторизованным автором/админом — RPC:');
  console.log(`--   select public.upsert_cheatsheet('${args.course}', '<sections>'::jsonb, '${args.status}');  )`);
} else {
  console.log('\n(DRY-RUN: ничего не записано и не выведено SQL. Для SQL-блока добавь --apply.)');
}
