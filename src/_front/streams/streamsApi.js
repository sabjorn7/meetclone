// Supabase data helpers for the "Трансляции" (live streams) feature.
// RLS is off project-wide, so the anon/authenticated client reads & writes directly.

// Roles allowed to create a broadcast (same set as the subscriptions feature).
export const STREAMER_ROLES = ['Спикер', 'Учебное заведение'];

/**
 * Resolve the current user's `users` row on a standalone (non-WeWeb) route, where the WeWeb
 * current-user collection may not be populated. We go through the Supabase auth session and
 * match the `users` row by id (users.id == auth uid for this project), falling back to email.
 */
export async function getCurrentUser(supabase) {
    const { data: sessionData } = await supabase.auth.getSession();
    const authUser = sessionData?.session?.user;
    if (!authUser) return null;

    let { data } = await supabase.from('users').select('*').eq('id', authUser.id).limit(1);
    if (!data?.length && authUser.email) {
        ({ data } = await supabase.from('users').select('*').eq('email', authUser.email).limit(1));
    }
    return data?.[0] ?? null;
}

export function canStream(user) {
    return !!user && STREAMER_ROLES.includes(user.role);
}

/** Insert a stream metadata row. `peertube_video_id` = the live video uuid. price 0 = free. */
export async function createStream(supabase, { author, title, description = '', price = 0, peertube_video_id }) {
    const { data, error } = await supabase
        .from('streams')
        .insert({ author, title, description, price, peertube_video_id })
        .select()
        .limit(1);
    if (error) throw new Error(`Не удалось сохранить эфир: ${error.message}`);
    return data?.[0];
}

/** All streams by a given author, newest first (for the author's own list). */
export async function listMyStreams(supabase, authorId) {
    const { data, error } = await supabase
        .from('streams')
        .select('*')
        .eq('author', authorId)
        .order('created_at', { ascending: false });
    if (error) throw new Error(`Не удалось загрузить эфиры: ${error.message}`);
    return data ?? [];
}

/** Flip a stream's cached status (used by the author's "я в эфире" / "завершить" actions). */
export async function setStreamStatus(supabase, streamId, status) {
    const { error } = await supabase.from('streams').update({ status }).eq('id', streamId);
    if (error) throw new Error(`Не удалось обновить статус: ${error.message}`);
}

// Public list ordering: live first, then scheduled, then ended; newest first within a group.
const STATUS_ORDER = { live: 0, scheduled: 1, ended: 2 };

/** Attach each stream's author user row (Name/Photo/role) via one batched lookup. */
async function attachAuthors(supabase, rows) {
    const ids = [...new Set(rows.map(r => r.author).filter(Boolean))];
    let byId = {};
    if (ids.length) {
        const { data: users } = await supabase.from('users').select('*').in('id', ids);
        byId = Object.fromEntries((users || []).map(u => [u.id, u]));
    }
    return rows.map(r => ({ ...r, authorUser: byId[r.author] || null }));
}

/** All streams for the public list, with authors, ordered live → scheduled → ended. */
export async function listAllStreams(supabase) {
    const { data, error } = await supabase.from('streams').select('*');
    if (error) throw new Error(`Не удалось загрузить эфиры: ${error.message}`);
    const rows = await attachAuthors(supabase, data || []);
    return rows.sort(
        (a, b) =>
            (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) ||
            new Date(b.created_at) - new Date(a.created_at)
    );
}

/** A single stream (with author) for the detail view. */
export async function getStreamById(supabase, id) {
    const { data, error } = await supabase.from('streams').select('*').eq('id', id).limit(1);
    if (error) throw new Error(`Не удалось загрузить эфир: ${error.message}`);
    if (!data?.length) return null;
    const [row] = await attachAuthors(supabase, data);
    return row;
}
