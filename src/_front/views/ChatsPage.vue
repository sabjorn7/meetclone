<!--
  ChatsPage.vue — "/chats" in the MeetGuru promo (pd-*) brand language. Demo at /chats-demo; the live
  WeWeb /chats is untouched.

  STAGE 1 — 1-on-1 (shipped & verified): chats.user_1/user_2, read[], sort_date; messages.creator/text/chat.
  STAGE 2 — groups (this file): a chat is a GROUP when chats.users[] has >2 members (is_group is a GENERATED
  column = array_length(users,1) > 2). Membership is the chats.users uuid[] array — the single source of
  truth (chat_participants is a VIEW over it, read-only). Group ops mutate only chats.users / chats.title.

  Faithful to the WeWeb model + LIVE DB triggers:
    - list = chats where users[] contains me, ordered by sort_date DESC (covers 1-on-1 AND groups).
    - open user X (1-on-1): find (user_1,user_2)=(me,X)|(X,me), else insert {user_1:me, user_2:X, users:[me,X], read:[me,X]}.
    - create group: insert {users:[...members, me], read:[...members, me], title, creator:me}. is_group derives.
    - send: insert messages {chat, text, creator:me}. LIVE triggers then set chats.read=[me] (→ unread for
      everyone else, N-member-correct) and chats.sort_date=now; we also patch locally for snappy UI.
    - rename / add / remove / leave / delete: update or delete the chats row; triggers cascade messages +
      users.chats[]. Rename & delete are creator-only; anyone can leave.
    - realtime: a per-active-chat messages channel; a chats channel that reflects reorder, unread, rename,
      being added to / removed from a group, and deletion.
