// Visual-only cleanup for the courses_manage (course editing) page. Mounted like the
// other src/_front helpers (init from main.js). No functional logic is changed — it only
// restyles and forces the lessons list open.
//   - removes the redundant "Все видео курса" button and the "Показать/Скрыть" toggle
//     (lessons are forced open so they're always visible);
//   - one consistent button system by ROLE (primary blue / secondary neutral outline /
//     danger red), applied by button text so it also covers the lesson-editor buttons that
//     appear only while a lesson is being edited (a live observer re-applies on changes);
//   - unified button shape + text size/weight; neutralises the bright-blue row dividers.
const PAGE_ID = '16089944-2b20-4dd4-a9a1-f5142bd80c4e';
const FORM_CARD = 'f847ae7b-c405-41ab-a197-d12b1b081271';
const VIDEO_BTN = '420fdec0-c44c-41a1-b17c-c9e5047c5450'; // "Все видео курса"
const TOGGLE = 'f181ad5f-2e81-4e0d-a280-41abb261757c';    // "Показать"/"Скрыть" lessons toggle
// All the form's row dividers — hidden; a single divider is drawn by the injected
// "Редактирование уроков курса" heading between the settings and the lessons.
const HIDE_DIVIDERS = [
    'd2fbc641-daf7-43f5-8fce-61a9e6401291',
    '05afe2c4-51dc-497e-acee-3400ece828a6',
    'de6ff336-7746-4097-b1e6-7a7aa884e7d7',
    '2f8dcbe9-8122-498b-a366-69af048aa3f7',
    '3c74dff1-8afe-4e86-a380-08445641b251',
    'd78b05e3-79a1-47cf-9185-2fe4fd23831b',
    'e1886002-8a2c-4def-94cd-564ec8e43420',
    '40b7e00c-2ee6-437e-a098-b4feeb434354',
];
const LESSON_DIVIDER = 'b8fb59c4-8744-4df3-b1ae-f971fd297730'; // inside the lesson editor — kept, greyed
const LESSONS_ROW = 'c0c34253-c6d1-494c-8387-94cfdb1ff285';    // "Уроки курса" row — heading anchor
const HEADING_ID = 'cm-lessons-heading';
const STYLE_ID = 'courses-manage-style';

const CSS = `
[class*="ww-element-${VIDEO_BTN}"]{display:none !important;}
[class*="ww-element-${TOGGLE}"]{display:none !important;}
[class*="ww-element-${FORM_CARD}"] .ww-button{
  border-radius:8px !important;min-height:42px !important;padding:8px 20px !important;box-shadow:none !important;
}
[class*="ww-element-${FORM_CARD}"] .ww-button .ww-text-content{font-size:14px !important;font-weight:600 !important;}
[class*="ww-element-${FORM_CARD}"] .ww-file-upload__dropzone{background:#ffffff !important;border:1px solid #D7DEE8 !important;border-radius:8px !important;box-shadow:none !important;}
[class*="ww-element-${FORM_CARD}"] .ww-file-upload__dropzone .ww-text-content{color:#5B6472 !important;font-size:14px !important;font-weight:600 !important;}
${HIDE_DIVIDERS.map(u => `[class*="ww-element-${u}"]`).join(',')}{border-bottom:none !important;}
[class*="ww-element-${LESSON_DIVIDER}"]{border-bottom-color:#E5E7EB !important;}
#${HEADING_ID}{border-top:1px solid #E5E7EB;margin:12px 0 4px;padding-top:22px;font-size:20px;font-weight:600;color:#1B1F27;text-align:center;width:100%;box-sizing:border-box;}
`;

const PRIMARY = ['Сохранить', 'Загрузить', 'Добавить урок'];
const DANGER = ['Удалить', 'Удалить курс'];
const SECONDARY = ['Отменить', 'Изменить', 'Посмотреть'];
const ROLE = {
    primary: { bg: '#5495F3', color: '#ffffff', border: '#5495F3' },
    danger: { bg: '#E5484D', color: '#ffffff', border: '#E5484D' },
    secondary: { bg: '#ffffff', color: '#5B6472', border: '#D7DEE8' },
};
function roleOf(t) {
    if (PRIMARY.includes(t)) return 'primary';
    if (DANGER.includes(t)) return 'danger';
    if (SECONDARY.includes(t)) return 'secondary';
    return null;
}

let observer = null;
let expandTried = false;

// Colour every form button by role (by text, so it also covers the dynamically-shown
// lesson-editor buttons). Setting inline styles doesn't trigger childList mutations, so
// the observer that drives this can't loop.
function paint() {
    const card = document.querySelector(`[class*="ww-element-${FORM_CARD}"]`);
    if (!card) return;
    card.querySelectorAll('.ww-button').forEach(b => {
        const role = roleOf((b.innerText || '').trim());
        if (!role) return;
        const s = ROLE[role];
        b.style.setProperty('background', s.bg, 'important');
        b.style.setProperty('border', `1px solid ${s.border}`, 'important');
        b.querySelectorAll('.ww-text-content').forEach(x => x.style.setProperty('color', s.color, 'important'));
    });
    // Insert the "Редактирование уроков курса" heading (with its single divider) before the
    // lessons list; re-inserted whenever the tab re-renders it away.
    if (!document.getElementById(HEADING_ID)) {
        const anchor = document.querySelector(`[class*="ww-element-${LESSONS_ROW}"]`);
        if (anchor?.parentNode) {
            const h = document.createElement('div');
            h.id = HEADING_ID;
            h.textContent = 'Редактирование уроков курса';
            anchor.parentNode.insertBefore(h, anchor);
        }
    }
    // Force the lessons list open once (so it's always visible), then the toggle stays hidden.
    if (!expandTried) {
        const tog = document.querySelector(`[class*="ww-element-${TOGGLE}"]`);
        if (tog && (tog.innerText || '').trim() === 'Показать') {
            tog.click();
            expandTried = true;
        }
    }
}

function inject() {
    if (!document.getElementById(STYLE_ID)) {
        const s = document.createElement('style');
        s.id = STYLE_ID;
        s.textContent = CSS;
        document.head.appendChild(s);
    }
    paint();
    if (!observer) {
        observer = new MutationObserver(paint);
        observer.observe(document.body, { childList: true, subtree: true });
    }
}
function teardown() {
    if (observer) { observer.disconnect(); observer = null; }
    document.getElementById(STYLE_ID)?.remove();
    expandTried = false;
}
function isRoute(route) {
    return !!route?.name && route.name.startsWith(`page-${PAGE_ID}`);
}

export function initCoursesManageStyle(router) {
    if (isRoute(router.currentRoute.value)) inject();
    router.afterEach(to => {
        teardown();
        if (isRoute(to)) inject();
    });
}
