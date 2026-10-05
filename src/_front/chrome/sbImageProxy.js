// Phase 2 of the same-origin Supabase move: rewrite image <img> sources that point at the
// sb.meetgu.ru STORAGE host to the same-origin proxy app.meetgu.ru/sb, so avatars/covers load on
// mobile carriers that DPI-throttle the sb.meetgu.ru subdomain (Phase 1 did the data/API; images
// are the remaining visual breakage). One global MutationObserver catches every <img> — those built
// from hardcoded constants AND the many absolute URLs already baked into DB rows (users.Photo,
// course.cover, …) — so no per-component edits and no DB migration are needed. The DB stays canonical
// on sb.meetgu.ru; only what the browser requests is rewritten.
//
// Note: covers CSS background-images (url(...)) are not <img> and are NOT rewritten here — the common
// case (card covers, avatars, article covers) is <img>, which is covered.
const SB = 'https://sb.meetgu.ru';
const PROXY = 'https://app.meetgu.ru/sb';

function fix(img) {
    const s = img.getAttribute('src');
    if (s && s.startsWith(SB)) img.src = PROXY + s.slice(SB.length);
}
function sweep(node) {
    if (node.tagName === 'IMG') fix(node);
    node.querySelectorAll?.('img[src^="https://sb.meetgu.ru"]').forEach(fix);
}

let started = false;
export function initSbImageProxy() {
    if (started || typeof window === 'undefined') return;
    started = true;
    const run = () => {
        sweep(document);
        new MutationObserver((muts) => {
            for (const m of muts) {
                if (m.type === 'attributes') { if (m.target.tagName === 'IMG') fix(m.target); }
                else m.addedNodes?.forEach((n) => { if (n.nodeType === 1) sweep(n); });
            }
        }).observe(document.documentElement, {
            childList: true, subtree: true, attributes: true, attributeFilter: ['src'],
        });
    };
    if (document.body) run(); else document.addEventListener('DOMContentLoaded', run);
}
