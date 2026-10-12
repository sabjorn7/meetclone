// Resilience helpers for the app's critical boot path (route-chunk import + page-data fetch).
// A flaky mobile network must not leave the user on a hung white screen: bound each network step
// with a timeout, retry it once, and on final failure show a clear error screen (same visual
// language as the template.html boot watchdog) instead of hanging. The UI helpers never throw.
// See report-investigation-dataflow.txt (items 5/8) for the why (data.json that never reached the
// server → fetchData hung with no timeout → router.isReady blocked → boot_late).
import { logClientEvent } from './errorLogger.js';

// Reject if `promise` doesn't settle within `ms`. The underlying work is NOT cancelled (fetch/
// import keep running); we just stop awaiting it so the boot path can proceed/retry.
export function withTimeout(promise, ms, label) {
    let t;
    const timeout = new Promise((_, reject) => {
        t = setTimeout(() => {
            const e = new Error(`timeout:${label || ''}:${ms}ms`);
            e.isTimeout = true;
            reject(e);
        }, ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

function reasonOf(err) {
    if (err && err.isTimeout) return 'timeout';
    if (err && err.code) return String(err.code);
    if (err && err.message) return String(err.message).slice(0, 80);
    return 'error';
}

// Run `thunk` with a timeout; on failure retry ONCE (no cache-bust — the ?_wwcv on data URLs and
// the immutable chunk hashes already version the request, so the retry may reuse the HTTP cache).
// Logs `${type}_retry` {path, attempt, reason} before the retry. Throws the retry's error if it
// also fails (caller decides what to show).
export async function withTimeoutRetry(thunk, { timeout, type, path }) {
    try {
        return await withTimeout(thunk(), timeout, type);
    } catch (err) {
        try { logClientEvent(`${type}_retry`, `${type} retry`, { path, attempt: 1, reason: reasonOf(err) }); } catch (e) { /* logging must never break boot */ }
        return await withTimeout(thunk(), timeout, type);
    }
}

// sessionStorage loop-guard for hard reloads: allow at most ONE location.assign per path per
// `windowMs`. Returns true (and records now) when a reload is allowed; false when this path was
// already reloaded within the window (→ caller shows the error screen instead of looping).
export function allowHardReload(path, windowMs = 60000) {
    try {
        const key = `mg_nav_reload:${path}`;
        const prev = Number(window.sessionStorage.getItem(key) || 0);
        const now = Date.now();
        if (prev && now - prev < windowMs) return false;
        window.sessionStorage.setItem(key, String(now));
        return true;
    } catch (e) {
        return true; // no sessionStorage (private mode) → don't block the single reload
    }
}

// Full-screen error overlay in the boot-watchdog visual language (cf. #mg-boot-msg in
// template.html). Shown when a navigation's chunk or data fetch fails after the retry — a Refresh
// button instead of a hung/blank screen. Idempotent; no auto-reload.
let errorShown = false;
export function showLoadError(message) {
    try {
        if (errorShown || (typeof document !== 'undefined' && document.getElementById('mg-load-error'))) return;
        errorShown = true;
        // If the 15s boot watchdog (template.html) already drew its own overlay, remove it so the two
        // never stack — this load-error screen supersedes it.
        const wd = document.getElementById('mg-boot-msg');
        if (wd && wd.parentNode) wd.parentNode.removeChild(wd);
        const box = document.createElement('div');
        box.id = 'mg-load-error';
        box.setAttribute('style', 'position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:#fff;color:#1f2733;text-align:center;padding:24px;font:16px/1.45 Raleway,system-ui,-apple-system,sans-serif');
        const msg = document.createElement('div');
        msg.innerHTML = message || 'Не удалось загрузить страницу.<br>Проверьте соединение.';
        const btn = document.createElement('button');
        btn.type = 'button'; btn.textContent = 'Обновить';
        btn.setAttribute('style', 'padding:11px 22px;border:none;border-radius:8px;cursor:pointer;color:#fff;background:#2563eb;font:600 16px Raleway,system-ui,sans-serif');
        btn.onclick = function () { try { errorShown = false; } catch (e) { /* ignore */ } location.reload(); };
        box.appendChild(msg); box.appendChild(btn);
        document.body.appendChild(box);
    } catch (e) { /* a UI helper must never throw */ }
}
