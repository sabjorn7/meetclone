// PeerTube Live integration for the "Трансляции" feature.
//
// Auth model mirrors the existing video uploader (Variant C, approved): the whole platform
// uploads/creates-lives through ONE shared PeerTube "system" account. Its token is cached in
// the Supabase table `Peertube_System` (single row: token / refresh_token / next_update /
// next_refresh). We reuse the cached `token` while it is still valid (now < next_update) and
// only refresh via `grant_type=refresh_token` when it has expired, writing the rotated token
// back — exactly like the uploader, so the two paths don't fight. We deliberately do NOT
// include the account's password-grant fallback here (keeps the plaintext account password out
// of this bundle); the rare case where the refresh token itself expired is healed by opening
// the video-upload page (courses_manage) once.
//
// SECURITY: client_id/client_secret below are already publicly exposed in the deployed page
// data (see SECURITY_FINDINGS.md, SF-1) — this file adds no new exposure. The real fix is to
// move the token exchange server-side; tracked as SF-1.

const PEERTUBE = 'https://video.meetgu.ru';
const CLIENT_ID = 'rf2ju4r862ak1j05xl4sfrybsnjkh9xp';
const CLIENT_SECRET = 'GTU741v51FpMM6aOawM6E4XOc891UNYx';
const CHANNEL_ID = 5; // the system account's channel (same as the uploader default)

// PeerTube video privacy: 1 public, 2 unlisted, 3 private. We keep the site's "unlisted +
// UI-gated" model (same as course/lesson videos).
const PRIVACY_UNLISTED = 2;
// Live latency mode: 1 default, 2 high-latency, 3 small-latency.
const LATENCY_DEFAULT = 1;

/** Read the single Peertube_System row. */
async function readSystemRow(supabase) {
    const { data, error } = await supabase.from('Peertube_System').select('*').limit(1);
    if (error) throw new Error(`Не удалось прочитать Peertube_System: ${error.message}`);
    const row = data?.[0];
    if (!row) throw new Error('В Peertube_System нет строки с токеном.');
    return row;
}

/**
 * Get a valid PeerTube access token for the system account.
 * Uses the cached token while valid; refreshes (refresh_token grant) and persists otherwise.
 */
