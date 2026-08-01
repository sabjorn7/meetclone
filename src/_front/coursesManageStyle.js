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
const BLUE_DIVIDERS = [
    'd2fbc641-daf7-43f5-8fce-61a9e6401291',
    'd78b05e3-79a1-47cf-9185-2fe4fd23831b',
    '40b7e00c-2ee6-437e-a098-b4feeb434354',
    'b8fb59c4-8744-4df3-b1ae-f971fd297730',
];
const STYLE_ID = 'courses-manage-style';

const CSS = `
[class*="ww-element-${VIDEO_BTN}"]{display:none !important;}
[class*="ww-element-${TOGGLE}"]{display:none !important;}
[class*="ww-element-${FORM_CARD}"] .ww-button{
  border-radius:8px !important;min-height:42px !important;padding:8px 20px !important;box-shadow:none !important;
}
[class*="ww-element-${FORM_CARD}"] .ww-button .ww-text-content{font-size:14px !important;font-weight:600 !important;}
${BLUE_DIVIDERS.map(u => `[class*="ww-element-${u}"]`).join(',')}{border-bottom-color:#E5E7EB !important;}
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
