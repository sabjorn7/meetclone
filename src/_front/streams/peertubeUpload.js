// PeerTube resumable video upload for the hand-written /courses_manage (course/lesson videos).
//
// The upload PROTOCOL below is a verbatim port of the proven WeWeb uploader element
// (src/components/elements/element-6dcad208-.../src/wwElement.vue): init a resumable session,
// PUT the file in 5 MB chunks with Content-Range (308 = keep going), then read video.uuid from the
// final 2xx (with a /videos/uploaded fallback when the body is empty). Not a rewrite — same endpoints,
// headers, chunk size, and finalize logic, lifted out of the WeWeb runtime into a plain helper.
//
// TOKEN: the whole platform uploads/streams through ONE shared PeerTube "system" account whose token is
// cached in Supabase `Peertube_System`. getUploadToken() reuses peertubeLive.getPeertubeToken() (cached →
// refresh_token grant) and, when that fails, falls back to the PASSWORD grant — the part peertubeLive.js
// deliberately omits. This page is the platform's token bootstrap: opening it (or uploading) heals an
// expired refresh_token so streams keep working. The token has been observed to actually expire in
// practice, so the password bootstrap is required for reliability, not a hypothetical.
//
// SECURITY (SF-1): client_secret + the account username/password below are ALREADY publicly present in the
// deployed WeWeb page data — replicating them here adds no new exposure. The root fix is moving the token
// exchange server-side (n8n / edge function); tracked as SF-1 in SECURITY_FINDINGS.md.

import { getPeertubeToken, PEERTUBE_ORIGIN } from './peertubeLive.js';

const CLIENT_ID = 'rf2ju4r862ak1j05xl4sfrybsnjkh9xp';
const CLIENT_SECRET = 'GTU741v51FpMM6aOawM6E4XOc891UNYx';
const UPLOAD_USER = 'upload';
const UPLOAD_PASS = 'meetguruvideo';
const CHANNEL_ID = 5;
const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB — same as the WeWeb uploader
const PRIVACY_UNLISTED = 2;         // unlisted + UI-gated, same as course/lesson videos

export { PEERTUBE_ORIGIN };

/** Password-grant heal of the system account (bootstraps Peertube_System when refresh has expired). */
async function passwordGrantToken(supabase) {
    const body = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'password',
        response_type: 'code',
        username: UPLOAD_USER,
        password: UPLOAD_PASS,
    });
    const res = await fetch(`${PEERTUBE_ORIGIN}/api/v1/users/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    if (!res.ok) throw new Error(`Не удалось авторизоваться в PeerTube (${res.status}).`);
    const tok = await res.json(); // { access_token, expires_in, refresh_token, refresh_token_expires_in }
    const now = new Date();
    const nextUpdate = new Date(now.getTime() + (tok.expires_in - 1800) * 1000).toISOString();
    const nextRefresh = tok.refresh_token_expires_in
        ? new Date(now.getTime() + tok.refresh_token_expires_in * 1000).toISOString()
        : null;
    try {
        const { data } = await supabase.from('Peertube_System').select('id').limit(1);
        const id = data?.[0]?.id;
        if (id) {
            await supabase.from('Peertube_System').update({
                token: tok.access_token,
                refresh_token: tok.refresh_token,
                next_update: nextUpdate,
                next_refresh: nextRefresh,
            }).eq('id', id);
        }
    } catch (_) { /* write-back is best-effort; we still return a valid token */ }
    return tok.access_token;
}

/**
 * A valid PeerTube token for uploads. Cached/refresh path first (peertubeLive), password-grant heal on
 * failure. Calling this from courses_manage is what keeps the platform's refresh_token alive.
 */
export async function getUploadToken(supabase) {
    try {
        return await getPeertubeToken(supabase);
    } catch (_) {
        return await passwordGrantToken(supabase);
    }
}

/**
 * Upload a video file to PeerTube (resumable). Verbatim protocol from the WeWeb uploader.
 * opts: { token, file, channelId?, apiBaseUrl?, resumeUploadId?, resumeStart?, onInit, onChunk, onProgress, signal }
 * Returns { id, shortUUID, uuid }.
 */
export async function uploadVideo({
    token, file, channelId = CHANNEL_ID, apiBaseUrl = PEERTUBE_ORIGIN,
    resumeUploadId = null, resumeStart = 0, onInit, onChunk, onProgress, shouldCancel,
}) {
    const totalSize = file.size;
    const fileName = file.name;
    const name = fileName.split('.').slice(0, -1).join('.') || fileName;

    let uploadId = resumeUploadId || '';
    let start = resumeUploadId ? Number(resumeStart) || 0 : 0;

    if (!uploadId) {
        const initRes = await fetch(`${apiBaseUrl}/api/v1/videos/upload-resumable`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'X-Upload-Content-Length': totalSize,
                'X-Upload-Content-Type': 'video/mp4',
            },
            body: new URLSearchParams({ channelId: String(channelId), filename: fileName, name, privacy: String(PRIVACY_UNLISTED) }),
        });
        if (!initRes.ok) throw new Error('Ошибка инициализации загрузки видео');
        uploadId = (initRes.headers.get('location') || '').split('upload_id=')[1];
        if (!uploadId) throw new Error('PeerTube не вернул upload_id');
        start = 0;
        if (onInit) await onInit(uploadId);
    }

    while (start < totalSize) {
        if (shouldCancel && shouldCancel()) throw new Error('cancelled');
        const end = Math.min(start + CHUNK_SIZE - 1, totalSize - 1);
        const chunk = file.slice(start, end + 1);
        const res = await fetch(`${apiBaseUrl}/api/v1/videos/upload-resumable?upload_id=${uploadId}`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Length': chunk.size,
                'Content-Range': `bytes ${start}-${end}/${totalSize}`,
            },
            body: chunk,
        });

        if (res.status === 308) {
            const range = res.headers.get('Range');
            if (range) {
                start = parseInt(range.split('-')[1], 10) + 1;
                if (onChunk) await onChunk(start);
            }
            if (onProgress) onProgress(Math.floor((start / totalSize) * 100));
        } else if (res.ok) {
            let video = null;
            try { video = (await res.json())?.video || null; } catch (_) { /* empty body */ }
            if (!video?.uuid) {
                // finalize fallback: PeerTube sometimes returns an empty body — poll /uploaded once
                await new Promise((r) => setTimeout(r, 2000));
                const confirmRes = await fetch(`${apiBaseUrl}/api/v1/videos/uploaded?uploadId=${uploadId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const confirmJson = await confirmRes.json().catch(() => ({}));
                video = confirmJson?.data?.[0] || null;
                if (!video?.uuid) throw new Error('UUID видео не получен после загрузки');
            }
            if (onProgress) onProgress(100);
            return { id: video.id, shortUUID: video.shortUUID, uuid: video.uuid };
        } else {
            throw new Error(`Ошибка загрузки чанка (${res.status})`);
        }
    }
    throw new Error('Загрузка завершилась без подтверждения видео');
}

/** File-size (bytes) of an uploaded video, read back from PeerTube (stored as lessons/course.video_size). */
export async function fetchVideoSize(uuid, apiBaseUrl = PEERTUBE_ORIGIN) {
    try {
        const res = await fetch(`${apiBaseUrl}/api/v1/videos/${uuid}`);
        if (!res.ok) return null;
        const d = await res.json();
        return d?.files?.[0]?.size ?? d?.streamingPlaylists?.[0]?.files?.[0]?.size ?? null;
    } catch (_) { return null; }
}
