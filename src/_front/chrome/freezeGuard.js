// freezeGuard — tab-freeze (iOS suspend) aware timers. NO imports on purpose: both errorLogger and
// bootResilience use it, and they must not import each other (cycle). Owns the hidden-time tracker.
//
// Problem (measured): iOS suspends a backgrounded tab; setTimeout is deadline-based on wall-clock, so
// an overdue timer fires IMMEDIATELY on wake → false timeout/abort/overlay. guardedTimeout detects a
// freeze at fire time and RE-ARMS one full fresh window instead of firing falsely.

let hiddenMs = 0, hiddenSince = null, wasHidden = false;
(function initVis() {
    try {
        if (typeof document === 'undefined') return;
        wasHidden = document.visibilityState === 'hidden';
        if (wasHidden) hiddenSince = Date.now();
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') { wasHidden = true; hiddenSince = Date.now(); }
            else if (hiddenSince != null) { hiddenMs += Date.now() - hiddenSince; hiddenSince = null; }
        }, { passive: true });
    } catch (e) { /* ignore */ }
})();

// Total hidden time since page start (includes the span currently hidden). SINGLE SOURCE: the inline
// template.html watchdog starts tracking hidden time BEFORE this module loads and exposes window.__mgHid;
// prefer it so hm covers the pre-module-load hidden span too. Fall back to our own counter (tests /
// no inline watchdog).
export function getHiddenMs() {
    try { if (typeof window !== 'undefined' && typeof window.__mgHid === 'function') return window.__mgHid(); } catch (e) { /* fall through */ }
    return hiddenMs + (hiddenSince != null ? Date.now() - hiddenSince : 0);
}
export function getWasHidden() { return wasHidden || (typeof window !== 'undefined' && !!window.__mgWasHidden); }

// A window counts as "frozen" if the timer fired >=2s late by EITHER clock (perf or wall) OR the tab
// accumulated >=1s of hidden time during the window. Exported for unit tests.
export function wasFrozen(lateWall, latePerf, dHidden) {
    return lateWall >= 2000 || latePerf >= 2000 || dHidden >= 1000;
}

// Cap timer_rearmed telemetry to 3 per page load (across all guarded timers).
let rearmReports = 0;
export const MAX_REARM_REPORTS = 3;

// guardedTimeout(cb, ms, {label, onRearm}) → { clear() }. If the first fire looks frozen, re-arm ONCE
// for a full fresh window (no cb, no error) and report (<=3/page). The SAME handle.clear() cancels the
// re-armed window too.
export function guardedTimeout(cb, ms, opts) {
    opts = opts || {};
    let cleared = false, rearmed = false, timer = null;
    const hasPerf = typeof performance !== 'undefined' && !!performance.now;
    function arm() {
        const dueWall = Date.now() + ms;
        const duePerf = hasPerf ? performance.now() + ms : null;
        const hiddenAtStart = getHiddenMs();
        timer = setTimeout(() => {
            if (cleared) return;
            const lateWall = Date.now() - dueWall;
            const latePerf = duePerf != null ? performance.now() - duePerf : 0;
            const dHidden = getHiddenMs() - hiddenAtStart;
            if (!rearmed && wasFrozen(lateWall, latePerf, dHidden)) {
                rearmed = true;
                if (opts.onRearm && rearmReports < MAX_REARM_REPORTS) {
                    rearmReports++;
                    const clock = lateWall >= 2000 ? (latePerf >= 2000 ? 'both' : 'date') : (latePerf >= 2000 ? 'perf' : 'hidden');
                    try { opts.onRearm({ label: opts.label || '', lateness: Math.round(Math.max(lateWall, latePerf)), hiddenMs: Math.round(dHidden), clock }); } catch (e) { /* telemetry must not break */ }
                }
                arm(); // one full fresh window instead of a false timeout
                return;
            }
            cb();
        }, ms);
    }
    arm();
    return { clear() { cleared = true; if (timer) { clearTimeout(timer); timer = null; } } };
}
