#!/usr/bin/env node
// cheatsheet-load.mjs — залить «Конспект курса» из .md в БД через edge-функцию cheatsheet-import.
// БЕЗ Studio и SQL: парсит файл (общий парсер), авто-заменяет «лектор»→«автор курса» с отчётом,
// валидирует, вызывает функцию (ключ из ~/.cheatsheet-import-key, нигде не печатается), затем
// показывает курс/владельца/счётчики/ссылку.
//
//   node scripts/cheatsheet-load.mjs <файл.md> <course_id> [--publish] [--replace]
//     по умолчанию: mode=merge, status=draft. --publish → status=reviewed. --replace → mode=replace.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parse, replaceLecturer, validateSections, KEYS } from './lib/cheatsheet-parse.mjs';

// Публичный anon-ключ (как в бандле сайта) — только для чтения курса/владельца. НЕ секрет.
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICAgInJvbGUiOiAiYW5vbiIsCiAgICAiaXNzIjogInN1cGFiYXNlIiwKICAgICJpYXQiOiAxNzQ1NDQyMDAwLAogICAgImV4cCI6IDE5MDMyMDg0MDAKfQ.6o8FlA2X8jsM4lUKF1mqKSC-v_GX5iE0dY20b6x8bnw';
const BASE = 'https://app.meetgu.ru/sb';
const FN = `${BASE}/functions/v1/cheatsheet-import`;
const REST = `${BASE}/rest/v1`;

function die(msg, code = 1) { console.error('ОШИБКА:', msg); process.exit(code); }

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const courseId = args.filter((a) => !a.startsWith('--'))[1];
const publish = args.includes('--publish');
const draft = args.includes('--draft');
const replace = args.includes('--replace');
if (!file || !courseId) die('использование: cheatsheet-load.mjs <файл.md> <course_id> [--publish|--draft] [--replace]', 2);
if (!/^[0-9a-f-]{36}$/i.test(courseId)) die('course_id не похож на uuid', 2);

// ключ импорта — из файла с правами 600, в вывод НЕ попадает
let importKey;
try { importKey = readFileSync(join(homedir(), '.cheatsheet-import-key'), 'utf8').trim(); }
catch { die('нет ~/.cheatsheet-import-key (создай файл 600 с секретным ключом)'); }
if (!importKey) die('~/.cheatsheet-import-key пуст');

const md = readFileSync(file, 'utf8');
const { sections, errors, warnings, present } = parse(md);
if (errors.length) { console.error('Структурные ошибки:'); errors.forEach((e) => console.error('  ⛔ ' + e)); die('импорт остановлен'); }

// авто-замена «лектор»→«автор курса» с отчётом + предупреждения об оставшихся склоняемых формах
const { replacements, leftovers } = replaceLecturer(sections);

const mode = replace ? 'replace' : 'merge';
// статус шлём ТОЛЬКО по явному флагу: --publish → reviewed, --draft → draft; без флага не шлём
// (функция сохранит существующий статус записи; для новой записи → draft).
const status = publish ? 'reviewed' : (draft ? 'draft' : null);

// MERGE: шлём ТОЛЬКО разделы, присутствующие в файле (present) — пустые массивы отсутствующих
// разделов НЕ отправляем, чтобы merge их не затёр. REPLACE: отправляем sections целиком.
const payloadSections = replace ? sections : Object.fromEntries(present.map((k) => [k, sections[k]]));

// валидация перед отправкой (того, что реально уйдёт)
const vErr = validateSections(payloadSections);
if (vErr.length) { console.error('Валидация:'); vErr.forEach((e) => console.error('  ⛔ ' + e)); die('импорт остановлен'); }

const cnt = Object.fromEntries(KEYS.map((k) => [k, (payloadSections[k] || []).length]));
console.log(`Файл: ${file}`);
console.log(`Курс: ${courseId} | режим: ${mode} | статус: ${status ?? '(не задан → сохранить текущий; новая запись → draft)'}`);
console.log(`Отправляемые разделы (${mode === 'merge' ? 'present' : 'все'}): ${Object.keys(payloadSections).join(', ') || '—'}`);
console.log(`Блоки: algorithms=${cnt.algorithms} faq=${cnt.faq} apply=${cnt.apply} glossary=${cnt.glossary}`);
console.log(warnings.length ? `Предупреждения парсинга: ${warnings.length}` : 'Предупреждений парсинга нет');
if (replacements.length) {
  console.log(`Замены «лектор»→«автор курса»: ${replacements.length}`);
  replacements.forEach((r) => console.log(`  • [${r.where}] «${r.from}» → «${r.to}»`));
} else console.log('Замен «лектор» не потребовалось');
if (leftovers.length) {
  console.log(`⚠️ Оставшиеся склоняемые формы «лектор…» (НЕ заменены автоматически, проверь вручную): ${leftovers.length}`);
  leftovers.forEach((l) => console.log(`  • [${l.where}] «${l.form}»: …${l.context}…`));
}

// вызов функции
const reqBody = { course_id: courseId, sections: payloadSections, mode };
if (status) reqBody.status = status;   // без флага ключ status не отправляем вовсе
const res = await fetch(FN, {
  method: 'POST',
  headers: { 'content-type': 'application/json', apikey: ANON, 'x-import-key': importKey },
  body: JSON.stringify(reqBody),
});
const out = await res.json().catch(() => ({}));
if (!res.ok || !out.ok) die(`функция вернула ${res.status}: ${JSON.stringify(out)}`);
console.log(`\nФункция: ok, записано — status=${out.status}, counts=${JSON.stringify(out.counts)}`);

// проверка чтением: курс/владелец/ссылка (anon REST; cheatsheet читается ТОЛЬКО через get_cheatsheet,
// draft виден автору/админу — обычному пользователю и этому CLI он не отдаётся, это норма).
const c = await (await fetch(`${REST}/course?id=eq.${courseId}&select=Title,slug,owner,Free`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } })).json();
const course = Array.isArray(c) ? c[0] : null;
let ownerName = '—';
if (course?.owner) {
  const u = await (await fetch(`${REST}/users?id=eq.${course.owner}&select=Name,email`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } })).json();
  if (Array.isArray(u) && u[0]) ownerName = `${u[0].Name || ''} <${u[0].email || ''}>`;
}
console.log('\n=== ИТОГ ===');
console.log(`Курс: ${course?.Title || '?'}${course?.Free ? ' (Free)' : ''}`);
console.log(`Владелец: ${ownerName}`);
console.log(`Блоки: algorithms=${out.counts.algorithms} faq=${out.counts.faq} apply=${out.counts.apply} glossary=${out.counts.glossary}`);
console.log(`Статус конспекта: ${out.status}${out.status === 'draft' ? ' (виден только автору/админу до публикации)' : ''}`);
console.log(`Страница курса: https://app.meetgu.ru/course/${course?.slug || courseId}/`);
