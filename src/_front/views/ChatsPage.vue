<!--
  ChatsPage.vue — "/chats" (STAGE 1: 1-on-1 only) in the MeetGuru promo (pd-*) brand language. Demo at
  /chats-demo; the live WeWeb /chats is untouched. Groups are stage 2.

  Faithful to the WeWeb 1-on-1 model:
    - chats: user_1 / user_2 (uuid → users), read[] (who has read the latest state), sort_date/mod_date.
    - messages: creator (sender), text, chat (fk), created_at.
    - list = chats where I'm user_1 OR user_2 (non-group), ordered by sort_date DESC.
    - open user X: find (user_1,user_2)=(me,X)|(X,me), else insert {user_1:me, user_2:X, read:[me,X]}.
    - send: insert messages {chat, text, creator:me} + update chats {sort_date/mod_date now, read:[me]}
      (dropping the other from read → unread for them). Opening a chat adds me back to read.
    - realtime (chats + messages are realtime-enabled): a per-active-chat messages channel streams new
      messages into the thread; a chats channel reorders the list + updates unread.
-->
<template>
    <main class="pd" :class="{ 'is-ready': ready }">
        <header class="pd-hero">
            <div class="pd-wrap">
                <h1 class="pd-hero__title" data-reveal>Чаты</h1>
                <p class="pd-hero__sub" data-reveal>Личные сообщения с преподавателями и участниками сообщества.</p>
            </div>
        </header>

        <section class="pd-section">
            <div class="pd-wrap">
                <div class="pd-chat" data-reveal>
                    <!-- ── LEFT: search + my chats ─────────────────── -->
                    <aside class="pd-chat__side">
                        <label class="pd-search">
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
                            <input v-model="searchQ" type="search" placeholder="Найти пользователя" aria-label="Найти пользователя" @input="onSearch" />
                        </label>

                        <div class="pd-chat__list">
                            <!-- search results (start a new chat) -->
                            <template v-if="searchQ.trim()">
                                <p class="pd-chat__hint">{{ searching ? 'Поиск…' : (searchResults.length ? 'Начать чат:' : 'Никого не найдено') }}</p>
                                <button v-for="u in searchResults" :key="u.id" class="pd-chatrow" type="button" @click="openChat(u.id)">
                                    <img v-if="u.Photo" class="pd-chatrow__ava" :src="u.Photo" :alt="u.Name" />
                                    <span v-else class="pd-chatrow__ava pd-chatrow__ava--i">{{ initials(u.Name) }}</span>
                                    <span class="pd-chatrow__body"><b>{{ u.Name || 'Пользователь' }}</b></span>
                                </button>
                            </template>

                            <!-- my chats -->
                            <template v-else>
                                <p v-if="!myChats.length && !loading" class="pd-chat__hint">Пока нет диалогов. Найдите пользователя выше, чтобы написать.</p>
                                <button
                                    v-for="c in myChats" :key="c.id"
                                    class="pd-chatrow" :class="{ 'is-on': activeChat && activeChat.id === c.id, 'is-unread': isUnread(c) }"
                                    type="button" @click="openChatRow(c)"
                                >
                                    <img v-if="other(c)?.Photo" class="pd-chatrow__ava" :src="other(c).Photo" :alt="other(c).Name" />
                                    <span v-else class="pd-chatrow__ava pd-chatrow__ava--i">{{ initials(other(c)?.Name) }}</span>
                                    <span class="pd-chatrow__body">
                                        <b>{{ other(c)?.Name || 'Пользователь' }}</b>
                                        <span v-if="c.preview" class="pd-chatrow__last">{{ c.preview }}</span>
                                    </span>
                                    <span v-if="isUnread(c)" class="pd-chatrow__dot" aria-label="Непрочитано"></span>
                                </button>
                            </template>
                        </div>
                    </aside>

                    <!-- ── RIGHT: active thread ────────────────────── -->
                    <div class="pd-chat__main">
                        <template v-if="activeChat">
                            <div class="pd-thread__head">
                                <img v-if="other(activeChat)?.Photo" class="pd-thread__ava" :src="other(activeChat).Photo" :alt="other(activeChat).Name" />
                                <span v-else class="pd-thread__ava pd-thread__ava--i">{{ initials(other(activeChat)?.Name) }}</span>
                                <b>{{ other(activeChat)?.Name || 'Пользователь' }}</b>
                            </div>
                            <div ref="threadEl" class="pd-thread__body">
                                <p v-if="!messages.length" class="pd-thread__empty">Нет сообщений. Напишите первым!</p>
                                <div v-for="m in messages" :key="m.id" class="pd-msg" :class="{ 'is-mine': m.creator === myId }">
                                    <div class="pd-msg__bubble">
                                        <span class="pd-msg__text">{{ m.text }}</span>
                                        <span class="pd-msg__time">{{ fmtTime(m.created_at) }}</span>
                                    </div>
                                </div>
                            </div>
                            <form class="pd-thread__input" @submit.prevent="send">
                                <input v-model="text" type="text" placeholder="Написать сообщение…" aria-label="Сообщение" :disabled="sending" />
                                <button class="pd-send" type="submit" :disabled="sending || !text.trim()" aria-label="Отправить">
                                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-3-6-7-2z"/></svg>
                                </button>
                            </form>
                        </template>

                        <div v-else class="pd-thread__none">
                            <img src="/images/minime-06.png" alt="" aria-hidden="true" />
                            <p>Выберите диалог или найдите пользователя, чтобы написать сообщение.</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </main>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { getSupabase, readStoredSession } from '@/_front/chrome/headerAccount.js';

