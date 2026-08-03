// Injects a "Трансляции" item into the site's burger menu (a WeWeb header section).
//
// The menu's navigation labels ("Все курсы", "Все статьи", …) are <p> children of the menu
// container 6d3cd44d; they have no href/onclick (WeWeb binds the click via Vue), so we can't
// clone their behaviour. Instead we add our own <p>, copy an existing label's className so it
// matches the menu's typography, and attach our own click → SPA-navigate to /streams.
//
// WeWeb re-creates the header DOM on navigation, so a persistent MutationObserver re-injects
// the item whenever it disappears (same pattern as coursesManageStyle.js / mySubscriptions.js).
// Inserting a node is idempotent (guarded by the marker id) and doesn't loop the observer.

const MENU_CONTAINER_UID = '6d3cd44d-33f8-44f7-a4f3-d0710555c8dc'; // holds the nav <p> labels
const CLONE_LABEL_UID = '062cd746-a6fd-4b2e-be13-c8e1a808a7fb'; // "Все курсы" — copy its classes
const AFTER_UID = 'a8466060-c205-4c2b-9a1a-9609b29491d5'; // insert right after "Все статьи"
const MARKER_ID = 'mg-streams-nav';

let observer = null;
let routerRef = null;

function inject() {
    if (document.getElementById(MARKER_ID)) return;
    const container = document.querySelector(`[data-ww-uid="${MENU_CONTAINER_UID}"]`);
    if (!container) return;

    const link = document.createElement('p');
    link.id = MARKER_ID;
    const sample = document.querySelector(`[data-ww-uid="${CLONE_LABEL_UID}"]`);
    if (sample) {
        link.className = sample.className; // layout classes (flex object, text content)
        // WeWeb sets typography via the element's data-ww-uid, not the class, so copy the
        // sample's COMPUTED text styles inline to match font size / weight / colour exactly.
        const cs = getComputedStyle(sample);
        for (const prop of ['fontSize', 'fontWeight', 'color', 'lineHeight', 'fontFamily', 'letterSpacing', 'textTransform']) {
            link.style[prop] = cs[prop];
        }
    }
    link.textContent = 'Трансляции';
    link.style.cursor = 'pointer';
    link.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        if (routerRef) routerRef.push('/streams');
        else window.location.href = '/streams';
    });

    const after = document.querySelector(`[data-ww-uid="${AFTER_UID}"]`);
    if (after && after.parentElement === container) after.insertAdjacentElement('afterend', link);
    else container.appendChild(link);
}

export function initStreamsNavLink(router) {
    routerRef = router || null;
    inject();
    if (!observer) {
        observer = new MutationObserver(() => inject());
        observer.observe(document.body, { childList: true, subtree: true });
    }
}
