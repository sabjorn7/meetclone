// Display/transport contract only. PostgreSQL enforces visibility and ownership independently.
export const STREAM_VIEW_FIELDS = 'id,created_at,author,title,description,peertube_video_id,price,status,scheduled_at,cover_url,backing_course_id,access_months,hidden,mode,chat,chat_enabled,recording_course,recording_course_enabled,visibility';
export function validateVisibility({ visibility = 'public', price = 0, backing_course_id = null, chat_enabled = false, recording_course_enabled = false }) {
    if (!['public', 'unlisted'].includes(visibility)) throw new Error('Выберите доступность эфира.');
    if (visibility === 'unlisted' && (Number(price) !== 0 || backing_course_id || chat_enabled || recording_course_enabled)) {
        throw new Error('Скрытый эфир может быть только бесплатным, без платной подложки и публикации записи в каталоге.');
    }
    return visibility;
}
export function isPublicStream(stream) {
    return stream.visibility === 'public' && !stream.hidden;
}
export function streamLinkKey(hash = '') {
    return /^#access-([a-f0-9]{64})$/.exec(hash)?.[1] || null;
}
export function streamShareUrl(origin, stream, key = null) {
    const url = new URL('/streams', origin);
    url.searchParams.set('stream', stream.id);
    if (stream.visibility === 'unlisted') {
        if (!/^[a-f0-9]{64}$/.test(key || '')) throw new Error('Не удалось получить ссылку скрытого эфира.');
        url.hash = `access-${key}`; // Never send the capability in HTML GETs / HTTP referrers.
    }
    return url.href;
}
export async function visibilityCapabilities(supabase) {
    const { data, error } = await supabase.rpc('stream_visibility_capabilities');
    // Public creation remains compatible with the previous schema. Unlisted always fails closed.
    return !error && data?.version === 2 ? data : { version: 0, unlisted_enabled: false };
}
export async function requireUnlistedSupport(supabase, visibility) {
    if (visibility !== 'unlisted') return;
    const capabilities = await visibilityCapabilities(supabase);
    if (capabilities.unlisted_enabled !== true) throw new Error('Скрытые эфиры пока недоступны: серверная защита ещё не включена.');
}
