// Pause only between acknowledged chunks; cancellation still uses the upload AbortSignal.
export function createUploadPause(onState = () => {}) {
    let requested = false, finalizing = false, waiting = null;
    const publish = state => { try { onState(state); } catch (_) { /* UI observer */ } };
    return {
        request() {
            if (finalizing || requested) return;
            requested = true; publish('pausing');
        },
        resume() {
            requested = false;
            if (waiting) waiting();
            else publish('running');
        },
        finalizing() { finalizing = true; requested = false; publish('finalizing'); },
        async wait(signal, onPaused) {
            if (signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError');
            if (!requested) return;
            await new Promise((resolve, reject) => {
                const finish = error => {
                    signal?.removeEventListener('abort', abort);
                    waiting = null; requested = false;
                    if (error) reject(error); else { publish('running'); resolve(); }
                };
                const abort = () => finish(new DOMException('Upload cancelled', 'AbortError'));
                waiting = () => finish();
                signal?.addEventListener('abort', abort, {once: true});
                onPaused?.(); publish('paused');
            });
        },
    };
}
