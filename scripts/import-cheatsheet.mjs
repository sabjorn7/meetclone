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
import { parse } from './lib/cheatsheet-parse.mjs';

function parseArgs(argv) {
  const a = { file: null, course: null, status: 'draft', apply: false, replace: false };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--apply') a.apply = true;
    else if (t === '--replace') a.replace = true;
    else if (t === '--course') a.course = argv[++i];
    else if (t === '--status') a.status = argv[++i];
    else if (!t.startsWith('--') && !a.file) a.file = t;
  }
  return a;
}


// ---- main ----
const args = parseArgs(process.argv);
if (!args.file) { console.error('Укажи путь к .md'); process.exit(2); }
if (!/^[0-9a-f-]{36}$/i.test(args.course || '')) { console.error('--course <uuid> обязателен'); process.exit(2); }
if (!['draft', 'reviewed'].includes(args.status)) { console.error('--status draft|reviewed'); process.exit(2); }

const md = readFileSync(args.file, 'utf8');
const { sections, errors, warnings, present } = parse(md);

const cnt = (k) => sections[k].length;
console.log('=== РАЗБОР cheatsheet ===');
console.log(`файл: ${args.file}`);
console.log(`курс: ${args.course}  статус: ${args.status}`);
console.log(`разделы: Алгоритмы=${cnt('algorithms')}  Частые вопросы=${cnt('faq')}  Как применять=${cnt('apply')}  Словарь=${cnt('glossary')}`);
for (const key of ['algorithms', 'faq', 'apply', 'glossary'])
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
  console.log('\n=== SQL ДЛЯ STUDIO (запускаешь ТЫ как postgres — прямой upsert обходит RLS) ===');
  if (args.replace) {
    // ПОЛНАЯ ЗАМЕНА всего sections (все 4 ключа, включая пустые) — только по явному --replace.
    const esc = json.replace(/'/g, "''");
    console.log('-- режим --replace: ПЕРЕЗАПИСЬ всего sections + status.');
    console.log(`insert into public.cheatsheet (course_id, sections, status, version, updated_at, updated_by)`);
    console.log(`values ('${args.course}', '${esc}'::jsonb, '${args.status}', 1, now(), null)`);
    console.log(`on conflict (course_id) do update`);
    console.log(`  set sections = excluded.sections, status = excluded.status,`);
    console.log(`      version = public.cheatsheet.version + 1, updated_at = now();`);
    console.log('\n-- Откат (режим replace): восстанови sections из бэкапа, снятого ДО запуска:');
    console.log(`--   select sections, status from public.cheatsheet where course_id='${args.course}';  (сохрани до apply)`);
  } else {
    // MERGE по умолчанию: обновляем ТОЛЬКО разделы, присутствующие в файле; остальные ключи
    // (и статус) в существующей записи НЕ трогаем. Через top-level jsonb-слияние `||`.
    const subset = {};
    for (const k of present) subset[k] = sections[k];
    const esc = JSON.stringify(subset).replace(/'/g, "''");
    console.log(`-- режим MERGE (по умолчанию): обновляются ТОЛЬКО разделы из файла: [${present.join(', ') || '—'}].`);
    console.log('-- Остальные разделы и status в записи сохраняются (не трогаем reviewed).');
    console.log(`insert into public.cheatsheet (course_id, sections, status, version, updated_at, updated_by)`);
    console.log(`values ('${args.course}', '${esc}'::jsonb, '${args.status}', 1, now(), null)`);
    console.log(`on conflict (course_id) do update`);
    console.log(`  set sections = coalesce(public.cheatsheet.sections, '{}'::jsonb) || '${esc}'::jsonb,`);
    console.log(`      version = public.cheatsheet.version + 1, updated_at = now();  -- status НЕ меняется`);
    console.log('\n-- Откат для НОВЫХ ключей (которых не было раньше), напр. glossary:');
    for (const k of present) console.log(`--   update public.cheatsheet set sections = sections - '${k}', version=version+1, updated_at=now() where course_id='${args.course}';`);
    console.log('-- Для ПЕРЕЗАПИСАННЫХ существующих ключей — восстанови из бэкапа (сними ДО apply):');
    console.log(`--   select sections from public.cheatsheet where course_id='${args.course}';`);
  }
  console.log('\n-- (Запись С ФРОНТА авторизованным автором/админом идёт через RPC upsert_cheatsheet; этот SQL — для Studio.)');
} else {
  console.log('\n(DRY-RUN: ничего не записано и не выведено SQL. Для SQL-блока добавь --apply.)');
}
