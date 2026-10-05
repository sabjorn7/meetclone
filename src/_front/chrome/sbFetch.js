// Run a Supabase query with a per-attempt TIMEOUT + RETRY, so a stalled request on a flaky/throttled
// connection auto-recovers instead of hanging the spinner forever. Observed: a user's catalog query
// stalled >15s (loading_timeout) while the server answered everyone else in <0.5s — i.e. a client/
// network stall, where a fresh retry usually succeeds.
//
// `fn` MUST be a thunk that CREATES the query each call (supabase query builders are one-shot), e.g.
//   sbWithRetry('all_course', () => sb.from('course').select('...').eq(...))
// Returns the resolved value (e.g. { data, error }); throws after exhausting all tries (caller then
// renders an empty state instead of an infinite spinner). A timed-out attempt is abandoned (its fetch
// keeps running harmlessly); the next attempt issues a brand-new request.
import { logClientEvent } from './errorLogger.js';

function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout')), ms);
        Promise.resolve(promise).then(
            (v) => { clearTimeout(t); resolve(v); },
            (e) => { clearTimeout(t); reject(e); },
        );
    });
}

export async function sbWithRetry(label, fn, { tries = 3, timeoutMs = 8000 } = {}) {
    let lastErr;
    for (let attempt = 1; attempt <= tries; attempt++) {
        try {
            return await withTimeout(Promise.resolve().then(fn), timeoutMs);
        } catch (e) {
            lastErr = e;
            if (attempt < tries) await new Promise((r) => setTimeout(r, 400 * attempt)); // small backoff
        }
    }
    logClientEvent('loading_timeout', `Запрос не прошёл после ${tries} попыток: ${label}`, { timeoutMs });
    throw lastErr;
}