const route = useRoute();
const myId = ref(null);
const myChats = ref([]);       // [{ id, user_1, user_2, read, sort_date, preview }]
const usersById = ref({});     // uuid -> { id, Name, Photo }
const activeChat = ref(null);
const messages = ref([]);
const text = ref('');
const sending = ref(false);
const searchQ = ref('');
const searchResults = ref([]);
const searching = ref(false);
const loading = ref(true);
const ready = ref(false);
const threadEl = ref(null);

let sb = null;
let msgChannel = null;   // per-active-chat messages stream
let chatsChannel = null; // list reorder + unread
let searchTimer = null;

function initials(name) {
    const p = (name || '').split(/\s+/).filter(Boolean);
    return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '·';
}
function fmtTime(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
function otherId(chat) { return chat?.user_1 === myId.value ? chat?.user_2 : chat?.user_1; }
function other(chat) { return usersById.value[otherId(chat)] || null; }
function isUnread(chat) { return !!chat && Array.isArray(chat.read) && !chat.read.includes(myId.value); }

async function load() {
    sb = getSupabase();
    myId.value = readStoredSession()?.user?.id || null;
    if (!sb || !myId.value) { loading.value = false; return; }

    const { data: chats } = await sb.from('chats')
        .select('id, user_1, user_2, read, sort_date, is_group')
        .or(`user_1.eq.${myId.value},user_2.eq.${myId.value}`)
        .order('sort_date', { ascending: false, nullsFirst: false });
    myChats.value = (chats || []).filter((c) => c.is_group !== true);

    // resolve the other participant of each chat (names/photos), chunked
    await ensureUsers(myChats.value.map((c) => otherId(c)));

    subscribeChats();
    loading.value = false;

    if (route.query.user) await openChat(route.query.user); // deep-link /chats-demo?user=<id>
    await nextTick();
    ready.value = true;
}

async function ensureUsers(ids) {
    const need = [...new Set(ids.filter((id) => id && !usersById.value[id]))];
    if (!need.length) return;
    const next = { ...usersById.value };
    // chunk the .in() — a single request with 100+ uuids overflows the request URL and fails silently
    for (let i = 0; i < need.length; i += 40) {
        const { data } = await sb.from('users').select('id, "Name", "Photo"').in('id', need.slice(i, i + 40));
        for (const u of data || []) next[u.id] = u;
    }
    usersById.value = next;
}

function onSearch() {
    clearTimeout(searchTimer);
    const q = searchQ.value.trim();
    if (!q) { searchResults.value = []; return; }
    searching.value = true;
    searchTimer = setTimeout(async () => {
        const { data } = await sb.from('users').select('id, "Name", "Photo"').ilike('Name', `%${q}%`).neq('id', myId.value).limit(20);
        searchResults.value = data || [];
        searching.value = false;
    }, 280);
}

function openChatRow(c) { activeChat.value = c; afterOpen(c); }

// open (or create) the 1-on-1 chat with user X
async function openChat(xId) {
    if (!xId || xId === myId.value) return;
    searchQ.value = ''; searchResults.value = [];
    await ensureUsers([xId]);
    // existing chat?
    let chat = myChats.value.find((c) => otherId(c) === xId);
    if (!chat) {
        const { data: found } = await sb.from('chats')
            .select('id, user_1, user_2, read, sort_date, is_group')
            .or(`and(user_1.eq.${myId.value},user_2.eq.${xId}),and(user_1.eq.${xId},user_2.eq.${myId.value})`)
            .limit(1);
        chat = found?.[0];
        if (!chat) {
            const now = new Date().toISOString();
            // is_group is a GENERATED column — must NOT be set on insert (it's derived server-side).
            const { data: created } = await sb.from('chats')
                .insert({ user_1: myId.value, user_2: xId, read: [myId.value, xId], mod_date: now, sort_date: now })
                .select('id, user_1, user_2, read, sort_date, is_group').limit(1);
            chat = created?.[0];
        }
        if (chat) { chat = { ...chat, preview: '' }; myChats.value = [chat, ...myChats.value.filter((c) => c.id !== chat.id)]; }
    }
    if (!chat) return;
    activeChat.value = chat;
    afterOpen(chat);
}

async function afterOpen(chat) {
    await loadMessages(chat.id);
    subscribeMessages(chat.id);
    markRead(chat);
}

async function loadMessages(chatId) {
    const { data } = await sb.from('messages').select('id, chat, text, creator, created_at').eq('chat', chatId).order('created_at', { ascending: true });
    messages.value = data || [];
    scrollBottom();
}

// mark the active chat read by me (add me to read[])
async function markRead(chat) {
    if (!chat || isUnread(chat) === false) return;
    const read = [...new Set([...(chat.read || []), myId.value])];
    patchChat(chat.id, { read });
    await sb.from('chats').update({ read }).eq('id', chat.id);
}

async function send() {
    const t = text.value.trim();
    if (!t || !activeChat.value || sending.value) return;
    sending.value = true;
    text.value = '';
    try {
        const { data } = await sb.from('messages')
            .insert({ chat: activeChat.value.id, text: t, creator: myId.value })
            .select('id, chat, text, creator, created_at').limit(1);
        const row = data?.[0];
        if (row && !messages.value.some((m) => m.id === row.id)) { messages.value.push(row); scrollBottom(); }
        // bump chat activity + mark unread for the other party (read = [me])
        const now = new Date().toISOString();
        await sb.from('chats').update({ sort_date: now, mod_date: now, read: [myId.value] }).eq('id', activeChat.value.id);
        patchChat(activeChat.value.id, { sort_date: now, read: [myId.value], preview: t });
        reorderChats();
    } catch (e) { text.value = t; /* restore on failure */ } finally { sending.value = false; }
}

/* ── realtime ───────────────────────────────────────────────────────────── */
function subscribeMessages(chatId) {
    if (msgChannel) { try { sb.removeChannel(msgChannel); } catch (e) { /* noop */ } }
    msgChannel = sb.channel('cd-msgs-' + chatId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat=eq.${chatId}` }, (payload) => {
            const m = payload.new;
            if (!messages.value.some((x) => x.id === m.id)) { messages.value.push(m); scrollBottom(); }
            // if it's the other party's message and this chat is open, mark read
            if (m.creator !== myId.value) markRead(activeChat.value);
        })
        .subscribe();
}
function subscribeChats() {
    chatsChannel = sb.channel('cd-chats')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, (payload) => {
            const c = payload.new || payload.old;
            if (!c || (c.user_1 !== myId.value && c.user_2 !== myId.value) || c.is_group === true) return;
            if (payload.eventType === 'DELETE') { myChats.value = myChats.value.filter((x) => x.id !== c.id); return; }
            const row = payload.new;
            const existing = myChats.value.find((x) => x.id === row.id);
            if (existing) { patchChat(row.id, { read: row.read, sort_date: row.sort_date }); }
            else { ensureUsers([otherId(row)]).then(() => { myChats.value = [{ ...row, preview: '' }, ...myChats.value]; }); }
            reorderChats();
        })
        .subscribe();
}
function patchChat(id, patch) {
    myChats.value = myChats.value.map((c) => (c.id === id ? { ...c, ...patch } : c));
    if (activeChat.value?.id === id) activeChat.value = { ...activeChat.value, ...patch };
}
function reorderChats() {
    myChats.value = [...myChats.value].sort((a, b) => new Date(b.sort_date || 0) - new Date(a.sort_date || 0));
}
function scrollBottom() { nextTick(() => { const el = threadEl.value; if (el) el.scrollTop = el.scrollHeight; }); }

onMounted(() => { ensureFonts(); load(); });
onBeforeUnmount(() => {
    try { if (msgChannel) sb.removeChannel(msgChannel); } catch (e) { /* noop */ }
    try { if (chatsChannel) sb.removeChannel(chatsChannel); } catch (e) { /* noop */ }
});

function ensureFonts() {
    if (document.getElementById('pd-fonts')) return;
    const l = document.createElement('link');
    l.id = 'pd-fonts';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
</script>

<style scoped>
.pd {
    --bg: #ffffff; --bg-tint: #f1f6fd; --surface: #ffffff;
    --ink: #091747; --ink-2: #5b6472; --ink-3: #98a0ad; --line: #e4e9f1;
    --blue: #2e70dd; --blue-soft: #5495f3; --blue-strong: #2360c6; --blue-ink: #1f5fc9; --blue-tint: #eaf1fe;
    --orange: #f09157; --orange-ink: #c2410c;
    --r-lg: 26px; --r-md: 16px; --r-pill: 999px;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --shadow: 0 14px 40px -20px rgba(9, 23, 71, 0.24); --shadow-sm: 0 4px 16px -8px rgba(9, 23, 71, 0.18);
    --wrap: 1200px;
    background: var(--bg); color: var(--ink);
    font-family: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 17px; line-height: 1.55; -webkit-font-smoothing: antialiased; overflow-x: hidden;
}
.pd *, .pd *::before, .pd *::after { box-sizing: border-box; }
.pd-wrap { width: 100%; max-width: var(--wrap); margin-inline: auto; padding-inline: 40px; }
.pd-section { padding: 8px 0 72px; }
.pd-ic { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
[data-reveal] { opacity: 0; transform: translateY(20px); transition: opacity 0.6s var(--ease-out), transform 0.6s var(--ease-out); }
.pd.is-ready [data-reveal] { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { [data-reveal] { opacity: 1; transform: none; transition: none; } }

.pd-hero { padding: 48px 0 24px; }
.pd-hero__title { margin: 0; font-weight: 800; font-size: clamp(2rem, 4.6vw, 3rem); line-height: 1.04; letter-spacing: -0.03em; }
.pd-hero__sub { margin: 14px 0 0; color: var(--ink-2); font-size: 1.08rem; }

/* ── Chat shell ─────────────────────────────────────────────────────────── */
.pd-chat { display: grid; grid-template-columns: 340px 1fr; gap: 20px; height: 640px; }
.pd-chat__side { display: flex; flex-direction: column; gap: 14px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 16px; overflow: hidden; }
.pd-search { display: flex; align-items: center; gap: 10px; background: var(--bg-tint); border: 1px solid transparent; border-radius: var(--r-pill); padding: 0 16px; height: 46px; flex: none; }
.pd-search:focus-within { border-color: var(--blue-soft); background: var(--surface); }
.pd-search .pd-ic { width: 18px; height: 18px; color: var(--ink-3); flex: none; }
.pd-search input { flex: 1; border: none; outline: none; background: transparent; font-family: inherit; font-size: 15px; color: var(--ink); min-width: 0; }
.pd-chat__list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; margin: 0 -6px; padding: 0 6px; }
.pd-chat__hint { margin: 6px 8px; color: var(--ink-3); font-size: 0.86rem; }

.pd-chatrow { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; background: transparent; border: none; border-radius: var(--r-md); padding: 10px 12px; cursor: pointer; font-family: inherit; color: inherit; transition: background 0.14s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .pd-chatrow:hover { background: var(--bg-tint); } }
.pd-chatrow.is-on { background: var(--blue-tint); }
.pd-chatrow__ava { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; flex: none; }
.pd-chatrow__ava--i { display: grid; place-items: center; background: var(--blue-tint); color: var(--blue-ink); font-weight: 700; font-size: 0.9rem; }
.pd-chatrow__body { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
.pd-chatrow__body b { font-weight: 600; font-size: 0.98rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pd-chatrow__last { color: var(--ink-3); font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pd-chatrow.is-unread .pd-chatrow__body b { font-weight: 700; }
.pd-chatrow__dot { width: 9px; height: 9px; border-radius: 50%; background: var(--blue); flex: none; margin-left: auto; }

/* ── Thread ─────────────────────────────────────────────────────────────── */
.pd-chat__main { display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); overflow: hidden; }
.pd-thread__head { display: flex; align-items: center; gap: 12px; padding: 16px 22px; border-bottom: 1px solid var(--line); font-weight: 700; font-size: 1.05rem; flex: none; }
.pd-thread__ava { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex: none; }
.pd-thread__ava--i { display: grid; place-items: center; background: var(--blue-tint); color: var(--blue-ink); font-weight: 700; font-size: 0.85rem; }
.pd-thread__body { flex: 1; overflow-y: auto; padding: 22px; display: flex; flex-direction: column; gap: 10px; background: var(--bg-tint); }
.pd-thread__empty { margin: auto; color: var(--ink-3); }
.pd-msg { display: flex; }
.pd-msg.is-mine { justify-content: flex-end; }
.pd-msg__bubble { max-width: 74%; background: var(--surface); border: 1px solid var(--line); border-radius: 16px 16px 16px 5px; padding: 10px 14px 7px; box-shadow: var(--shadow-sm); }
.pd-msg.is-mine .pd-msg__bubble { background: var(--blue); border-color: var(--blue); color: #fff; border-radius: 16px 16px 5px 16px; }
.pd-msg__text { display: block; font-size: 0.98rem; line-height: 1.4; white-space: pre-wrap; word-break: break-word; }
.pd-msg__time { display: block; margin-top: 3px; text-align: right; font-size: 0.72rem; color: var(--ink-3); }
.pd-msg.is-mine .pd-msg__time { color: rgba(255, 255, 255, 0.75); }

.pd-thread__input { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-top: 1px solid var(--line); flex: none; }
.pd-thread__input input { flex: 1; border: 1px solid var(--line); outline: none; background: var(--bg-tint); border-radius: var(--r-pill); padding: 12px 18px; font-family: inherit; font-size: 15px; color: var(--ink); min-width: 0; }
.pd-thread__input input:focus { border-color: var(--blue-soft); background: var(--surface); }
.pd-send { width: 46px; height: 46px; flex: none; border: none; border-radius: 50%; background: var(--blue); color: #fff; display: grid; place-items: center; cursor: pointer; transition: background 0.16s var(--ease-out), transform 0.16s var(--ease-out); }
.pd-send svg { width: 22px; height: 22px; fill: currentColor; }
.pd-send:disabled { opacity: 0.5; cursor: default; }
@media (hover: hover) and (pointer: fine) { .pd-send:not(:disabled):hover { background: var(--blue-strong); transform: translateY(-1px); } }

.pd-thread__none { margin: auto; text-align: center; color: var(--ink-2); padding: 40px; }
.pd-thread__none img { width: 110px; height: auto; margin: 0 auto 16px; display: block; }

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 860px) {
    .pd-wrap { padding-inline: 22px; }
    .pd-chat { grid-template-columns: 1fr; height: auto; }
    .pd-chat__side { max-height: 320px; }
    .pd-chat__main { min-height: 480px; }
}
</style>
