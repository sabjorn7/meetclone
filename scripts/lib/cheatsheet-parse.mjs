// cheatsheet-parse.mjs — общий парсер «Конспекта курса» для import-cheatsheet.mjs и cheatsheet-load.mjs.
//
// Разделы (## ) → ключи: Алгоритмы→algorithms, Частые вопросы→faq, Как применять→apply,
// Словарь/Глоссарий/Ключевые понятия→glossary. Блоки (### ) → {title, body, lesson}.
// Строку «*Урок: [название](ссылка)*» вырезаем из body (ссылку убираем, оставляем только название,
// иначе lesson=null). В glossary без «###» строки «**Термин.** определение» разбираются как блоки,
// glossary сортируется по алфавиту.

export const KEYS = ['algorithms', 'faq', 'apply', 'glossary'];

export const SECTION_MAP = [
  { key: 'algorithms', names: ['алгоритмы'] },
  { key: 'faq',        names: ['частые вопросы', 'частые вопрос', 'faq', 'вопросы'] },
  { key: 'apply',      names: ['как применять', 'применение'] },
  { key: 'glossary',   names: ['словарь', 'глоссарий', 'ключевые понятия'] },
];

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
export const sectionKey = (heading) => {
  const h = norm(heading);
  for (const s of SECTION_MAP) if (s.names.includes(h)) return s.key;
  return null;
};

function extractLesson(bodyLines) {
  const out = [];
  let lesson = null;
  // строка урока «*Урок: …*» с ОДНОЙ или НЕСКОЛЬКИМИ ссылками через запятую. Из каждого
  // «[текст](url)» оставляем только текст, любые голые URL убираем — ссылки (в т.ч. на
  // video.meetgu.ru) в конспект попадать не должны.
  const head = /^\s*\*?\s*Урок:\s*(.*?)\s*\*?\s*$/i;
  for (const ln of bodyLines) {
    const m = ln.match(head);
    if (m) {
      const v = m[1]
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')  // [текст](url) → текст
        .replace(/https?:\/\/\S+/g, '')           // голые ссылки → убрать
        .replace(/\s*,\s*/g, ', ')                // нормализуем запятые
        .replace(/\s{2,}/g, ' ')
        .replace(/[\s,]+$/, '')
        .trim();
      lesson = v || null;
      continue;
    }
    out.push(ln);
  }
  while (out.length && out[0].trim() === '') out.shift();
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  return { body: out.join('\n'), lesson };
}

export function parse(md) {
  const errors = [], warnings = [];
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  const sections = { algorithms: [], faq: [], apply: [], glossary: [] };

  const present = new Set();
  let curSecKey = null, curSecHeading = null;
  let curBlock = null;
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
      if (!key) { errors.push(`Неизвестный раздел «${h2[1].trim()}» — ожидаются: Алгоритмы / Частые вопросы / Как применять / Словарь`); curSecKey = null; }
      else { curSecKey = key; present.add(key); }
      curSecHeading = h2[1].trim();
    } else if (h3) {
      flushBlock();
      if (!curSecKey) errors.push(`Блок «${h3[1].trim()}» идёт до первого известного раздела (##)`);
      curBlock = { title: h3[1].trim(), bodyLines: [] };
    } else if (curSecKey === 'glossary' && /^\s*\*\*[^*]+\*\*/.test(ln)) {
      flushBlock();
      const m = ln.match(/^\s*\*\*\s*(.+?)\s*\*\*\s*(.*)$/);
      const term = (m ? m[1] : ln).replace(/\.\s*$/, '').trim();
      curBlock = { title: term, bodyLines: m && m[2] ? [m[2]] : [] };
    } else {
      if (curBlock) curBlock.bodyLines.push(ln);
      else if (ln.trim() && curSecKey) warnings.push(`Текст вне блока (###) в разделе «${curSecHeading}»: ${ln.trim().slice(0, 40)}…`);
    }
  }
  flushBlock();

  sections.glossary.sort((a, b) => a.title.localeCompare(b.title, 'ru'));

  for (const b of [...sections.algorithms, ...sections.faq, ...sections.apply, ...sections.glossary])
    if (!b.title) errors.push('Блок без заголовка (###)');
  const total = KEYS.reduce((n, k) => n + sections[k].length, 0);
  if (total === 0) errors.push('Не найдено ни одного блока');

  return { sections, errors, warnings, present: [...present] };
}

// Автозамена «лектор / по словам лектора» → «автор курса». Возвращает {sections, replacements}.
// Работает по body и title каждого блока; сохраняет регистр первой буквы. Склоняемые формы кроме
// фразы «по словам лектора» намеренно не трогаем (чтобы не портить грамматику) — о пропусках не молчим.
export function replaceLecturer(sections) {
  const replacements = [];
  const leftovers = [];
  // \b не работает с кириллицей → границы слова через unicode-lookaround.
  const PHRASE = /(?<![\p{L}\p{N}_])по словам лектора(?![\p{L}\p{N}_])/giu;
  const WORD = /(?<![\p{L}\p{N}_])лектор(?![\p{L}\p{N}_])/giu;          // только именительный «лектор»
  const LEFT = /(?<![\p{L}\p{N}_])лектор\p{L}+/giu;                      // склоняемые формы (лектора, лектору…)
  const fix = (text, where) => {
    if (!text) return text;
    let out = text.replace(PHRASE, (m) => { replacements.push({ where, from: m, to: 'по словам автора курса' }); return 'по словам автора курса'; });
    out = out.replace(WORD, (m) => {
      const to = /^Л/u.test(m) ? 'Автор курса' : 'автор курса';
      replacements.push({ where, from: m, to });
      return to;
    });
    // оставшиеся склоняемые формы — НЕ молчим, собираем с контекстом как предупреждение
    LEFT.lastIndex = 0;
    let lm;
    while ((lm = LEFT.exec(out)) !== null) {
      const s = Math.max(0, lm.index - 25), e = Math.min(out.length, lm.index + lm[0].length + 25);
      leftovers.push({ where, form: lm[0], context: out.slice(s, e).replace(/\s+/g, ' ').trim() });
    }
    return out;
  };
  for (const k of KEYS) {
    for (const b of sections[k] || []) {
      b.title = fix(b.title, `${k}/${b.title}`);
      b.body = fix(b.body, `${k}/${b.title}`);
    }
  }
  return { sections, replacements, leftovers };
}

// Валидация структуры sections перед отправкой в функцию (используется и CLI, и функцией-зеркалом).
export function validateSections(sections) {
  const problems = [];
  if (!sections || typeof sections !== 'object') return ['sections не объект'];
  for (const k of Object.keys(sections)) if (!KEYS.includes(k)) problems.push(`неизвестный ключ раздела: ${k}`);
  for (const k of KEYS) {
    if (sections[k] === undefined) continue;
    if (!Array.isArray(sections[k])) { problems.push(`${k}: не массив`); continue; }
    sections[k].forEach((b, i) => {
      if (!b || typeof b !== 'object') { problems.push(`${k}[${i}]: не объект`); return; }
      if (!b.title || typeof b.title !== 'string') problems.push(`${k}[${i}]: пустой/нестроковый title`);
      if (typeof b.body !== 'string') problems.push(`${k}[${i}]: body не строка`);
      if (!('lesson' in b)) problems.push(`${k}[${i}]: нет поля lesson`);
      const blob = `${b.title || ''}\n${b.body || ''}`;
      if (/<\s*(script|iframe)/i.test(blob)) problems.push(`${k}[${i}]: запрещённый тег <script>/<iframe>`);
    });
  }
  return problems;
}
