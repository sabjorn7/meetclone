// Observational only: never advances the uploader or persists checkpoints.
export const UPLOAD_RATE_STALE_MS = 10000;
export function createUploadMetrics(totalBytes, initialBytes, notify, now = () => performance.now()) {
    let confirmedBytes = Math.max(0, Math.min(totalBytes, initialBytes || 0));
    let samples = [], started = null, updatedAt = now(), phase = 'preparing';
    function publish() {
        const seconds = samples.reduce((n, s) => n + s.ms, 0) / 1000;
        const bytesPerSecond = samples.length >= 2 && seconds > 0
            ? samples.reduce((n, s) => n + s.bytes, 0) / seconds : null;
        // A broken UI observer must never fail an upload or bypass its checkpoint.
        try { notify?.({totalBytes, confirmedBytes, phase, updatedAt,
            sampleStart: samples[0]?.start ?? updatedAt,
            bytesPerSecond: phase === 'uploading' ? bytesPerSecond : null}); } catch (_) { /* observational */ }
    }
    publish();
    return {
        begin() { started = now(); phase = 'uploading'; publish(); },
        confirm(position) {
            const end = now();
            if (Number.isFinite(position) && position > confirmedBytes && position <= totalBytes) {
                if (started !== null && end > started) {
                    samples.push({bytes: position - confirmedBytes, ms: end - started, start: started});
                    samples = samples.slice(-3);
                }
                confirmedBytes = position; updatedAt = end;
            }
            started = null; publish();
        },
        state(value) { phase = value; if (value !== 'uploading') samples = []; publish(); },
    };
}
export function uploadMetricView(metrics, now, invalidatedAt = -Infinity, unavailable = false) {
    const m = metrics || {confirmedBytes: 0, totalBytes: 0, phase: 'preparing'};
    const rate = !unavailable && m.phase === 'uploading' && now - m.updatedAt < UPLOAD_RATE_STALE_MS
        && now >= m.updatedAt && m.sampleStart >= invalidatedAt ? m.bytesPerSecond : null;
    return {speed: rate > 0 ? `${formatUploadBytes(rate)}/с` : '— КБ/с',
        volume: `Подтверждено: ${formatUploadBytes(m.confirmedBytes)} / ${formatUploadBytes(m.totalBytes)}`,
        eta: rate > 0 && m.confirmedBytes < m.totalBytes
            ? `Осталось примерно ${formatUploadTime((m.totalBytes - m.confirmedBytes) / rate)}` : '',
        status: m.phase === 'finalizing' ? 'Видео передано. Подтверждение результата...' : m.phase === 'complete' ? 'Видео передано. Сохранение...' : ''};
}
export function formatUploadBytes(bytes) {
    const unit = bytes >= 1024 * 1024 ? 1024 * 1024 : 1024;
    return `${(Math.max(0, bytes) / unit).toLocaleString('ru-RU', {maximumFractionDigits: 1})} ${unit === 1024 ? 'КБ' : 'МБ'}`;
}
function formatUploadTime(seconds) {
    const s = Math.max(1, Math.ceil(seconds));
    if (s < 60) return `${s} с`;
    if (s < 3600) return `${Math.ceil(s / 60)} мин`;
    return `${Math.floor(s / 3600)} ч ${Math.ceil(s % 3600 / 60)} мин`;
}
