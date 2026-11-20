import { createUploadPause } from './uploadPause.js';
const terminal = new Set(['complete', 'cancelled']);
export const unfinishedUpload = job => !terminal.has(job.state);
const emptyResume = {resume_video_id: null, resume_chunk: null, resume_name: null};
// Dependencies are injected; this module has no browser/API singleton or component references.
export function createUploadQueue(deps) {
    const jobs = [];
    let active = null, sequence = 0;
    function publish() {
        deps.changed(jobs.filter(j => j.owner === deps.user()).map(j => ({
            key: j.key, table: j.table, id: j.id, courseId: j.courseId, title: j.title,
            state: j.state, progress: j.progress, metrics: j.metrics, error: j.error,
            patch: {...j.patch}, revision: j.revision, canRetry: j.state === 'error' && (!j.uncertainFinal || !!j.newUUID),
        })));
    }
    function identity(j) { if (j.owner !== deps.user() || j.detached) throw new Error('account_changed'); }
    async function persist(j, values) {
        identity(j);
        await deps.persist(j, values);
        identity(j);
        if (Object.hasOwn(values, 'resume_video_id')) j.persistedUploadId = values.resume_video_id;
        Object.assign(j.row, values); j.patch = {...j.patch, ...values}; j.revision++; publish();
    }
    function state(j, value) { j.state = value; publish(); }
    async function cleanup(j) {
        identity(j);
        await deps.validate(j); identity(j);
        if (j.newUUID) await deps.removeResult(j);
        else if (j.uploadId) await deps.removeSession(j);
        if (j.uploadId || j.newUUID) await persist(j, emptyResume);
        j.file = null; j.token = null; state(j, 'cancelled');
    }
    async function run(j) {
        active = j; j.controller = new AbortController(); j.error = '';
        j.pause = createUploadPause(s => {
            if (j.cancelRequested || j.detached) return;
            state(j, s === 'running' ? 'uploading' : s);
        });
        try {
            identity(j); state(j, j.cleanup ? 'cancelling' : 'preparing');
            await deps.validate(j); identity(j);
            j.token = await deps.token(); identity(j);
            if (j.cancelRequested) j.cleanup = true;
            if (j.cleanup) { await cleanup(j); return; }
            if (!j.newUUID) {
                await persist(j, {resume_name: j.file.name});
                if (j.cancelRequested) throw new DOMException('Cancelled', 'AbortError');
                state(j, 'uploading');
                const result = await deps.upload({
                    token: j.token, file: j.file, signal: j.controller.signal, pause: j.pause,
                    resumeUploadId: j.uploadId, resumeStart: Number(j.row.resume_chunk || 0),
                    onFinalChunk: () => { j.uncertainFinal = true; },
                    onInit: async id => { j.uploadId = id; j.row.resume_video_id = id; await persist(j, {resume_video_id: id}); },
                    onChunk: pos => persist(j, {resume_chunk: String(pos)}),
                    onProgress: p => { j.progress = p; publish(); },
                    onMetrics: m => { j.metrics = m; publish(); },
                });
                j.newUUID = result.uuid;
            }
            identity(j);
            if (j.cancelRequested) { await cleanup(j); return; }
            const size = await deps.size(j.newUUID); identity(j);
            if (j.cancelRequested) { await cleanup(j); return; }
            state(j, 'saving');
            await deps.validate(j); // target may have been deleted/locked in another tab
            await persist(j, {video_id: j.newUUID, video_size: size, ...emptyResume});
            j.file = null; state(j, 'complete');
        } catch (_) {
            if (j.detached || j.owner !== deps.user()) {
                j.file = null; j.error = 'Вход изменился. Загрузка остановлена; состояние сохранено.'; state(j, 'interrupted');
            } else if (j.cancelRequested) {
                try { await cleanup(j); }
                catch (_) { j.error = 'Удаление не подтверждено. Повторите удаление.'; state(j, 'cleanup_error'); }
            } else {
                j.error = j.uncertainFinal && !j.newUUID
                    ? 'Не удалось подтвердить завершение видео. Сохранённую загрузку нужно проверить перед повтором.'
                    : 'Загрузка или сохранение не завершены. Можно повторить или удалить загрузку.';
                state(j, j.cleanup ? 'cleanup_error' : 'error');
            }
        } finally {
            j.token = null; active = null; publish(); schedule();
        }
    }
    function schedule() {
        queueMicrotask(() => {
            if (active) return;
            const next = jobs.find(j => j.state === 'queued' && j.owner === deps.user() && !j.detached);
            if (next) void run(next);
        });
    }
    function find(key) { const j = jobs.find(j => j.key === key); if (!j) throw new Error('missing_task'); identity(j); return j; }
    return {
        enqueue({table, row, courseId, title, file, cleanup = false}) {
            if (!['course', 'lessons'].includes(table) || !row.id || !courseId || !deps.user()) throw new Error('invalid_target');
            if (!cleanup && (!file || file.size <= 0)) throw new Error('empty_file');
            if (jobs.some(j => j.owner === deps.user() && j.table === table && j.id === row.id && unfinishedUpload(j))) throw new Error('duplicate_target');
            if (jobs.filter(unfinishedUpload).length >= 20) throw new Error('queue_full');
            // Retain only current terminal history, releasing File references on success/cancel.
            while (jobs.filter(j => !unfinishedUpload(j)).length >= 10) jobs.splice(jobs.findIndex(j => !unfinishedUpload(j)), 1);
            const j = {key: String(++sequence), owner: deps.user(), table, id: row.id, courseId, title,
                row: {...row}, previousVideoId: row.video_id ?? null, file, uploadId: row.resume_video_id || null,
                persistedUploadId: row.resume_video_id ?? null, cleanup, state: 'queued', progress: 0, metrics: null, error: '', patch: {}, revision: 0};
            jobs.push(j); publish(); schedule(); return j.key;
        },
        pause(key) { const j = find(key); if (j.state === 'queued') state(j, 'paused_queue'); else if (j.state === 'uploading') j.pause.request(); },
        resume(key) { const j = find(key); if (j.state === 'paused_queue') { state(j, 'queued'); schedule(); } else if (['paused','pausing'].includes(j.state)) j.pause.resume(); },
        cancel(key) {
            const j = find(key); if (['complete','cancelled','saving'].includes(j.state)) return;
            j.cancelRequested = true;
            if (j === active) { state(j, 'cancelling'); j.controller.abort(); }
            else if (!j.uploadId && !j.newUUID) { j.file = null; state(j, 'cancelled'); }
            else { j.cleanup = true; state(j, 'queued'); schedule(); }
        },
        retry(key) {
            const j = find(key);
            if (j.state !== 'error' || (j.uncertainFinal && !j.newUUID)) return;
            state(j, 'queued'); schedule();
        },
        dismiss(key) { const j = jobs.find(j => j.key === key && j.owner === deps.user()); if (!j || (!terminal.has(j.state) && j.state !== 'interrupted')) return; jobs.splice(jobs.indexOf(j), 1); publish(); },
        accountChanged() {
            for (const j of jobs) if (j.owner !== deps.user() && unfinishedUpload(j)) {
                j.detached = true; j.controller?.abort(); j.file = null; j.state = 'interrupted'; j.error = 'Вход изменился. Выберите файл заново в редакторе; сохранённая сессия не удалена.';
            }
            publish();
        },
    };
}