export async function getPeertubeToken(supabase) {
    const row = await readSystemRow(supabase);
    const now = new Date();

    if (row.token && row.next_update && now < new Date(row.next_update)) {
        return row.token; // cached and still valid — no refresh, no rotation race
    }

    if (!row.refresh_token) {
        throw new Error(
            'Нет refresh_token в Peertube_System. Откройте один раз страницу загрузки видео (администрирование курсов), чтобы обновить токен PeerTube.'
        );
    }

    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: row.refresh_token,
    });

    const res = await fetch(`${PEERTUBE}/api/v1/users/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });

    if (!res.ok) {
        throw new Error(
            `Не удалось обновить токен PeerTube (${res.status}). Возможно, истёк refresh_token — откройте один раз страницу загрузки видео, чтобы восстановить его.`
        );
    }

    const tok = await res.json(); // { access_token, expires_in, refresh_token, refresh_token_expires_in }
    const nextUpdate = new Date(now.getTime() + (tok.expires_in - 1800) * 1000).toISOString();
    const nextRefresh = tok.refresh_token_expires_in
        ? new Date(now.getTime() + tok.refresh_token_expires_in * 1000).toISOString()
        : row.next_refresh;

    const { error: upErr } = await supabase
        .from('Peertube_System')
        .update({
            token: tok.access_token,
            refresh_token: tok.refresh_token,
            next_update: nextUpdate,
            next_refresh: nextRefresh,
        })
        .eq('id', row.id);
    // A failed write-back isn't fatal for THIS call (we still have a valid token); just warn.
    if (upErr) console.warn('[streams] Peertube_System write-back failed:', upErr.message);

    return tok.access_token;
}

/** Delete a live video from PeerTube (author deleting their own stream). Needs the system token. */
export async function deleteLive(supabase, videoId) {
    if (!videoId) return;
    const token = await getPeertubeToken(supabase);
    const res = await fetch(`${PEERTUBE}/api/v1/videos/${encodeURIComponent(videoId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 404) throw new Error(`Не удалось удалить видео в PeerTube (${res.status}).`);
}

/** Fetch RTMP url + stream key for a live video (author-only info; needs the system token). */
export async function getLiveCredentials(supabase, videoId) {
    const token = await getPeertubeToken(supabase);
    const res = await fetch(`${PEERTUBE}/api/v1/videos/live/${encodeURIComponent(videoId)}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Не удалось получить данные эфира из PeerTube (${res.status}).`);
    const j = await res.json();
    return { rtmpUrl: j.rtmpUrl, rtmpsUrl: j.rtmpsUrl, streamKey: j.streamKey };
}

/**
 * Create a live video on PeerTube under the system account.
 * Returns { video: { id, uuid, shortUUID }, rtmpUrl, rtmpsUrl, streamKey }.
 */
export async function createLive(supabase, { name, description = '', saveReplay = true }) {
    const token = await getPeertubeToken(supabase);

    const payload = {
        channelId: CHANNEL_ID,
        name,
        privacy: PRIVACY_UNLISTED,
        saveReplay,
        permanentLive: false,
        latencyMode: LATENCY_DEFAULT,
    };
    if (description) payload.description = description;
    // saveReplay requires replaySettings in PeerTube 6+/7; keep the replay unlisted too.
    if (saveReplay) payload.replaySettings = { privacy: PRIVACY_UNLISTED };

    const res = await fetch(`${PEERTUBE}/api/v1/videos/live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Не удалось создать эфир в PeerTube (${res.status}): ${detail.slice(0, 300)}`);
    }

    const json = await res.json();
    const video = json.video; // { id, uuid, shortUUID }
    const creds = await getLiveCredentials(supabase, video.id);
    return { video, ...creds };
}

// Video-state ids from PeerTube (for the viewer/status):
//   1 = published (live is on-air, or replay is ready), 4 = waiting for live, 5 = live ended.
export const VIDEO_STATE = { PUBLISHED: 1, WAITING_FOR_LIVE: 4, LIVE_ENDED: 5 };
export const PEERTUBE_ORIGIN = PEERTUBE;

/**
 * Public video info (no auth — unlisted videos return 200): live state, thumbnail, whether a
 * streaming playlist exists (i.e. the live is actually on-air or a replay is ready).
 * Returns null on any failure so callers can fall back to the cached `streams.status`.
 */
export async function getVideoInfo(videoId) {
    if (!videoId) return null;
    try {
        const res = await fetch(`${PEERTUBE}/api/v1/videos/${encodeURIComponent(videoId)}`);
        if (!res.ok) return null;
        const v = await res.json();
        return {
            stateId: v.state?.id ?? null,
            isLive: !!v.isLive,
            previewPath: v.previewPath || null,
            thumbnailPath: v.thumbnailPath || null,
            hasPlaylist: Array.isArray(v.streamingPlaylists) && v.streamingPlaylists.length > 0,
            name: v.name,
        };
    } catch (_) {
        return null;
    }
}

/** PeerTube iframe embed URL (same params as the site's course-video embeds). */
export function embedUrl(videoId, { autoplay = false } = {}) {
    const q = `title=0&warningTitle=0&peertubeLink=0&p2p=0${autoplay ? '&autoplay=1' : ''}`;
    return `${PEERTUBE}/videos/embed/${encodeURIComponent(videoId)}?${q}`;
}

/** Prefix a PeerTube-relative asset path (previewPath/thumbnailPath) with the instance origin. */
export function assetUrl(path) {
    return path ? `${PEERTUBE}${path}` : null;
}
