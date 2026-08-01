// Visual-only cleanup for the courses_manage (course editing) page. Injects a scoped
// stylesheet — no logic, no DOM restructuring:
//   - removes the redundant "Все видео курса" button;
//   - unifies every form button to one shape/size/typography (colours kept for role);
//   - neutralises the bright-blue row dividers to a subtle grey.
// Mounted like the other src/_front helpers (init called from main.js).

const PAGE_ID = '16089944-2b20-4dd4-a9a1-f5142bd80c4e';
const STYLE_ID = 'courses-manage-style';
const VIDEO_BTN = '420fdec0-c44c-41a1-b17c-c9e5047c5450';      // "Все видео курса"
const FORM_CARD = 'f847ae7b-c405-41ab-a197-d12b1b081271';      // main edit-form card (button scope)
const BLUE_DIVIDERS = [                                        // rows with a bright-blue border-bottom
    'd2fbc641-daf7-43f5-8fce-61a9e6401291',
    'd78b05e3-79a1-47cf-9185-2fe4fd23831b',
    '40b7e00c-2ee6-437e-a098-b4feeb434354',
    'b8fb59c4-8744-4df3-b1ae-f971fd297730',
];

const CSS = `
[class*="ww-element-${VIDEO_BTN}"]{display:none !important;}
[class*="ww-element-${FORM_CARD}"] .ww-button{
  border-radius:8px !important;
  font-weight:600 !important;
  font-size:14px !important;
  min-height:42px !important;
  padding:8px 20px !important;
  box-shadow:none !important;
}
${BLUE_DIVIDERS.map(u => `[class*="ww-element-${u}"]`).join(',')}{border-bottom-color:#E5E7EB !important;}
`;

function inject() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
}
function remove() {
    document.getElementById(STYLE_ID)?.remove();
}
function isRoute(route) {
    return !!route?.name && route.name.startsWith(`page-${PAGE_ID}`);
}

export function initCoursesManageStyle(router) {
    if (isRoute(router.currentRoute.value)) inject();
    router.afterEach(to => {
        remove();
        if (isRoute(to)) inject();
    });
}
