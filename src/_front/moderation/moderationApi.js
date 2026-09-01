import { getSupabase } from '@/_front/chrome/headerAccount.js';

// UGC moderation (Apple Guideline 1.2 / Google Play UGC): block a user and report content.
// Mirrors the mobile app's src/features/streams/moderationApi.ts so both platforms write the same
// tables. RLS is off project-wide, so the authenticated client reads/writes directly.
//   user_blocks:    (blocker, blocked) — the blocker stops seeing the blocked user's messages.
//   stream_reports: generic report queue — surface / target_type / target_id / target_user /
//                   reason / text_snapshot / status ('new' until an admin actions it).

/** Ids of users the given user has blocked (their content is hidden for the blocker). */
export async function listBlockedUserIds(blocker) {
    if (!blocker) return [];
    const { data, error } = await getSupabase().from('user_blocks').select('blocked').eq('blocker', blocker);
    if (error) throw new Error(error.message);
    return (data || []).map((r) => r.blocked);
}

/** Block a user. Idempotent. */
export async function blockUser(blocker, blocked) {
    if (!blocker || !blocked || blocker === blocked) return;
    const { error } = await getSupabase().from('user_blocks').upsert({ blocker, blocked }, { onConflict: 'blocker,blocked' });
    if (error) throw new Error(error.message);
}

/** Undo a block. */
export async function unblockUser(blocker, blocked) {
    if (!blocker || !blocked) return;
    const { error } = await getSupabase().from('user_blocks').delete().eq('blocker', blocker).eq('blocked', blocked);
    if (error) throw new Error(error.message);
}

/** File a report on a message / comment / user. `surface` names the origin (chat, group, stream, …). */
export async function reportContent({ reporter, surface, targetType, targetId, targetUser = null, reason = null, textSnapshot = null }) {
    const { error } = await getSupabase().from('stream_reports').insert({
        reporter,
        surface,
        target_type: targetType,
        target_id: targetId,
        target_user: targetUser,
        reason,
        text_snapshot: textSnapshot,
        status: 'new',
    });
    if (error) throw new Error(error.message);
}
