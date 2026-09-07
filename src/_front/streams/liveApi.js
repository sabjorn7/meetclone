// Web client for the multi-host live orchestrator (orch.meetgu.ru) — the mirror of the mobile
// src/features/streams/liveApi.ts. Every call carries the caller's Supabase access token as a
// Bearer; the orchestrator verifies it (HS256) and enforces membership/ownership server-side.
//
// DI style like the neighbouring peertubeLive.js/streamsApi.js: pass the shared Supabase client
// (window.wwLib.wwPlugins.supabase.instance) — we read a FRESH token from it at call time
// (supabase-js auto-refreshes), so we always send a current one.
//
// Endpoint contract (orchestrator src/server.mjs):
//   POST /live/token  {stream_id}         -> { token, url, room, identity, role, expires_at }
//   POST /live/start  {stream_id}         -> { room, peertube_video_id, egress_id }   (owner only)
//   POST /live/stop   {stream_id}         -> { ok, already_stopped? }                 (owner only)
//   POST /live/invite {stream_id, email}  -> { cohost, outcome }                      (owner only)

const ORCH_URL = 'https://orch.meetgu.ru';

// The orchestrator returns { error: <code> } with a matching HTTP status. Map known codes to RU.
const ERROR_MESSAGES = {
    network: 'Нет связи с сервером. Проверьте интернет.',
    invalid_token: 'Сессия истекла. Войдите в аккаунт заново.',
    bad_stream_id: 'Некорректный эфир.',
    stream_not_found: 'Эфир не найден.',
    not_a_cohost: 'Вас нет среди со-ведущих этого эфира.',
    not_owner: 'Управлять эфиром может только его создатель.',
    already_live: 'Эфир уже идёт.',
    egress_start_failed: 'Не удалось запустить трансляцию. Попробуйте ещё раз.',
    bad_email: 'Введите корректный email.',
    user_not_found: 'Пользователь с таким email не найден.',
    rate_limited: 'Слишком много запросов. Подождите немного.',
    internal: 'Ошибка сервера. Попробуйте позже.',
};

/** Error carrying the orchestrator's machine code + HTTP status, with a localized `.message`. */
export class LiveApiError extends Error {
    constructor(code, status) {
        super(ERROR_MESSAGES[code] || `Ошибка (${code}).`);
        this.name = 'LiveApiError';
        this.code = code;
        this.status = status;
    }
}

function errorCodeFrom(body) {
    if (body && typeof body === 'object' && typeof body.error === 'string' && body.error) {
        return body.error;
    }
    return 'internal';
}

async function post(supabase, path, body) {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw new LiveApiError('invalid_token', 401);

    let res;
    try {
        res = await fetch(`${ORCH_URL}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
    } catch {
        // fetch rejects only on network failure, never on HTTP status.
        throw new LiveApiError('network', 0);
    }

    let json = null;
    try {
        json = await res.json();
    } catch {
        // some responses (or errors) may carry no JSON body
    }

    if (!res.ok) throw new LiveApiError(errorCodeFrom(json), res.status);
    return json;
}

/** Mint a publish token for an owner/cohost of `streamId` (403 if not a member). */
export function getLiveToken(supabase, streamId) {
    return post(supabase, '/live/token', { stream_id: streamId });
}

/** Owner-only: create the PeerTube live + start the composite egress. 409 if already live. */
export function startLive(supabase, streamId) {
    return post(supabase, '/live/start', { stream_id: streamId });
}

/** Owner-only: stop the egress (ends the live, keeps the replay). Idempotent. */
export function stopLive(supabase, streamId) {
    return post(supabase, '/live/stop', { stream_id: streamId });
}

/** Owner-only: invite a co-host by email (the sole server-side write into stream_cohosts). */
export function inviteCohost(supabase, streamId, email) {
    return post(supabase, '/live/invite', { stream_id: streamId, email: (email || '').trim() });
}
