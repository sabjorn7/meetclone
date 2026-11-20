import {createUploadQueue} from './uploadQueue.js';
import {uploadQueueState} from './uploadQueueState.js';
import {getSupabase, readStoredSession, authCookieUser} from '../chrome/headerAccount.js';
import {getUploadToken, uploadVideo, fetchVideoSize, PEERTUBE_ORIGIN} from './peertubeUpload.js';
import {removeUnfinishedUpload, removeCancelledResult} from './uploadCancellation.js';
const sb = getSupabase();
let owner = readStoredSession()?.user?.id || authCookieUser()?.id || null;
const editable = ['Черновик', 'Отправлено на доработку', 'Снято с публикации'];
export const uploadQueue = createUploadQueue({
    user: () => owner,
    changed: jobs => { uploadQueueState.value = jobs; },
    token: () => getUploadToken(sb), upload: uploadVideo, size: fetchVideoSize,
    async validate(j) {
        const {data, error} = await sb.from('course').select('id, owner, "ModStatus", video_id').eq('id', j.courseId).eq('owner', j.owner);
        if (error || !data?.length || !editable.includes(data[0].ModStatus)) throw new Error('target_locked');
        let target = data[0];
        if (j.table === 'lessons') {
            const r = await sb.from('lessons').select('id, video_id').eq('id', j.id).eq('Course', j.courseId);
            if (r.error || !r.data?.length) throw new Error('target_missing');
            target = r.data[0];
        }
        if ((target.video_id ?? null) !== j.previousVideoId) throw new Error('video_changed');
    },
    async persist(j, patch) {
        let q = sb.from(j.table).update(patch).eq('id', j.id);
        q = j.table === 'course' ? q.eq('owner', j.owner) : q.eq('Course', j.courseId);
        // Do not overwrite a video replaced by another tab while this task waited.
        q = j.previousVideoId !== null ? q.eq('video_id', j.previousVideoId) : q.is('video_id', null);
        q = j.persistedUploadId !== null ? q.eq('resume_video_id', j.persistedUploadId) : q.is('resume_video_id', null);
        const {data, error} = await q.select('id');
        if (error || !data?.length) throw new Error('checkpoint_not_saved');
    },
    removeSession: j => removeUnfinishedUpload({apiBaseUrl: PEERTUBE_ORIGIN, token: j.token, uploadId: j.uploadId, uncertainFinal: j.uncertainFinal}),
    removeResult: j => removeCancelledResult({apiBaseUrl: PEERTUBE_ORIGIN, token: j.token, uuid: j.newUUID, previousVideoId: j.previousVideoId}),
});
// Never await Supabase work inside its auth callback.
sb.auth.onAuthStateChange((_event, session) => {
    owner = session?.user?.id || null;
    queueMicrotask(() => uploadQueue.accountChanged());
});
let unloadInstalled = false;
function beforeUnload(e) { e.preventDefault(); e.returnValue = ''; }
// Subscription is document-scoped, just like this manager. No polling.
import {watch} from 'vue';
watch(uploadQueueState, jobs => {
    const busy = jobs.some(j => !['complete','cancelled'].includes(j.state));
    if (busy === unloadInstalled) return;
    unloadInstalled = busy;
    window[busy ? 'addEventListener' : 'removeEventListener']('beforeunload', beforeUnload);
});
