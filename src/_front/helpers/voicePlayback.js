// Single-active-voice coordinator + shared decode AudioContext for the chat
// voice players. Starting one playback stops the previous (Telegram-style).

let current = null;

/** Register `stopFn` as the active player, stopping whoever was active before. */
export function setActive(stopFn) {
    if (current && current !== stopFn) { try { current(); } catch (e) { /* noop */ } }
    current = stopFn;
}

/** Deregister `stopFn` if it's still the active one (on pause/ended/unmount). */
export function clearActive(stopFn) {
    if (current === stopFn) current = null;
}

// One shared AudioContext for decodeAudioData across all players (decode only —
// playback goes through each player's own <audio> element). Created lazily.
let ctx = null;
export function getAudioContext() {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) { try { ctx = new AC(); } catch (e) { return null; } }
    return ctx;
}

/** decodeAudioData with a callback fallback for older Safari (non-promise form). */
export function decodeAudio(context, arrayBuffer) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const ok = (buf) => { if (!settled) { settled = true; resolve(buf); } };
        const fail = (err) => { if (!settled) { settled = true; reject(err || new Error('decode failed')); } };
        let ret;
        try { ret = context.decodeAudioData(arrayBuffer, ok, fail); } catch (e) { fail(e); return; }
        if (ret && typeof ret.then === 'function') ret.then(ok, fail);
    });
}
