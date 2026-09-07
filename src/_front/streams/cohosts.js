// Co-host roster reads for the web broadcaster — mirror of the mobile api.ts
// listCohosts/getMyCohostRole. Direct Supabase reads via the shared client (RLS: the stream
// author sees all rows for their stream; any user sees their own membership row).

/** Roster for a stream (owner-only via RLS): active + invited members, owner first. */
export async function listCohosts(supabase, streamId) {
    const { data, error } = await supabase
        .from('stream_cohosts')
        .select('id, user, role, status, created_at')
        .eq('stream', streamId)
        .neq('status', 'removed');
    if (error) throw new Error(`Не удалось загрузить со-ведущих: ${error.message}`);
    const rows = data || [];
    const ids = [...new Set(rows.map((r) => r.user).filter(Boolean))];
    let byId = {};
    if (ids.length) {
        const { data: users } = await supabase
            .from('users')
            .select('id,Name,email,Photo')
            .in('id', ids);
        byId = Object.fromEntries((users || []).map((u) => [u.id, u]));
    }
    return rows
        .map((r) => ({
            id: r.id,
            user: r.user,
            role: r.role,
            status: r.status,
            created_at: r.created_at,
            userInfo: byId[r.user] || null,
        }))
        .sort((a, b) => {
            if (a.role !== b.role) return a.role === 'owner' ? -1 : 1;
            return a.created_at < b.created_at ? -1 : 1;
        });
}

/** The current user's own active membership for a stream, or null (drives the co-host join CTA). */
export async function getMyCohostRole(supabase, streamId, userId) {
    const { data, error } = await supabase
        .from('stream_cohosts')
        .select('role, status')
        .eq('stream', streamId)
        .eq('user', userId)
        .in('status', ['invited', 'joined'])
        .limit(1);
    if (error) throw new Error(error.message);
    return data?.[0] || null;
}