-->
<template>
    <main class="pd" :class="{ 'is-ready': ready }">
        <header class="pd-hero">
            <div class="pd-wrap">
                <h1 class="pd-hero__title" data-reveal>Чаты</h1>
                <p class="pd-hero__sub" data-reveal>Личные сообщения и группы с преподавателями и участниками сообщества.</p>
            </div>
        </header>

        <section class="pd-section">
            <div class="pd-wrap">
                <div class="pd-chat" data-reveal>
                    <!-- ── LEFT: search + new group + my chats ─────────── -->
                    <aside class="pd-chat__side">
                        <label class="pd-search">
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
                            <input v-model="searchQ" type="search" placeholder="Найти пользователя" aria-label="Найти пользователя" @input="onSearch" />
                        </label>

                        <button class="pd-newgroup" type="button" @click="openCreate">
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>
                            Новая группа
                        </button>

                        <div class="pd-chat__list">
                            <!-- search results (start a new 1-on-1) -->
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
                                <p v-if="!myChats.length && !loading" class="pd-chat__hint">Пока нет диалогов. Найдите пользователя выше или создайте группу.</p>
                                <button
                                    v-for="c in myChats" :key="c.id"
                                    class="pd-chatrow" :class="{ 'is-on': activeChat && activeChat.id === c.id, 'is-unread': isUnread(c) }"
                                    type="button" @click="openChatRow(c)"
                                >
                                    <template v-if="isGroup(c)">
                                        <span class="pd-chatrow__ava pd-chatrow__ava--grp"><svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-3-3.87M9 21v-2a4 4 0 0 1 3-3.87"/><circle cx="12" cy="7" r="3"/><circle cx="5" cy="9" r="2.2"/><circle cx="19" cy="9" r="2.2"/></svg></span>
                                    </template>
                                    <template v-else>
                                        <img v-if="other(c)?.Photo" class="pd-chatrow__ava" :src="other(c).Photo" :alt="other(c).Name" />
                                        <span v-else class="pd-chatrow__ava pd-chatrow__ava--i">{{ initials(other(c)?.Name) }}</span>
                                    </template>
                                    <span class="pd-chatrow__body">
                                        <b>{{ chatTitle(c) }}</b>
                                        <span v-if="isGroup(c)" class="pd-chatrow__last">{{ (c.users || []).length }} участников</span>
                                        <span v-else-if="c.preview" class="pd-chatrow__last">{{ c.preview }}</span>
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
                                <template v-if="isGroup(activeChat)">
                                    <span class="pd-thread__ava pd-thread__ava--grp"><svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-3-3.87M9 21v-2a4 4 0 0 1 3-3.87"/><circle cx="12" cy="7" r="3"/><circle cx="5" cy="9" r="2.2"/><circle cx="19" cy="9" r="2.2"/></svg></span>
                                    <div class="pd-thread__titles">
                                        <b>{{ chatTitle(activeChat) }}</b>
                                        <span class="pd-thread__meta">{{ (activeChat.users || []).length }} участников</span>
                                    </div>
                                    <button class="pd-thread__manage" type="button" @click="mgmtOpen = !mgmtOpen" :aria-expanded="mgmtOpen">
                                        {{ mgmtOpen ? 'Скрыть' : 'Участники' }}
                                    </button>
                                </template>
                                <template v-else>
                                    <img v-if="other(activeChat)?.Photo" class="pd-thread__ava" :src="other(activeChat).Photo" :alt="other(activeChat).Name" />
                                    <span v-else class="pd-thread__ava pd-thread__ava--i">{{ initials(other(activeChat)?.Name) }}</span>
                                    <b>{{ chatTitle(activeChat) }}</b>
                                    <span v-if="confirmAction === 'delete'" class="pd-confirm pd-confirm--head">
                                        Удалить диалог?
                                        <button class="pd-btn pd-btn--sm pd-btn--danger" type="button" @click="deleteActiveChat">Да</button>
                                        <button class="pd-btn pd-btn--sm pd-btn--ghost" type="button" @click="confirmAction = null">Нет</button>
                                    </span>
                                    <button v-else class="pd-thread__del" type="button" aria-label="Удалить диалог" @click="confirmAction = 'delete'">
                                        <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7"/><path d="M10 11v6M14 11v6"/></svg>
                                    </button>
                                </template>
                            </div>

                            <!-- group management panel -->
                            <div v-if="isGroup(activeChat) && mgmtOpen" class="pd-group">
                                <div v-if="renaming" class="pd-group__rename">
                                    <input v-model="renameVal" type="text" placeholder="Название группы" aria-label="Название группы" maxlength="80" />
                                    <button class="pd-btn pd-btn--sm" type="button" :disabled="!renameVal.trim()" @click="saveRename">Сохранить</button>
                                    <button class="pd-btn pd-btn--sm pd-btn--ghost" type="button" @click="renaming = false">Отмена</button>
                                </div>
                                <div v-else-if="isCreator(activeChat)" class="pd-group__row">
                                    <button class="pd-linkbtn" type="button" @click="startRename">Переименовать группу</button>
                                </div>

                                <div class="pd-group__members">
                                    <span v-for="m in members(activeChat)" :key="m.id" class="pd-chip">
                                        <img v-if="m.Photo" class="pd-chip__ava" :src="m.Photo" :alt="m.Name" />
                                        <span v-else class="pd-chip__ava pd-chip__ava--i">{{ initials(m.Name) }}</span>
                                        <span class="pd-chip__name">{{ m.id === myId ? 'Вы' : (m.Name || 'Участник') }}</span>
                                        <button
                                            v-if="canRemove(activeChat, m.id)"
                                            class="pd-chip__x" type="button"
                                            :aria-label="m.id === myId ? 'Выйти из группы' : 'Удалить участника'"
                                            @click="removeMember(m.id)"
                                        >×</button>
                                    </span>
                                </div>

                                <div class="pd-group__actions">
                                    <button v-if="isCreator(activeChat)" class="pd-btn pd-btn--sm" type="button" @click="openAdd">＋ Добавить</button>
                                    <template v-if="isCreator(activeChat)">
                                        <button v-if="confirmAction !== 'delete'" class="pd-btn pd-btn--sm pd-btn--danger" type="button" @click="confirmAction = 'delete'">Удалить группу</button>
                                        <span v-else class="pd-confirm">
                                            Удалить для всех?
                                            <button class="pd-btn pd-btn--sm pd-btn--danger" type="button" @click="deleteActiveChat">Да</button>
                                            <button class="pd-btn pd-btn--sm pd-btn--ghost" type="button" @click="confirmAction = null">Нет</button>
                                        </span>
                                    </template>
                                    <template v-else>
                                        <button v-if="confirmAction !== 'leave'" class="pd-btn pd-btn--sm pd-btn--ghost" type="button" @click="confirmAction = 'leave'">Выйти из группы</button>
                                        <span v-else class="pd-confirm">
                                            Выйти?
                                            <button class="pd-btn pd-btn--sm pd-btn--danger" type="button" @click="removeMember(myId)">Да</button>
                                            <button class="pd-btn pd-btn--sm pd-btn--ghost" type="button" @click="confirmAction = null">Нет</button>
                                        </span>
                                    </template>
                                </div>
                            </div>

                            <div ref="threadEl" class="pd-thread__body">
                                <p v-if="!messages.length" class="pd-thread__empty">Нет сообщений. Напишите первым!</p>
                                <div
                                    v-for="m in messages" :key="m.id"
                                    class="pd-msg" :class="{ 'is-mine': m.creator === myId, 'is-grp': showSender(m) }"
                                >
                                    <template v-if="showSender(m)">
                                        <img v-if="usersById[m.creator]?.Photo" class="pd-msg__ava" :src="usersById[m.creator].Photo" :alt="senderName(m)" />
                                        <span v-else class="pd-msg__ava pd-msg__ava--i">{{ initials(senderName(m)) }}</span>
                                    </template>
                                    <div class="pd-msg__col">
                                        <span v-if="showSender(m)" class="pd-msg__sender">{{ senderName(m) }}</span>
                                        <div class="pd-msg__bubble">
                                            <span class="pd-msg__text">{{ m.text }}</span>
                                            <span class="pd-msg__time">{{ fmtTime(m.created_at) }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <form class="pd-thread__input" @submit.prevent="send">
                                <textarea
                                    ref="inputEl" v-model="text" rows="1" placeholder="Написать сообщение…" aria-label="Сообщение"
                                    :disabled="sending" @keydown.enter.exact="onEnter" @input="autogrow"
                                ></textarea>
                                <button class="pd-send" type="submit" :disabled="sending || !text.trim()" aria-label="Отправить">
                                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-3-6-7-2z"/></svg>
                                </button>
                            </form>
                        </template>

                        <div v-else class="pd-thread__none">
                            <img src="/images/minime-06.png" alt="" aria-hidden="true" />
                            <p>Выберите диалог, найдите пользователя или создайте группу.</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- ── Create group / add participants modal ─────────────────── -->
        <div v-if="pickMode" class="pd-modal" @click.self="closePick">
            <div class="pd-modal__panel" role="dialog" aria-modal="true">
                <div class="pd-modal__head">
                    <b>{{ pickMode === 'create' ? 'Новая группа' : 'Добавить участников' }}</b>
                    <button class="pd-modal__close" type="button" aria-label="Закрыть" @click="closePick">×</button>
                </div>

                <input v-if="pickMode === 'create'" v-model="pickTitle" class="pd-modal__title" type="text" placeholder="Название группы" aria-label="Название группы" maxlength="80" />

                <div v-if="pickSel.length" class="pd-modal__sel">
                    <span v-for="u in pickSel" :key="u.id" class="pd-chip pd-chip--sel">
                        <span class="pd-chip__name">{{ u.Name || 'Пользователь' }}</span>
                        <button class="pd-chip__x" type="button" aria-label="Убрать" @click="togglePick(u)">×</button>
                    </span>
                </div>

                <label class="pd-search pd-search--modal">
                    <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
                    <input v-model="pickQ" type="search" placeholder="Найти пользователя" aria-label="Найти пользователя" @input="onPickSearch" />
                </label>

                <div class="pd-modal__list">
                    <p v-if="pickSearching" class="pd-chat__hint">Поиск…</p>
                    <p v-else-if="pickQ.trim() && !pickResults.length" class="pd-chat__hint">Никого не найдено</p>
                    <p v-else-if="!pickQ.trim()" class="pd-chat__hint">Начните вводить имя, чтобы найти людей.</p>
                    <button
                        v-for="u in pickResults" :key="u.id" class="pd-chatrow" type="button"
                        :class="{ 'is-picked': isPicked(u.id) }" @click="togglePick(u)"
                    >
                        <img v-if="u.Photo" class="pd-chatrow__ava" :src="u.Photo" :alt="u.Name" />
                        <span v-else class="pd-chatrow__ava pd-chatrow__ava--i">{{ initials(u.Name) }}</span>
                        <span class="pd-chatrow__body"><b>{{ u.Name || 'Пользователь' }}</b></span>
                        <span class="pd-pick" :class="{ 'is-on': isPicked(u.id) }" aria-hidden="true"></span>
                    </button>
                </div>

                <div class="pd-modal__foot">
                    <template v-if="pickMode === 'create'">
                        <button class="pd-btn" type="button" :disabled="pickSel.length < 2 || !pickTitle.trim() || pickBusy" @click="createGroup">
                            Создать группу
                        </button>
                        <span class="pd-modal__hint">Минимум 2 участника + вы</span>
                    </template>
                    <template v-else>
                        <button class="pd-btn" type="button" :disabled="!pickSel.length || pickBusy" @click="confirmAdd">Добавить</button>
                    </template>
                </div>
            </div>
        </div>
    </main>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { getSupabase, readStoredSession } from '@/_front/chrome/headerAccount.js';

const CHAT_COLS = 'id, user_1, user_2, users, read, sort_date, is_group, title, creator';

const route = useRoute();
const myId = ref(null);
const myChats = ref([]);       // [{ id, user_1, user_2, users, read, sort_date, is_group, title, creator, preview }]
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
const inputEl = ref(null);

// group management
const mgmtOpen = ref(false);
const renaming = ref(false);
const renameVal = ref('');
const confirmAction = ref(null);  // null | 'leave' | 'delete'

// create-group / add-participants modal
const pickMode = ref(null);       // null | 'create' | 'add'
const pickTitle = ref('');
const pickSel = ref([]);          // [{ id, Name, Photo }]
const pickQ = ref('');
const pickResults = ref([]);
const pickSearching = ref(false);
const pickBusy = ref(false);

// grow the textarea with its content (Shift+Enter newlines), capped at ~5 rows
function autogrow() {
    const el = inputEl.value;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 132) + 'px';
}
function resetInputHeight() { const el = inputEl.value; if (el) el.style.height = 'auto'; }

