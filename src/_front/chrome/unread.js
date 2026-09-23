// Global reactive "has unread messages" flag for the header badge.
//
// Rule (identical to ChatsPage.isUnread): a chat is unread when my user id is NOT in its `read[]`
// array. A new message resets chats.read = [sender] via a DB trigger (→ unread for everyone else);
// opening a chat adds me back to read[]. Kept live with a Supabase Realtime subscription on the
// `chats` table — the same channel pattern ChatsPage uses, simplified for the header (we only need
// the read state, filtered client-side to my chats).
//
// Guests do NOTHING here (initUnread bails without a user id) — the header must never touch the
// auth Web Locks for guests, so we read the id from the cookie/localStorage, never getSession().
import { ref } from 'vue';
import { getSupabase, readStoredSession, authCookieUser } from './headerAccount.js';

export const hasUnread = ref(false);

let channel = null;
let chatsMap = new Map(); // chatId -> read[] (my chats only)
let myId = null;

function recompute() {
    for (const read of chatsMap.values()) {
        if (!Array.isArray(read) || !read.includes(myId)) { hasUnread.value = true; return; }
    }
    hasUnread.value = false;
}

export async function initUnread() {
    const sb = getSupabase();
    myId = readStoredSession()?.user?.id || authCookieUser()?.id || null;
    if (!sb || !myId || channel) return; // guest, or already initialised

    // initial load: read state of my chats
    try {
        const { data } = await sb.from('chats').select('id, users, read').contains('users', [myId]);
        chatsMap = new Map((data || []).map((c) => [c.id, c.read]));
        recompute();
    } catch (e) { /* keep hasUnread false on failure */ }

    // live updates — mirror ChatsPage's cd-chats channel (server sends all `chats` changes; we filter
    // to my chats client-side). A message insert resets chats.read=[sender] → an UPDATE lands here.
    channel = sb.channel('hdr-unread')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, (p) => {
            if (p.eventType === 'DELETE') { chatsMap.delete(p.old?.id); recompute(); return; }
            const row = p.new;
            if (!row) return;
            const mine = Array.isArray(row.users) && row.users.includes(myId);
            if (mine) chatsMap.set(row.id, row.read); else chatsMap.delete(row.id);
            recompute();
        })
        .subscribe();
}

export function resetUnread() {
    try { if (channel) getSupabase()?.removeChannel(channel); } catch (e) { /* noop */ }
    channel = null;
    chatsMap = new Map();
    myId = null;
    hasUnread.value = false;
}
