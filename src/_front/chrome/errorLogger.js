// Lightweight client error/diagnostics logger → public.client_error_log (insert-only).
// Purpose: when users report "сайт не грузится", give us real data (what actually failed) instead of
// only their words — distinguish a deploy-race recurrence (lazy-chunk 404 → resource_error) from a
// new cause (Supabase hang → loading_timeout / unhandled_rejection).
//
// Never throws, self-throttles (1 per type+message / 10s), resolves supabase + user lazily at log time
// (so it works for guests on the anon key too). Reads go through admin_list_client_errors (admin-gated);
// clients can only INSERT.
import { getSupabase, readStoredSession, authCookieUser } from './headerAccount.js';

const THROTTLE_MS = 10000;
const lastSent = new Map(); // "type|msgPrefix" -> ts

function currentUserId() {
    try { return readStoredSession()?.user?.id || authCookieUser()?.id || null; } catch (e) { return null; }
}

async function send(eventType, message, stack) {
    try {
        const key = `${eventType}|${(message || '').slice(0, 120)}`;
        const now = Date.now();
        if (now - (lastSent.get(key) || 0) < THROTTLE_MS) return; // throttle cyclic errors
        lastSent.set(key, now);
        const sb = getSupabase();
        if (!sb) return;
        await sb.from('client_error_log').insert({
            event_type: eventType,
            message: (message || '').slice(0, 2000),
            stack: stack ? String(stack).slice(0, 8000) : null,
            url: (location.href || '').slice(0, 1000),
            user_agent: (navigator.userAgent || '').slice(0, 500),
            user_id: currentUserId(),
        });
    } catch (e) { /* logging must never break the app */ }
}

// Manual event (e.g. loading_timeout). extra = small JSON-able object, folded into the message.
export function logClientEvent(eventType, message, extra) {
    send(eventType, extra ? `${message} ${JSON.stringify(extra).slice(0, 400)}` : message, null);
}

// Log a thrown Error WITH its stack (e.g. a Vue render/lifecycle crash — those don't reach
// window.onerror, so they are the main reason a "white screen" leaves no log otherwise).
export function logException(eventType, err, extra) {
    const msg = (err && (err.message || String(err))) || 'error';
    send(eventType, extra ? `${msg} ${JSON.stringify(extra).slice(0, 300)}` : msg, err?.stack);
}

// Spinner watchdog: logs `loading_timeout` if not cancelled within `ms`. Does NOT abort the request —
// just records that a key query was still pending. Returns a cancel fn to call once the request returns.
export function loadTimeout(label, ms = 15000) {
    const t = setTimeout(() => logClientEvent('loading_timeout', `Долгая загрузка: ${label}`), ms);
    return () => clearTimeout(t);
}

let installed = false;
export function initErrorLogger() {
    if (installed || typeof window === 'undefined') return;
    installed = true;
    // capture=true → also catches RESOURCE load failures (e.g. a lazy chunk 404 = deploy-race recurrence),
    // which do not bubble and carry no .error — detect them via the event target's src/href.
    window.addEventListener('error', (e) => {
        if (e?.error) { send('window_error', e.error.message || String(e.message || 'error'), e.error.stack); return; }
        // Resource load failures. Log our own bundle chunks (a lazy-chunk 404 = deploy-race recurrence)
        // AND an explicit allowlist of CRITICAL external scripts (vkid / unpkg / id.vk.com — the VK ID
        // SDK) so a blocked/throttled CDN load is diagnosable. Everything else (images, weweb icon CDNs)
        // stays filtered out so the table isn't drowned in noise. The [self-hosted]/[external] tag lets
        // us tell our own chunk failures from a third-party CDN failure at a glance.
        const u = (e?.target && (e.target.src || e.target.href)) || '';
        const own = /\/assets\/[^?]*\.(js|mjs|css)(\?|$)/.test(u);
        const critExternal = /(unpkg\.com|id\.vk\.com|vkid)/i.test(u);
        if (own || critExternal) {
            const srcTag = u.startsWith(location.origin) ? 'self-hosted' : 'external';
            send('resource_error', `Не загрузился ресурс [${srcTag}]: ${u}`, null);
        }
    }, true);
    window.addEventListener('unhandledrejection', (e) => {
        const r = e?.reason;
        send('unhandled_rejection', (r && (r.message || String(r))) || 'unhandledrejection', r?.stack);
    });
}
