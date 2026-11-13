// Shared HTTP read only; authorization remains in the existing Supabase client/RLS.
export async function fetchStreamChatRows(supabase, streamId, { history = false, limit = 200 } = {}) {
    const rows = [];
    let cursor = null;
    do {
        let query = supabase.from('stream_chat').select('*')
            .eq('stream', streamId).neq('deleted', true)
            .order('created_at', { ascending: false }).order('id', { ascending: false });
        if (cursor) {
            // Keep the original timestamp string: Date would discard PostgreSQL microseconds.
            query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
        }
        const { data, error } = await query.limit(limit);
        if (error) throw new Error(`Не удалось загрузить чат: ${error.message}`);
        const page = data || [];
        rows.push(...page);
        if (!history || !page.length) break;
        cursor = page[page.length - 1];
        // Continue until empty, including when the server caps a page below the requested size.
    } while (history);
    return rows.reverse();
}

export function countNewChatMessages(previous, next) {
    const ids = new Set(previous.map(message => message.id));
    return next.reduce((count, message) => count + (ids.has(message.id) ? 0 : 1), 0);
}
