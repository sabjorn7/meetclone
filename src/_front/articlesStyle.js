// Visual-only cleanup for the WeWeb /articles page, mounted like the other src/_front helpers
// (init from main.js). Makes it match the hand-written /streams page:
//   - the content container is constrained to the header width (1200px + 40px side padding, 22px on
//     mobile) so the cards/search line up with the logo (left) and the auth buttons (right);
//   - the "Все статьи" heading is restyled to the same size/weight/placement as the /streams
//     "Трансляции" title (26px / 600, left-aligned at the top of the content).
// Route-gated: injects a <style> only on the articles route. UIDs verified against the live DOM.
const PAGE_ID = '7d160a8b-2036-48b5-993d-604eee6febe4';
const STYLE_ID = 'articles-style';
const CONTENT = 'cd0e297d-75d5-45fb-ba87-d513a77af133'; // main content container (WeWeb default max-width 1440px)
const TITLE = 'e50a07a9-a717-405a-9d1d-661bfe5ec93e';   // "Все статьи" heading (WeWeb default 32px, centered)

const CSS = `
[class*="ww-element-${CONTENT}"]{max-width:1200px !important;padding-left:40px !important;padding-right:40px !important;}
.ww-text-content.ww-element-${TITLE}{font-size:26px !important;font-weight:600 !important;align-self:flex-start !important;text-align:left !important;margin-bottom:20px !important;}
@media (max-width:900px){[class*="ww-element-${CONTENT}"]{padding-left:22px !important;padding-right:22px !important;}}
`;

function inject() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
}
function teardown() {
    document.getElementById(STYLE_ID)?.remove();
}
function isRoute(route) {
    return !!route?.name && route.name.startsWith(`page-${PAGE_ID}`);
}

export function initArticlesStyle(router) {
    if (isRoute(router.currentRoute.value)) inject();
    router.afterEach(to => {
        teardown();
        if (isRoute(to)) inject();
    });
}