// On desktop, Enter sends (and prevents the newline). On touch devices Enter must insert a newline
// (send is the button) — so don't hijack it there.
const isTouch = (typeof window !== 'undefined') && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);
function onEnter(e) { if (isTouch) return; e.preventDefault(); send(); }

let sb = null;
let msgChannel = null;   // per-active-chat messages stream
let chatsChannel = null; // list reorder + unread + membership
let searchTimer = null;
let pickTimer = null;

function initials(name) {
    const p = (name || '').split(/\s+/).filter(Boolean);
    return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '·';
}
function fmtTime(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
function isGroup(c) { return c?.is_group === true; }
function isCreator(c) { return !!c && c.creator === myId.value; }
function otherId(chat) { return chat?.user_1 === myId.value ? chat?.user_2 : chat?.user_1; }
function other(chat) { return usersById.value[otherId(chat)] || null; }
function chatTitle(c) {
    if (isGroup(c)) return c.title || 'Группа';
    return other(c)?.Name || 'Пользователь';
}
function members(c) { return (c?.users || []).map((id) => usersById.value[id]).filter(Boolean); }
function isUnread(chat) { return !!chat && Array.isArray(chat.read) && !chat.read.includes(myId.value); }
function senderName(m) { return usersById.value[m.creator]?.Name || 'Участник'; }
function showSender(m) { return isGroup(activeChat.value) && m.creator !== myId.value; }
// creator can remove anyone but self via this button-set; anyone can remove (leave) themselves.
function canRemove(c, uid) { return uid === myId.value ? true : isCreator(c); }

async function load() {
    sb = getSupabase();
    myId.value = readStoredSession()?.user?.id || null;
    if (!sb || !myId.value) { loading.value = false; return; }

    // one query covers 1-on-1 AND groups: chats whose users[] array contains me
    const { data: chats } = await sb.from('chats')
        .select(CHAT_COLS)
        .contains('users', [myId.value])
        .order('sort_date', { ascending: false, nullsFirst: false });
    myChats.value = chats || [];

    // resolve the "other" of each 1-on-1 for the list label (groups show title, no lookup needed)
    await ensureUsers(myChats.value.filter((c) => !isGroup(c)).map((c) => otherId(c)));

    subscribeChats();
    loading.value = false;

    if (route.query.user) await openChat(route.query.user); // deep-link /chats-demo?user=<id>
    else if (route.query.chat) {                            // deep-link /chats-demo?chat=<id>
        const c = myChats.value.find((x) => x.id === route.query.chat);
        if (c) openChatRow(c);
    }
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

function openChatRow(c) { closeMgmt(); activeChat.value = c; afterOpen(c); }

// open (or create) the 1-on-1 chat with user X
async function openChat(xId) {
    if (!xId || xId === myId.value) return;
    searchQ.value = ''; searchResults.value = [];
    closeMgmt();
    await ensureUsers([xId]);
    // existing 1-on-1?
    let chat = myChats.value.find((c) => !isGroup(c) && otherId(c) === xId);
    if (!chat) {
        const { data: found } = await sb.from('chats')
            .select(CHAT_COLS)
            .or(`and(user_1.eq.${myId.value},user_2.eq.${xId}),and(user_1.eq.${xId},user_2.eq.${myId.value})`)
            .limit(1);
        chat = found?.[0];
        if (!chat) {
            const now = new Date().toISOString();
            // is_group is a GENERATED column — must NOT be set on insert. users:[me,X] keeps it a 1-on-1
            // (length 2) and makes contains-load + the reverse users.chats[] trigger work.
            const { data: created } = await sb.from('chats')
                .insert({ user_1: myId.value, user_2: xId, users: [myId.value, xId], read: [myId.value, xId], mod_date: now, sort_date: now })
                .select(CHAT_COLS).limit(1);
            chat = created?.[0];
        }
        if (chat) { chat = { ...chat, preview: '' }; myChats.value = [chat, ...myChats.value.filter((c) => c.id !== chat.id)]; }
    }
    if (!chat) return;
    activeChat.value = chat;
    afterOpen(chat);
}

async function afterOpen(chat) {
    if (isGroup(chat)) await ensureUsers(chat.users || []);   // resolve member names/photos
    await loadMessages(chat.id);
    subscribeMessages(chat.id);
    markRead(chat);
}

async function loadMessages(chatId) {
    const { data } = await sb.from('messages').select('id, chat, text, creator, created_at').eq('chat', chatId).order('created_at', { ascending: true });
    messages.value = data || [];
    // resolve any senders not yet known (former members etc.) so group sender labels render
    await ensureUsers([...new Set((data || []).map((m) => m.creator))]);
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
    resetInputHeight();
    try {
        const { data } = await sb.from('messages')
            .insert({ chat: activeChat.value.id, text: t, creator: myId.value })
            .select('id, chat, text, creator, created_at').limit(1);
        const row = data?.[0];
        if (row && !messages.value.some((m) => m.id === row.id)) { messages.value.push(row); scrollBottom(); }
        // LIVE triggers set chats.read=[me] (→ unread for everyone else) and sort_date=now on message insert;
        // we patch locally for a snappy list. (The explicit update keeps parity if triggers ever change.)
        const now = new Date().toISOString();
        await sb.from('chats').update({ sort_date: now, mod_date: now, read: [myId.value] }).eq('id', activeChat.value.id);
        patchChat(activeChat.value.id, { sort_date: now, read: [myId.value], preview: t });
        reorderChats();
    } catch (e) { text.value = t; /* restore on failure */ } finally { sending.value = false; }
}

/* ── group operations (all mutate chats.users / chats.title) ─────────────── */
function openCreate() {
    pickMode.value = 'create';
    pickTitle.value = ''; pickSel.value = []; pickQ.value = ''; pickResults.value = [];
}
function openAdd() {
    pickMode.value = 'add';
    pickSel.value = []; pickQ.value = ''; pickResults.value = [];
    confirmAction.value = null;
}
function closePick() { pickMode.value = null; clearTimeout(pickTimer); }
function isPicked(id) { return pickSel.value.some((u) => u.id === id); }
function togglePick(u) {
    pickSel.value = isPicked(u.id) ? pickSel.value.filter((x) => x.id !== u.id) : [...pickSel.value, u];
}
function onPickSearch() {
    clearTimeout(pickTimer);
    const q = pickQ.value.trim();
    if (!q) { pickResults.value = []; return; }
    pickSearching.value = true;
    pickTimer = setTimeout(async () => {
        const { data } = await sb.from('users').select('id, "Name", "Photo"').ilike('Name', `%${q}%`).neq('id', myId.value).limit(20);
        // in "add" mode, hide people already in the group
        const inGroup = pickMode.value === 'add' ? new Set(activeChat.value?.users || []) : new Set();
        pickResults.value = (data || []).filter((u) => !inGroup.has(u.id));
        pickSearching.value = false;
    }, 280);
}

async function createGroup() {
    if (pickSel.value.length < 2 || !pickTitle.value.trim() || pickBusy.value) return;
    pickBusy.value = true;
    try {
        const ids = [...new Set([myId.value, ...pickSel.value.map((u) => u.id)])];
        const now = new Date().toISOString();
        // is_group derives from users length (>2); creator=me; read=[everyone] so it starts "read" for all.
        const { data: created } = await sb.from('chats')
            .insert({ users: ids, read: ids, title: pickTitle.value.trim(), creator: myId.value, mod_date: now, sort_date: now })
            .select(CHAT_COLS).limit(1);
        const chat = created?.[0];
        if (chat) {
            for (const u of pickSel.value) usersById.value[u.id] = usersById.value[u.id] || u;
            usersById.value = { ...usersById.value };
            const row = { ...chat, preview: '' };
            myChats.value = [row, ...myChats.value.filter((c) => c.id !== row.id)];
            closePick();
            openChatRow(row);
            mgmtOpen.value = true;
        }
    } finally { pickBusy.value = false; }
}

async function confirmAdd() {
    if (!pickSel.value.length || !activeChat.value || pickBusy.value) return;
    pickBusy.value = true;
    try {
        const merged = [...new Set([...(activeChat.value.users || []), ...pickSel.value.map((u) => u.id)])];
        const readMerged = [...new Set([...(activeChat.value.read || []), ...pickSel.value.map((u) => u.id)])];
        // NOTE: PostgREST rejects UPDATE ... select().limit() without an order (PGRST109) — .eq('id') already
        // scopes to one row, so no limit is needed.
        const { data } = await sb.from('chats').update({ users: merged, read: readMerged }).eq('id', activeChat.value.id).select(CHAT_COLS);
        for (const u of pickSel.value) usersById.value[u.id] = usersById.value[u.id] || u;
        usersById.value = { ...usersById.value };
        const patch = data?.[0] ? { users: data[0].users, read: data[0].read, is_group: data[0].is_group } : { users: merged, read: readMerged };
        patchChat(activeChat.value.id, patch);
        closePick();
    } finally { pickBusy.value = false; }
}

function startRename() { renameVal.value = activeChat.value?.title || ''; renaming.value = true; }
async function saveRename() {
    const t = renameVal.value.trim();
    if (!t || !activeChat.value) return;
    renaming.value = false;
    await sb.from('chats').update({ title: t }).eq('id', activeChat.value.id);
    patchChat(activeChat.value.id, { title: t });
}

// remove a member; if it's me → leave the group and close the thread
async function removeMember(uid) {
    if (!activeChat.value) return;
    const id = activeChat.value.id;
    const users = (activeChat.value.users || []).filter((x) => x !== uid);
    confirmAction.value = null;
    const { data } = await sb.from('chats').update({ users }).eq('id', id).select(CHAT_COLS);   // no limit — see confirmAdd
    if (uid === myId.value) {
        myChats.value = myChats.value.filter((c) => c.id !== id);
        closeActive();
    } else {
        const patch = data?.[0] ? { users: data[0].users, is_group: data[0].is_group } : { users };
        patchChat(id, patch);
    }
}

// hard-delete the active chat (row + all its messages, for everyone — matches the original /chats).
// A group can only be deleted by its creator; a 1-on-1 by either participant.
async function deleteActiveChat() {
    if (!activeChat.value) return;
    if (isGroup(activeChat.value) && !isCreator(activeChat.value)) return;
    const id = activeChat.value.id;
    confirmAction.value = null;
    await sb.from('chats').delete().eq('id', id);   // BEFORE-DELETE trigger cascades messages + users.chats[]
    myChats.value = myChats.value.filter((c) => c.id !== id);
    closeActive();
}

function closeMgmt() { mgmtOpen.value = false; renaming.value = false; confirmAction.value = null; }
function closeActive() {
    if (msgChannel) { try { sb.removeChannel(msgChannel); } catch (e) { /* noop */ } msgChannel = null; }
    activeChat.value = null; messages.value = []; closeMgmt();
}

/* ── realtime ───────────────────────────────────────────────────────────── */
function subscribeMessages(chatId) {
    if (msgChannel) { try { sb.removeChannel(msgChannel); } catch (e) { /* noop */ } }
    msgChannel = sb.channel('cd-msgs-' + chatId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat=eq.${chatId}` }, (payload) => {
            const m = payload.new;
            if (!messages.value.some((x) => x.id === m.id)) {
                if (!usersById.value[m.creator]) ensureUsers([m.creator]);  // resolve group sender label
                messages.value.push(m); scrollBottom();
            }
            // if it's someone else's message and this chat is open, mark read
            if (m.creator !== myId.value) markRead(activeChat.value);
        })
        .subscribe();
}
function subscribeChats() {
    chatsChannel = sb.channel('cd-chats')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, (payload) => {
            if (payload.eventType === 'DELETE') {
                const oldId = payload.old?.id;
                if (oldId) {
                    myChats.value = myChats.value.filter((x) => x.id !== oldId);
                    if (activeChat.value?.id === oldId) closeActive();
                }
                return;
            }
            const row = payload.new;
            if (!row) return;
            const isMember = Array.isArray(row.users) && row.users.includes(myId.value);
            if (!isMember) {
                // I left or was removed → drop it (and close if open)
                myChats.value = myChats.value.filter((x) => x.id !== row.id);
                if (activeChat.value?.id === row.id) closeActive();
                return;
            }
            const existing = myChats.value.find((x) => x.id === row.id);
            if (existing) {
                patchChat(row.id, { read: row.read, sort_date: row.sort_date, users: row.users, title: row.title, is_group: row.is_group });
                if (isGroup(row)) ensureUsers(row.users || []);
                // if this is the chat I'm actively viewing and the server just marked it unread for me
                // (a message reset read[] to [sender]), re-assert my read — robust to realtime event ordering
                if (activeChat.value?.id === row.id && Array.isArray(row.read) && !row.read.includes(myId.value)) {
                    markRead(activeChat.value);
                }
            } else {
                const resolve = isGroup(row) ? ensureUsers(row.users || []) : ensureUsers([otherId(row)]);
                resolve.then(() => { myChats.value = [{ ...row, preview: '' }, ...myChats.value.filter((x) => x.id !== row.id)]; });
            }
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
function scrollBottom() {
    nextTick(() => {
        const el = threadEl.value;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
        // second pass after layout/images settle so opening a chat lands on the last message
        requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    });
}

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
    --red: #de0030;
    --r-lg: 26px; --r-md: 16px; --r-pill: 999px;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --shadow: 0 14px 40px -20px rgba(9, 23, 71, 0.24); --shadow-sm: 0 4px 16px -8px rgba(9, 23, 71, 0.18);
    --shadow-lg: 0 30px 80px -30px rgba(9, 23, 71, 0.4);
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
.pd-chat__side { display: flex; flex-direction: column; gap: 12px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 16px; overflow: hidden; }
.pd-search { display: flex; align-items: center; gap: 10px; background: var(--bg-tint); border: 1px solid transparent; border-radius: var(--r-pill); padding: 0 16px; height: 46px; flex: none; }
.pd-search:focus-within { border-color: var(--blue-soft); background: var(--surface); }
.pd-search .pd-ic { width: 18px; height: 18px; color: var(--ink-3); flex: none; }
.pd-search input { flex: 1; border: none; outline: none; background: transparent; font-family: inherit; font-size: 15px; color: var(--ink); min-width: 0; }

.pd-newgroup { display: flex; align-items: center; justify-content: center; gap: 8px; flex: none; height: 44px; border: 1px dashed var(--blue-soft); border-radius: var(--r-pill); background: var(--blue-tint); color: var(--blue-ink); font-family: inherit; font-weight: 600; font-size: 0.94rem; cursor: pointer; transition: background 0.15s var(--ease-out), border-color 0.15s var(--ease-out); }
.pd-newgroup .pd-ic { width: 18px; height: 18px; }
@media (hover: hover) and (pointer: fine) { .pd-newgroup:hover { background: #dfeafe; border-color: var(--blue); } }

.pd-chat__list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; margin: 0 -6px; padding: 0 6px; }
.pd-chat__hint { margin: 6px 8px; color: var(--ink-3); font-size: 0.86rem; }

.pd-chatrow { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; background: transparent; border: none; border-radius: var(--r-md); padding: 10px 12px; cursor: pointer; font-family: inherit; color: inherit; transition: background 0.14s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .pd-chatrow:hover { background: var(--bg-tint); } }
.pd-chatrow.is-on { background: var(--blue-tint); }
.pd-chatrow.is-picked { background: var(--blue-tint); }
.pd-chatrow__ava { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; flex: none; }
.pd-chatrow__ava--i { display: grid; place-items: center; background: var(--blue-tint); color: var(--blue-ink); font-weight: 700; font-size: 0.9rem; }
.pd-chatrow__ava--grp { display: grid; place-items: center; background: #eef4ff; color: var(--blue); }
.pd-chatrow__ava--grp .pd-ic { width: 24px; height: 24px; }
.pd-chatrow__body { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
.pd-chatrow__body b { font-weight: 600; font-size: 0.98rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pd-chatrow__last { color: var(--ink-3); font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pd-chatrow.is-unread .pd-chatrow__body b { font-weight: 700; }
.pd-chatrow__dot { width: 9px; height: 9px; border-radius: 50%; background: var(--blue); flex: none; margin-left: auto; }
.pd-pick { width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--line); flex: none; margin-left: auto; transition: border-color 0.14s, background 0.14s; }
.pd-pick.is-on { border-color: var(--blue); background: var(--blue); box-shadow: inset 0 0 0 3px var(--surface); }

/* ── Thread ─────────────────────────────────────────────────────────────── */
.pd-chat__main { display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); overflow: hidden; }
.pd-thread__head { display: flex; align-items: center; gap: 12px; padding: 16px 22px; border-bottom: 1px solid var(--line); font-weight: 700; font-size: 1.05rem; flex: none; }
.pd-thread__ava { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex: none; }
.pd-thread__ava--i { display: grid; place-items: center; background: var(--blue-tint); color: var(--blue-ink); font-weight: 700; font-size: 0.85rem; }
.pd-thread__ava--grp { display: grid; place-items: center; background: #eef4ff; color: var(--blue); }
.pd-thread__ava--grp .pd-ic { width: 22px; height: 22px; }
.pd-thread__titles { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
.pd-thread__titles b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pd-thread__meta { font-weight: 500; font-size: 0.8rem; color: var(--ink-3); }
.pd-thread__manage { margin-left: auto; flex: none; border: 1px solid var(--line); background: var(--surface); border-radius: var(--r-pill); padding: 7px 15px; font-family: inherit; font-size: 0.85rem; font-weight: 600; color: var(--blue-ink); cursor: pointer; transition: background 0.14s, border-color 0.14s; }
@media (hover: hover) and (pointer: fine) { .pd-thread__manage:hover { background: var(--blue-tint); border-color: var(--blue-soft); } }
.pd-thread__del { margin-left: auto; flex: none; width: 38px; height: 38px; display: grid; place-items: center; border: 1px solid var(--line); background: var(--surface); border-radius: 50%; color: var(--ink-3); cursor: pointer; transition: background 0.14s, border-color 0.14s, color 0.14s; }
.pd-thread__del .pd-ic { width: 18px; height: 18px; }
@media (hover: hover) and (pointer: fine) { .pd-thread__del:hover { background: #fdeef1; border-color: var(--red); color: var(--red); } }
.pd-confirm--head { margin-left: auto; flex: none; }

/* ── Group management panel ─────────────────────────────────────────────── */
.pd-group { flex: none; border-bottom: 1px solid var(--line); padding: 14px 22px; background: #fafcff; display: flex; flex-direction: column; gap: 12px; }
.pd-group__row { display: flex; }
.pd-linkbtn { border: none; background: transparent; color: var(--blue-ink); font-family: inherit; font-size: 0.9rem; font-weight: 600; cursor: pointer; padding: 0; }
.pd-linkbtn:hover { text-decoration: underline; }
.pd-group__rename { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.pd-group__rename input { flex: 1; min-width: 160px; border: 1px solid var(--line); border-radius: var(--r-md); padding: 9px 14px; font-family: inherit; font-size: 0.95rem; color: var(--ink); background: var(--surface); outline: none; }
.pd-group__rename input:focus { border-color: var(--blue-soft); }
.pd-group__members { display: flex; flex-wrap: wrap; gap: 8px; }
.pd-chip { display: inline-flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-pill); padding: 4px 10px 4px 4px; font-size: 0.86rem; }
.pd-chip--sel { padding: 6px 8px 6px 12px; background: var(--blue-tint); border-color: var(--blue-soft); }
.pd-chip__ava { width: 26px; height: 26px; border-radius: 50%; object-fit: cover; flex: none; }
.pd-chip__ava--i { display: grid; place-items: center; background: var(--blue-tint); color: var(--blue-ink); font-weight: 700; font-size: 0.68rem; }
.pd-chip__name { font-weight: 500; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pd-chip__x { border: none; background: transparent; color: var(--ink-3); font-size: 1.15rem; line-height: 1; cursor: pointer; padding: 0 2px; border-radius: 50%; }
@media (hover: hover) and (pointer: fine) { .pd-chip__x:hover { color: var(--red); } }
.pd-group__actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pd-confirm { display: inline-flex; align-items: center; gap: 8px; font-size: 0.86rem; color: var(--ink-2); }

.pd-btn { border: none; border-radius: var(--r-pill); background: var(--blue); color: #fff; font-family: inherit; font-weight: 600; font-size: 0.95rem; padding: 11px 22px; cursor: pointer; transition: background 0.15s var(--ease-out), transform 0.15s var(--ease-out); }
.pd-btn--sm { padding: 8px 15px; font-size: 0.85rem; }
.pd-btn--ghost { background: var(--surface); color: var(--ink-2); border: 1px solid var(--line); }
.pd-btn--danger { background: var(--red); color: #fff; }
.pd-btn:disabled { opacity: 0.5; cursor: default; }
@media (hover: hover) and (pointer: fine) {
    .pd-btn:not(:disabled):hover { background: var(--blue-strong); transform: translateY(-1px); }
    .pd-btn--ghost:not(:disabled):hover { background: var(--bg-tint); color: var(--ink); }
    .pd-btn--danger:not(:disabled):hover { background: #b8002a; }
}

.pd-thread__body { flex: 1; overflow-y: auto; padding: 22px; display: flex; flex-direction: column; gap: 10px; background: var(--bg-tint); }
.pd-thread__empty { margin: auto; color: var(--ink-3); }
.pd-msg { display: flex; align-items: flex-end; gap: 8px; }
.pd-msg.is-mine { justify-content: flex-end; }
.pd-msg__ava { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; flex: none; margin-bottom: 2px; }
.pd-msg__ava--i { display: grid; place-items: center; background: var(--blue-tint); color: var(--blue-ink); font-weight: 700; font-size: 0.66rem; }
.pd-msg__col { display: flex; flex-direction: column; max-width: 74%; min-width: 0; }
.pd-msg__sender { font-size: 0.76rem; font-weight: 600; color: var(--blue-ink); margin: 0 0 3px 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pd-msg__bubble { background: var(--surface); border: 1px solid var(--line); border-radius: 16px 16px 16px 5px; padding: 10px 14px 7px; box-shadow: var(--shadow-sm); }
.pd-msg.is-mine .pd-msg__bubble { background: var(--blue); border-color: var(--blue); color: #fff; border-radius: 16px 16px 5px 16px; }
.pd-msg__text { display: block; font-size: 0.98rem; line-height: 1.4; white-space: pre-wrap; word-break: break-word; }
.pd-msg__time { display: block; margin-top: 3px; text-align: right; font-size: 0.72rem; color: var(--ink-3); }
.pd-msg.is-mine .pd-msg__time { color: rgba(255, 255, 255, 0.75); }

.pd-thread__input { display: flex; align-items: flex-end; gap: 10px; padding: 14px 18px; border-top: 1px solid var(--line); flex: none; }
.pd-thread__input textarea { flex: 1; border: 1px solid var(--line); outline: none; background: var(--bg-tint); border-radius: 20px; padding: 11px 18px; font-family: inherit; font-size: 15px; line-height: 1.4; color: var(--ink); min-width: 0; resize: none; max-height: 132px; overflow-y: auto; display: block; }
.pd-thread__input textarea:focus { border-color: var(--blue-soft); background: var(--surface); }
.pd-send { width: 46px; height: 46px; flex: none; border: none; border-radius: 50%; background: var(--blue); color: #fff; display: grid; place-items: center; cursor: pointer; transition: background 0.16s var(--ease-out), transform 0.16s var(--ease-out); }
.pd-send svg { width: 22px; height: 22px; fill: currentColor; }
.pd-send:disabled { opacity: 0.5; cursor: default; }
@media (hover: hover) and (pointer: fine) { .pd-send:not(:disabled):hover { background: var(--blue-strong); transform: translateY(-1px); } }

.pd-thread__none { margin: auto; text-align: center; color: var(--ink-2); padding: 40px; }
.pd-thread__none img { width: 110px; height: auto; margin: 0 auto 16px; display: block; }

/* ── Modal (create group / add participants) ────────────────────────────── */
.pd-modal { position: fixed; inset: 0; z-index: 60; background: rgba(9, 23, 71, 0.42); display: grid; place-items: center; padding: 20px; }
.pd-modal__panel { width: 100%; max-width: 460px; max-height: 84vh; background: var(--surface); border-radius: var(--r-lg); box-shadow: var(--shadow-lg); display: flex; flex-direction: column; overflow: hidden; }
.pd-modal__head { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid var(--line); font-size: 1.1rem; }
.pd-modal__close { border: none; background: transparent; font-size: 1.6rem; line-height: 1; color: var(--ink-3); cursor: pointer; }
@media (hover: hover) and (pointer: fine) { .pd-modal__close:hover { color: var(--ink); } }
.pd-modal__title { margin: 16px 22px 0; border: 1px solid var(--line); border-radius: var(--r-md); padding: 12px 16px; font-family: inherit; font-size: 1rem; color: var(--ink); background: var(--bg-tint); outline: none; }
.pd-modal__title:focus { border-color: var(--blue-soft); background: var(--surface); }
.pd-modal__sel { display: flex; flex-wrap: wrap; gap: 8px; padding: 14px 22px 0; }
.pd-search--modal { margin: 14px 22px 0; }
.pd-modal__list { flex: 1; overflow-y: auto; padding: 10px 16px 14px; display: flex; flex-direction: column; gap: 4px; min-height: 120px; }
.pd-modal__foot { display: flex; align-items: center; gap: 12px; padding: 16px 22px; border-top: 1px solid var(--line); }
.pd-modal__hint { color: var(--ink-3); font-size: 0.82rem; }

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 860px) {
    .pd-wrap { padding-inline: 22px; }
    .pd-chat { grid-template-columns: 1fr; height: auto; }
    .pd-chat__side { max-height: 320px; }
    /* bounded height with internal scroll so the thread doesn't stretch the whole page down */
    .pd-chat__main { height: 70dvh; min-height: 400px; }
}
</style>
