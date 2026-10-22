<template>
    <div class="lkc">
        <!-- Loading / error -->
        <div v-if="phase !== 'connected'" class="lkc-center">
            <template v-if="phase === 'error'">
                <div class="lkc-center__icon">⚠️</div>
                <p class="lkc-center__text">{{ errorMsg }}</p>
                <button class="lkc-btn" @click="reconnect">Повторить</button>
                <button class="lkc-btn lkc-btn--ghost" @click="leave">Выйти</button>
            </template>
            <template v-else>
                <div class="lkc-spinner"></div>
                <p class="lkc-center__text">
                    {{ phase === 'reconnecting' ? 'Переподключение к эфиру…' : 'Подключение к эфиру…' }}
                </p>
            </template>
        </div>

        <!-- Room -->
        <template v-else>
            <div v-if="reconnecting" class="lkc-banner">Переподключение…</div>

            <!-- Screen share present → spotlight (big screen + small camera strip); else camera grid -->
            <div v-if="screenShares.length" class="lkc-stage">
                <div class="lkc-spotlight">
                    <StreamTile :entry="screenShares[0]" />
                </div>
                <div class="lkc-strip">
                    <StreamTile v-for="p in participants" :key="p.key" :entry="p" />
                </div>
            </div>
            <div v-else class="lkc-grid" :class="gridClass">
                <StreamTile v-for="p in participants" :key="p.key" :entry="p" />
            </div>

            <!-- Owner roster panel -->
            <div v-if="isOwner && rosterOpen" class="lkc-roster">
                <div class="lkc-roster__head">
                    <strong>Со-ведущие</strong>
                    <button class="lkc-x" @click="rosterOpen = false">✕</button>
                </div>
                <div class="lkc-roster__invite">
                    <input
                        v-model="inviteEmail"
                        class="lkc-input"
                        type="email"
                        placeholder="e-mail со-ведущего"
                        autocomplete="off"
                        @keyup.enter="invite"
                    />
                    <button class="lkc-btn" :disabled="inviting" @click="invite">
                        {{ inviting ? '…' : 'Пригласить' }}
                    </button>
                </div>
                <ul class="lkc-roster__list">
                    <li v-for="c in cohosts" :key="c.id">
                        <span class="lkc-roster__name">
                            {{ (c.userInfo && (c.userInfo.Name || c.userInfo.email)) || 'Участник' }}
                        </span>
                        <span class="lkc-roster__status" :data-role="c.role" :data-status="c.status">
                            {{ statusLabel(c) }}
                        </span>
                        <span v-if="c.role === 'cohost'" class="lkc-roster__remove">
                            <template v-if="confirmRemoveId === c.id">
                                <button class="lkc-link-danger" :disabled="removingId === c.id" @click="removeCohostRoom(c)">{{ removingId === c.id ? '…' : 'Точно?' }}</button>
                                <button class="lkc-link-muted" @click="confirmRemoveId = null">Отмена</button>
                            </template>
                            <button v-else class="lkc-link-danger" @click="confirmRemoveId = c.id">Удалить</button>
                        </span>
                    </li>
                </ul>
            </div>

            <!-- Live chat panel (speaker/co-host view of the viewer chat) -->
            <div v-if="chatOpen" class="lkc-chat">
                <div class="lkc-chat__head">
                    <strong>Чат эфира</strong>
                    <button class="lkc-x" @click="chatOpen = false">✕</button>
                </div>
                <div ref="chatFeedEl" class="lkc-chat__feed">
                    <div v-if="chatLoading && !chatMessages.length" class="lkc-chat__muted">Загрузка чата…</div>
                    <div v-else-if="!chatMessages.length" class="lkc-chat__muted">Сообщений пока нет.</div>
                    <div v-for="m in chatMessages" :key="m.id" class="lkc-chat__row" :class="{ mine: m.owner === myUid }">
                        <img v-if="m.authorUser && m.authorUser.Photo" :src="m.authorUser.Photo" class="lkc-chat__ava" alt="" />
                        <div v-else class="lkc-chat__ava lkc-chat__ava--empty">{{ ((m.authorUser && m.authorUser.Name) || '?').slice(0, 1) }}</div>
                        <div class="lkc-chat__bubble">
                            <div class="lkc-chat__meta">
                                <span class="lkc-chat__name">{{ (m.authorUser && m.authorUser.Name) || 'Пользователь' }}</span>
                                <span class="lkc-chat__time">{{ msgTime(m.created_at) }}</span>
                            </div>
                            <div class="lkc-chat__text">{{ m.text }}</div>
                        </div>
                    </div>
                </div>
                <div class="lkc-chat__composer">
                    <textarea
                        v-model="chatText"
                        class="lkc-chat__input"
                        rows="1"
                        placeholder="Написать в чат…"
                        @keydown.enter.exact.prevent="sendStreamChat"
                    ></textarea>
                    <button class="lkc-btn" :disabled="!chatText.trim() || chatSending" @click="sendStreamChat">
                        {{ chatSending ? '…' : 'Отпр.' }}
                    </button>
                </div>
            </div>

            <!-- Presenter-only slide navigation -->
            <div v-if="presenting" class="lkc-presbar">
                <button class="lkc-navbtn" :disabled="pageNum <= 1" @click="gotoPage(-1)">←</button>
                <span class="lkc-navlabel">{{ pageNum }} / {{ pageCount }}</span>
                <button class="lkc-navbtn" :disabled="pageNum >= pageCount" @click="gotoPage(1)">→</button>
                <button class="lkc-navbtn lkc-navbtn--stop" @click="stopPresentation">Завершить</button>
            </div>

            <!-- Controls -->
            <div class="lkc-controls">
                <button class="lkc-ctrl" :class="{ off: !micOn }" title="Микрофон" @click="toggleMic">
                    <svg class="lkc-ic" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                        <path d="M5 11a7 7 0 0 0 14 0" />
                        <line x1="12" y1="18" x2="12" y2="22" />
                        <line v-if="!micOn" x1="3" y1="3" x2="21" y2="21" />
                    </svg>
                </button>
                <button class="lkc-ctrl" :class="{ off: !camOn }" title="Камера" @click="toggleCam">
                    <svg class="lkc-ic" viewBox="0 0 24 24" aria-hidden="true">
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect x="1" y="5" width="15" height="14" rx="2" />
                        <line v-if="!camOn" x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                </button>
                <button
                    v-if="canScreenShare"
                    class="lkc-ctrl"
                    :class="{ on: screenSharing && !presenting }"
                    :disabled="presenting"
                    :title="screenSharing ? 'Остановить демонстрацию' : 'Демонстрация экрана'"
                    @click="toggleScreenShare"
                >
                    <svg class="lkc-ic" viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                </button>
                <button
                    class="lkc-ctrl"
                    :class="{ on: presenting }"
                    :disabled="screenSharing && !presenting"
                    :title="presenting ? 'Завершить презентацию' : 'Презентация (PDF)'"
                    @click="presenting ? stopPresentation() : startPresentation()"
                >
                    <svg class="lkc-ic" viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="14" rx="1" />
                        <line x1="3" y1="9" x2="21" y2="9" />
                        <line x1="12" y1="18" x2="12" y2="21" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                    </svg>
                </button>

                <select class="lkc-select" :value="selectedCam" title="Камера" @change="onPickCam">
                    <option v-for="d in devices.cams" :key="d.deviceId" :value="d.deviceId">
                        {{ d.label || 'Камера' }}
                    </option>
                </select>
                <select class="lkc-select" :value="selectedMic" title="Микрофон" @change="onPickMic">
                    <option v-for="d in devices.mics" :key="d.deviceId" :value="d.deviceId">
                        {{ d.label || 'Микрофон' }}
                    </option>
                </select>

                <button class="lkc-ctrl lkc-ctrl--chat" :class="{ on: chatOpen }" title="Чат эфира" @click="toggleChat">
                    <svg class="lkc-ic" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span v-if="chatUnread > 0" class="lkc-ctrl__badge">{{ chatUnread > 9 ? '9+' : chatUnread }}</span>
                </button>

                <button v-if="isOwner" class="lkc-ctrl" title="Со-ведущие" @click="toggleRoster">
                    <svg class="lkc-ic" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                </button>
                <button class="lkc-ctrl lkc-ctrl--danger" title="Выйти" @click="leave">
                    <svg class="lkc-ic" viewBox="0 0 24 24" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>
        </template>

        <!-- Hidden container for remote audio elements -->
        <div ref="audioBox" style="display: none"></div>
        <!-- PDF-presentation canvas (published as a screen-share track). Positioned OFF-SCREEN
             rather than display:none — Chrome doesn't composite a display:none canvas, so
             captureStream() would yield blank/black frames. -->
        <canvas ref="presCanvas" class="lkc-offscreen"></canvas>
        <input
            ref="fileInput"
            type="file"
            accept="application/pdf,.pdf"
            style="display: none"
            @change="onPdfPicked"
        />
    </div>
</template>

<script setup>
import { ref, shallowRef, computed, onMounted, onBeforeUnmount, markRaw } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import { DisconnectReason, Room, RoomEvent, Track } from 'livekit-client';

import { getLiveToken, inviteCohost, removeCohost, LiveApiError } from '@/_front/streams/liveApi.js';
import { listCohosts } from '@/_front/streams/cohosts.js';
import { readStoredSession, authCookieUser } from '@/_front/chrome/headerAccount.js';
import StreamTile from './StreamTile.vue';

const supa = () => window.wwLib?.wwPlugins?.supabase?.instance;

const route = useRoute();
const router = useRouter();
const streamId = String(route.query.stream || '');

const room = shallowRef(null); // LiveKit Room — NOT deeply reactive
const phase = ref('loading'); // loading | connecting | connected | reconnecting | error
const errorMsg = ref(null);
const reconnecting = ref(false); // SDK-level transient reconnect banner

// Full app-level reconnect cycle (mirror of mobile call.tsx): re-mint + rejoin with exponential
// backoff for up to RECONNECT_WINDOW_MS on a FULL disconnect, unless the reason is terminal.
const RECONNECT_WINDOW_MS = 120000; // ~2 min, then give up
let reconnectStart = null;
let reconnectAttempt = 0;
let reconnectTimer = null;
let refreshTimer = null; // proactive token refresh before the 2h TTL

const participants = ref([]); // camera snapshots, one per participant
const screenShares = ref([]); // active screen-share snapshots (spotlight)
const micOn = ref(true);
const camOn = ref(true);
const screenSharing = ref(false); // is THIS device sharing its screen
const userWantsCamera = ref(true); // intent — survives the background camera suspend

// Only phones/tablets suspend the camera when the tab is hidden (the OS suspends capture anyway and
// it saves battery/data). On a desktop presenter, hiding/alt-tabbing the tab must NOT stop the
// camera — doing so froze the broadcast whenever the host switched windows.
const isCoarsePointer = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: coarse)').matches;

// Screen Wake Lock: keep the machine awake while broadcasting so the screen never sleeps mid-stream
// (sleep suspends capture). Best-effort; auto-released by the browser when the tab hides → re-acquired
// on return to visible. Not a cure for background-tab throttling, only for screen sleep.
let wakeLock = null;
async function acquireWakeLock() {
    try {
        if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && navigator.wakeLock) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener?.('release', () => { wakeLock = null; });
        }
    } catch { /* best-effort: denied / unsupported */ }
}
function releaseWakeLock() {
    try { wakeLock?.release?.(); } catch { /* noop */ }
    wakeLock = null;
}
const role = ref('cohost');

// Screen share is desktop-only (getDisplayMedia is absent on mobile browsers).
const canScreenShare =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices && !!navigator.mediaDevices.getDisplayMedia;

// PDF presentation (Approach B): render a slide to a canvas via pdf.js and publish the canvas as a
// screen-share-source track → reuses the whole spotlight pipeline (client + egress) for free.
const presenting = ref(false);
const pageNum = ref(1);
const pageCount = ref(0);
const presCanvas = ref(null);
const fileInput = ref(null);
let pdfDoc = null; // pdf.js document (non-reactive)
let presStream = null; // canvas.captureStream()
let presMst = null; // its MediaStreamTrack (what we publish/unpublish)
let presKeepAlive = null; // re-pushes the current static frame so late subscribers/egress get it
let presRenderCanvas = null; // OFF-DOM scratch: the PDF page is rendered here, then blitted whole
// Fixed capture resolution. The capture canvas is sized ONCE to this and never resized afterwards —
// resizing a live captureStream source changes the published track resolution mid-stream, which the
// egress/HLS pipeline can't absorb (that was the white screen on slide change). 16:9, crisp at 1080p.
const PRES_W = 1920;
const PRES_H = 1080;

// Live chat — the speaker/co-host view of the same viewer chat (table `stream_chat`). Polled, not
// realtime, mirroring StreamsPage.vue. uid resolved from the stored session/cookie (no getSession stall).
const myUid = readStoredSession()?.user?.id || authCookieUser()?.id || null;
const chatOpen = ref(false);
const chatMessages = ref([]);
const chatText = ref('');
const chatSending = ref(false);
const chatLoading = ref(false);
const chatUnread = ref(0);
const chatFeedEl = ref(null);
let chatTimer = null;

const devices = ref({ cams: [], mics: [] });
const selectedCam = ref('');
const selectedMic = ref('');

// Owner roster
const rosterOpen = ref(false);
const cohosts = ref([]);
const inviteEmail = ref('');
const inviting = ref(false);
const confirmRemoveId = ref(null);
const removingId = ref(null);

const isOwner = computed(() => role.value === 'owner');
const gridClass = computed(() => {
    const n = participants.value.length;
    if (n <= 1) return 'lkc-grid--1';
    if (n <= 4) return 'lkc-grid--2';
    return 'lkc-grid--3';
});

// A hidden <audio> per remote audio track (keyed by track sid) so remote sound plays.
const audioBox = ref(null);
const audioEls = new Map();

const REBUILD_ON = [
    RoomEvent.ParticipantConnected,
    RoomEvent.ParticipantDisconnected,
    RoomEvent.TrackSubscribed,
    RoomEvent.TrackUnsubscribed,
    RoomEvent.LocalTrackPublished,
    RoomEvent.LocalTrackUnpublished,
    RoomEvent.TrackMuted,
    RoomEvent.TrackUnmuted,
    RoomEvent.ActiveSpeakersChanged,
];

// One snapshot per (participant, source). `active` = there's a live, unmuted track for that source.
function snapshot(p, isLocal, source) {
    const pub = p.getTrackPublication(source);
    return {
        key: `${p.sid}:${source}`,
        sid: p.sid,
        identity: p.identity,
        name: p.name || p.identity,
        isLocal,
        source,
        speaking: p.isSpeaking,
        micEnabled: p.isMicrophoneEnabled,
        active: !!pub && !!pub.track && !pub.isMuted,
        participant: markRaw(p),
    };
}

function syncParticipants() {
    const r = room.value;
    if (!r) return;
    const all = [r.localParticipant, ...r.remoteParticipants.values()];
    participants.value = all.map((p) => snapshot(p, p === r.localParticipant, Track.Source.Camera));
    // Screen shares are a separate publication on the same participant → their own spotlight tiles.
    screenShares.value = all
        .map((p) => snapshot(p, p === r.localParticipant, Track.Source.ScreenShare))
        .filter((s) => s.active);
    micOn.value = r.localParticipant.isMicrophoneEnabled;
    camOn.value = r.localParticipant.isCameraEnabled;
    screenSharing.value = r.localParticipant.isScreenShareEnabled;
}

function handleTrackSubscribed(track) {
    if (track.kind !== 'audio' || !audioBox.value) return;
    const el = track.attach(); // creates an <audio>
    audioEls.set(track.sid, el);
    audioBox.value.appendChild(el);
}

function handleTrackUnsubscribed(track) {
    if (track.kind !== 'audio') return;
    track.detach();
    const el = audioEls.get(track.sid);
    if (el && el.parentNode) el.parentNode.removeChild(el);
    audioEls.delete(track.sid);
}

async function loadDevices() {
    try {
        const list = await navigator.mediaDevices.enumerateDevices();
        devices.value = {
            cams: list.filter((d) => d.kind === 'videoinput'),
            mics: list.filter((d) => d.kind === 'audioinput'),
        };
        const r = room.value;
        selectedCam.value = r?.getActiveDevice?.('videoinput') || devices.value.cams[0]?.deviceId || '';
        selectedMic.value = r?.getActiveDevice?.('audioinput') || devices.value.mics[0]?.deviceId || '';
    } catch {
        // device listing best-effort
    }
}

/* ── live chat (speaker view) ─────────────────────────────────────────────── */
// Chat data access is INLINED here on purpose: importing streamsApi.js would pull peertubeLive +
// Cyrillic role constants into this lazy route, creating a shared Rolldown chunk that panics on a
// Cyrillic byte boundary. These are the same `stream_chat` queries, minus that dependency.
async function fetchChatAuthors(rows) {
    const ids = [...new Set(rows.map((r) => r.owner).filter(Boolean))];
    let byId = {};
    if (ids.length) {
        const { data } = await supa().from('users').select('id,Name,Photo').in('id', ids);
        byId = Object.fromEntries((data || []).map((u) => [u.id, u]));
    }
    return rows.map((r) => ({ ...r, authorUser: byId[r.owner] || null }));
}
async function fetchChatMessages(id) {
    const { data, error } = await supa()
        .from('stream_chat').select('*').eq('stream', id).neq('deleted', true)
        .order('created_at', { ascending: true }).limit(200);
    if (error) throw new Error(error.message);
    return fetchChatAuthors(data || []);
}
async function postChatMessage(id, owner, text) {
    const { error } = await supa().from('stream_chat').insert({ stream: id, owner, text, img: [] });
    if (error) throw new Error(error.message);
}

function msgTime(iso) {
    return iso ? new Date(iso).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
}
function scrollChat() {
    requestAnimationFrame(() => { const el = chatFeedEl.value; if (el) el.scrollTop = el.scrollHeight; });
}
async function loadStreamChat({ scroll = false } = {}) {
    if (!streamId) return;
    try {
        const prev = chatMessages.value.length;
        const rows = await fetchChatMessages(streamId);
        const grew = rows.length - prev;
        chatMessages.value = rows;
        if (grew > 0 && !chatOpen.value) chatUnread.value += grew; // badge only while the panel is closed
        if (scroll || grew !== 0) scrollChat();
    } catch { /* keep current messages on a transient refresh failure */ }
}
async function sendStreamChat() {
    const text = chatText.value.trim();
    if (!text || chatSending.value || !myUid) return;
    chatSending.value = true;
    try {
        await postChatMessage(streamId, myUid, text);
        chatText.value = '';
        await loadStreamChat({ scroll: true });
    } catch { /* transient — user can retry */ }
    finally { chatSending.value = false; }
}
function toggleChat() {
    chatOpen.value = !chatOpen.value;
    if (chatOpen.value) { chatUnread.value = 0; scrollChat(); }
}
function startChatPoll() {
    stopChatPoll();
    chatLoading.value = true;
    loadStreamChat({ scroll: true }).finally(() => { chatLoading.value = false; });
    chatTimer = setInterval(() => loadStreamChat(), 7000);
}
function stopChatPoll() {
    if (chatTimer) { clearInterval(chatTimer); chatTimer = null; }
}

function onVisibility() {
    const r = room.value;
    if (!r) return;
    if (document.visibilityState === 'visible') {
        if (userWantsCamera.value) r.localParticipant.setCameraEnabled(true).catch(() => {});
        acquireWakeLock(); // the browser releases the wake lock on hide → re-take it on return
    } else if (isCoarsePointer) {
        // Phone/tablet hidden: the OS suspends capture anyway → drop the camera, keep the mic (audio
        // continues). On desktop we deliberately do NOTHING here so an alt-tabbed host keeps streaming.
        r.localParticipant.setCameraEnabled(false).catch(() => {});
    }
}

function beforeUnloadHandler() {
    room.value?.disconnect();
}

let leaving = false;

async function connect() {
    if (!streamId) {
        errorMsg.value = 'Не указан эфир.';
        phase.value = 'error';
        return;
    }
    // Drop any previous room (rejoin path) before making a fresh one.
    if (room.value) {
        try {
            room.value.disconnect();
        } catch {
            /* ignore */
        }
        room.value = null;
    }
    if (phase.value !== 'reconnecting') phase.value = 'connecting';
    errorMsg.value = null;
    try {
        const grant = await getLiveToken(supa(), streamId);
        role.value = grant.role;

        const r = new Room({ adaptiveStream: true, dynacast: true });
        REBUILD_ON.forEach((ev) => r.on(ev, syncParticipants));
        r.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
        r.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
        r.on(RoomEvent.Reconnecting, () => (reconnecting.value = true));
        r.on(RoomEvent.Reconnected, () => (reconnecting.value = false));
        r.on(RoomEvent.Disconnected, onRoomDisconnected);

        await r.connect(grant.url, grant.token); // the "Войти" click gave the user-gesture for audio autoplay
        await r.localParticipant.setCameraEnabled(true);
        await r.localParticipant.setMicrophoneEnabled(true);

        room.value = r;
        phase.value = 'connected';
        reconnecting.value = false;
        reconnectStart = null;
        reconnectAttempt = 0;
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        syncParticipants();
        loadDevices();
        scheduleTokenRefresh(grant.expires_at);
        acquireWakeLock();
        startChatPoll();
    } catch (e) {
        // Membership revoked (removed) / stream gone → terminal, no point retrying.
        if (e instanceof LiveApiError && (e.code === 'not_a_cohost' || e.code === 'stream_not_found')) {
            errorMsg.value = 'Доступ к эфиру закрыт.';
            phase.value = 'error';
            return;
        }
        scheduleReconnect(); // network error while minting → keep trying within the window
    }
}

// Proactive token refresh ~10 min before the ~2h TTL, so a long call never needs a visible rejoin.
// Feature-detected — a no-op if this livekit-client build doesn't expose updateToken.
function scheduleTokenRefresh(expiresAt) {
    if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
    }
    const ms = new Date(expiresAt).getTime() - Date.now() - 10 * 60 * 1000;
    if (!Number.isFinite(ms) || ms <= 0) return;
    refreshTimer = setTimeout(async () => {
        try {
            const g = await getLiveToken(supa(), streamId);
            const r = room.value;
            if (r && typeof r.updateToken === 'function') r.updateToken(g.token);
            else if (r && r.engine && typeof r.engine.updateToken === 'function') r.engine.updateToken(g.token);
        } catch {
            /* the reconnect loop re-mints on a real disconnect */
        }
    }, ms);
}

function terminalDisconnectMessage(reason) {
    switch (reason) {
        case DisconnectReason.PARTICIPANT_REMOVED:
            return 'Владелец удалил вас из эфира.';
        case DisconnectReason.ROOM_DELETED:
        case DisconnectReason.ROOM_CLOSED:
            return 'Эфир завершён.';
        case DisconnectReason.DUPLICATE_IDENTITY:
            return 'Вы вошли в эфир с другого устройства.';
        default:
            return null;
    }
}

function scheduleReconnect() {
    if (leaving) return;
    if (reconnectStart == null) reconnectStart = Date.now();
    if (Date.now() - reconnectStart > RECONNECT_WINDOW_MS) {
        errorMsg.value = 'Не удалось переподключиться. Проверьте интернет и попробуйте снова.';
        phase.value = 'error';
        return;
    }
    const delay = Math.min(30000, 1000 * 2 ** reconnectAttempt);
    reconnectAttempt += 1;
    phase.value = 'reconnecting';
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => connect(), delay);
}

function onRoomDisconnected(reason) {
    if (leaving || reason === DisconnectReason.CLIENT_INITIATED) return;
    const term = terminalDisconnectMessage(reason);
    if (term) {
        errorMsg.value = term;
        phase.value = 'error';
        return;
    }
    scheduleReconnect();
}

function reconnect() {
    reconnectStart = null;
    reconnectAttempt = 0;
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    errorMsg.value = null;
    phase.value = 'loading';
    connect();
}

// Controls
function toggleMic() {
    room.value?.localParticipant.setMicrophoneEnabled(!micOn.value).catch(() => {});
}
function toggleCam() {
    const next = !camOn.value;
    userWantsCamera.value = next;
    room.value?.localParticipant.setCameraEnabled(next).catch(() => {});
}
function onPickCam(e) {
    const id = e.target.value;
    selectedCam.value = id;
    room.value?.switchActiveDevice('videoinput', id).catch(() => {});
}
function onPickMic(e) {
    const id = e.target.value;
    selectedMic.value = id;
    room.value?.switchActiveDevice('audioinput', id).catch(() => {});
}
async function toggleScreenShare() {
    const r = room.value;
    if (!r) return;
    try {
        // Video only (no screen audio in v1). getDisplayMedia shows the browser's native picker;
        // if the user cancels or denies it rejects → no-op. Stopping via the browser's own "Stop
        // sharing" bar fires LocalTrackUnpublished → syncParticipants resets screenSharing.
        await r.localParticipant.setScreenShareEnabled(!screenSharing.value);
    } catch {
        /* picker cancelled / permission denied */
    }
}

// ── PDF presentation ──
function startPresentation() {
    if (presenting.value) return;
    if (screenSharing.value) return; // busy with a real screen share (shares the ScreenShare slot)
    fileInput.value?.click();
}

async function onPdfPicked(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // allow re-picking the same file later
    if (!file || !room.value) return;
    try {
        const pdfjsLib = await import('pdfjs-dist');
        // Load the worker via Vite's ?worker (bundled as a regular .js chunk + used through
        // workerPort) instead of ?url — the latter emits a .mjs, which the prod nginx serves as
        // application/octet-stream and the browser refuses for a module worker. One worker, reused.
        if (!pdfjsLib.GlobalWorkerOptions.workerPort) {
            const PdfWorker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?worker')).default;
            pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();
        }
        const buf = await file.arrayBuffer();
        pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
        pageCount.value = pdfDoc.numPages;
        pageNum.value = 1;
        await renderPage(1);
        // Publish the canvas as a screen-share-source track (spotlight everywhere, no egress change).
        // Manual capture (fps 0): frames are emitted ONLY on requestFrame(), read straight from the
        // canvas backing store — independent of rAF/compositing (an off-screen canvas may not tick
        // rAF, which left the auto-sampled stream black). We push a frame after every render.
        presStream = presCanvas.value.captureStream(0);
        presMst = presStream.getVideoTracks()[0];
        pushFrame();
        await room.value.localParticipant.publishTrack(presMst, {
            source: Track.Source.ScreenShare,
            name: 'presentation',
        });
        pushFrame(); // once more now that subscribers exist
        // A static slide emits no frames on its own; re-push periodically so late subscribers and
        // the egress composite always have the current slide.
        presKeepAlive = setInterval(pushFrame, 2000);
        presenting.value = true;
    } catch {
        window.alert('Не удалось открыть PDF.');
        await stopPresentation();
    }
}

function pushFrame() {
    if (presMst && typeof presMst.requestFrame === 'function') presMst.requestFrame();
}

async function renderPage(n) {
    if (!pdfDoc || !presCanvas.value) return;
    const page = await pdfDoc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    // Render the slide to an OFF-DOM scratch canvas first (fit inside PRES_W×PRES_H, keep aspect).
    // The visible capture canvas is never shown in the white-cleared / half-painted intermediate
    // state — so viewers never catch the blank frame the old code exposed during the async render.
    const scale = Math.min(PRES_W / base.width, PRES_H / base.height);
    const vp = page.getViewport({ scale });
    if (!presRenderCanvas) presRenderCanvas = document.createElement('canvas');
    const rc = presRenderCanvas;
    rc.width = Math.round(vp.width);
    rc.height = Math.round(vp.height);
    const rctx = rc.getContext('2d');
    rctx.fillStyle = '#fff';
    rctx.fillRect(0, 0, rc.width, rc.height);
    await page.render({ canvasContext: rctx, viewport: vp }).promise;
    // Blit onto the FIXED-size capture canvas in one synchronous paint, letterbox-centered on black.
    // Dimensions set once and never changed → the published track keeps a constant resolution → no
    // mid-stream renegotiation (the real cause of the white screen on slide change).
    const c = presCanvas.value;
    if (c.width !== PRES_W || c.height !== PRES_H) { c.width = PRES_W; c.height = PRES_H; }
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, PRES_W, PRES_H);
    ctx.drawImage(rc, Math.round((PRES_W - rc.width) / 2), Math.round((PRES_H - rc.height) / 2), rc.width, rc.height);
}

async function gotoPage(delta) {
    const next = pageNum.value + delta;
    if (next < 1 || next > pageCount.value) return;
    pageNum.value = next;
    await renderPage(next); // redraw → push the new frame to all viewers + composite
    pushFrame();
}

async function stopPresentation() {
    if (presKeepAlive) {
        clearInterval(presKeepAlive);
        presKeepAlive = null;
    }
    try {
        if (presMst && room.value) room.value.localParticipant.unpublishTrack(presMst, true);
    } catch {
        /* ignore */
    }
    try {
        presStream && presStream.getTracks().forEach((t) => t.stop());
    } catch {
        /* ignore */
    }
    try {
        pdfDoc && pdfDoc.destroy();
    } catch {
        /* ignore */
    }
    presStream = null;
    presMst = null;
    pdfDoc = null;
    presRenderCanvas = null;
    presenting.value = false;
    pageCount.value = 0;
    pageNum.value = 1;
}

function leave() {
    leaving = true;
    teardownRoom();
    router.push(streamId ? `/streams?stream=${streamId}` : '/streams');
}

// Roster (owner)
async function toggleRoster() {
    rosterOpen.value = !rosterOpen.value;
    if (rosterOpen.value) {
        try {
            cohosts.value = await listCohosts(supa(), streamId);
        } catch {
            cohosts.value = [];
        }
    }
}
async function invite() {
    const email = inviteEmail.value.trim();
    if (!email || !email.includes('@')) return;
    inviting.value = true;
    try {
        await inviteCohost(supa(), streamId, email);
        inviteEmail.value = '';
        cohosts.value = await listCohosts(supa(), streamId);
    } catch (e) {
        const msg =
            e instanceof LiveApiError && e.code === 'user_not_found'
                ? 'Пользователь с таким e-mail не зарегистрирован.'
                : e?.message || 'Не удалось пригласить.';
        window.alert(msg);
    } finally {
        inviting.value = false;
    }
}
async function removeCohostRoom(c) {
    removingId.value = c.id;
    try {
        await removeCohost(supa(), streamId, c.user);
        confirmRemoveId.value = null;
        cohosts.value = await listCohosts(supa(), streamId).catch(() => cohosts.value);
    } catch (e) {
        window.alert(e.message || 'Не удалось удалить.');
    } finally {
        removingId.value = null;
    }
}
function statusLabel(c) {
    if (c.role === 'owner') return 'Владелец';
    return c.status === 'joined' ? 'В эфире' : 'Приглашён';
}

// Teardown — shared by unmount / route-leave. beforeunload only best-effort disconnects.
function teardownRoom() {
    stopPresentation();
    const r = room.value;
    if (r) {
        try {
            r.disconnect();
        } catch {
            /* ignore */
        }
    }
    audioEls.forEach((el) => el.parentNode && el.parentNode.removeChild(el));
    audioEls.clear();
    room.value = null;
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
    }
    releaseWakeLock();
    stopChatPoll();
}

onMounted(() => {
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', beforeUnloadHandler);
    connect();
});

onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    leaving = true;
    teardownRoom();
});

onBeforeRouteLeave(() => {
    leaving = true;
    teardownRoom();
});
</script>

<style scoped>
.lkc {
    position: fixed;
    inset: 0;
    background: #0b0f1a;
    display: flex;
    flex-direction: column;
    font-family: 'Raleway', sans-serif;
}
.lkc-center {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    color: #fff;
    padding: 24px;
    text-align: center;
}
.lkc-center__icon {
    font-size: 40px;
}
.lkc-center__text {
    color: #cbd5e1;
    margin: 0;
}
.lkc-spinner {
    width: 42px;
    height: 42px;
    border: 4px solid rgba(255, 255, 255, 0.25);
    border-top-color: #2563eb;
    border-radius: 50%;
    animation: lkc-spin 0.9s linear infinite;
}
@keyframes lkc-spin {
    to {
        transform: rotate(360deg);
    }
}
.lkc-banner {
    text-align: center;
    background: #f59e0b;
    color: #111;
    padding: 6px;
    font-size: 13px;
}
.lkc-grid {
    flex: 1;
    display: grid;
    gap: 10px;
    padding: 12px 12px 100px;
    overflow-y: auto;
    /* Center the tiles both ways so a 1–2 person call doesn't hug the top-left. */
    align-content: center;
    justify-content: center;
    grid-auto-rows: min-content;
    grid-template-columns: repeat(2, min(46vw, 620px));
}
.lkc-grid--1 {
    /* Also cap width by the available height so the 16:9 tile fits above the controls and centers. */
    grid-template-columns: min(92vw, 960px, calc((100vh - 170px) * 16 / 9));
}
.lkc-grid--3 {
    grid-template-columns: repeat(3, min(31vw, 460px));
}
/* Screen-share spotlight: big shared screen on top, small camera strip below. */
.lkc-stage {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 12px 100px;
}
.lkc-spotlight {
    flex: 1;
    min-height: 0;
    display: flex;
}
.lkc-spotlight :deep(.lkc-tile) {
    aspect-ratio: auto;
    width: 100%;
    height: 100%;
}
.lkc-strip {
    flex: 0 0 auto;
    height: 96px;
    display: flex;
    gap: 8px;
    overflow-x: auto;
}
.lkc-strip :deep(.lkc-tile) {
    aspect-ratio: 16 / 9;
    width: auto;
    height: 100%;
    flex: 0 0 auto;
}
.lkc-ctrl.on {
    background: #2563eb;
}
/* Rendered (so Chrome composites it for captureStream) but off-screen. */
.lkc-offscreen {
    position: fixed;
    left: -100000px;
    top: 0;
    pointer-events: none;
    opacity: 0.01;
}
.lkc-ctrl:disabled {
    opacity: 0.4;
    cursor: default;
}
.lkc-presbar {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: 84px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    font-family: 'Raleway', sans-serif;
}
.lkc-navbtn {
    border: none;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.16);
    color: #fff;
    border-radius: 8px;
    padding: 6px 12px;
    font-size: 15px;
}
.lkc-navbtn:disabled {
    opacity: 0.4;
    cursor: default;
}
.lkc-navbtn--stop {
    background: #dc2626;
}
.lkc-navlabel {
    min-width: 52px;
    text-align: center;
    font-size: 14px;
}
.lkc-controls {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 10px;
    padding: 14px;
    background: rgba(0, 0, 0, 0.4);
}
.lkc-ctrl {
    width: 52px;
    height: 52px;
    border-radius: 26px;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.16);
    color: #fff;
}
.lkc-ic {
    width: 22px;
    height: 22px;
    display: block;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
}
.lkc-ctrl.off {
    background: rgba(255, 255, 255, 0.32);
}
.lkc-ctrl--danger {
    background: #dc2626;
}
.lkc-select {
    height: 40px;
    max-width: 180px;
    border-radius: 10px;
    border: none;
    padding: 0 8px;
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
}
.lkc-select option {
    color: #111;
}
.lkc-btn {
    padding: 10px 18px;
    border-radius: 999px;
    border: none;
    cursor: pointer;
    background: #2563eb;
    color: #fff;
    font-weight: 700;
}
.lkc-btn--ghost {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.4);
}
/* chat toggle button + unread badge */
.lkc-ctrl--chat {
    position: relative;
}
.lkc-ctrl__badge {
    position: absolute;
    top: -2px;
    right: -2px;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border-radius: 9px;
    background: #dc2626;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
}
/* chat panel — same side-drawer footprint as the roster */
.lkc-chat {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 96px;
    width: min(360px, 90vw);
    background: #12172a;
    color: #fff;
    display: flex;
    flex-direction: column;
    box-shadow: -8px 0 24px rgba(0, 0, 0, 0.4);
    z-index: 5;
}
.lkc-chat__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.lkc-chat__feed {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.lkc-chat__muted {
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
    margin: auto 0;
    text-align: center;
}
.lkc-chat__row {
    display: flex;
    gap: 8px;
    align-items: flex-start;
}
.lkc-chat__row.mine {
    flex-direction: row-reverse;
}
.lkc-chat__ava {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
    flex: none;
}
.lkc-chat__ava--empty {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #2a3458;
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
}
.lkc-chat__bubble {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 6px 10px;
    max-width: 78%;
}
.lkc-chat__row.mine .lkc-chat__bubble {
    background: #2563eb;
}
.lkc-chat__meta {
    display: flex;
    gap: 8px;
    align-items: baseline;
    margin-bottom: 2px;
}
.lkc-chat__name {
    font-size: 12px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.85);
}
.lkc-chat__time {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
}
.lkc-chat__text {
    font-size: 14px;
    line-height: 1.35;
    word-break: break-word;
    white-space: pre-wrap;
}
.lkc-chat__composer {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
}
.lkc-chat__input {
    flex: 1;
    min-width: 0;
    resize: none;
    border-radius: 10px;
    border: none;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    font: inherit;
    max-height: 120px;
}
.lkc-chat__input::placeholder {
    color: rgba(255, 255, 255, 0.45);
}
.lkc-roster {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 96px;
    width: min(340px, 88vw);
    background: #12172a;
    color: #fff;
    padding: 16px;
    overflow-y: auto;
    box-shadow: -8px 0 24px rgba(0, 0, 0, 0.4);
}
.lkc-roster__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
}
.lkc-x {
    background: none;
    border: none;
    color: #fff;
    font-size: 18px;
    cursor: pointer;
}
.lkc-roster__invite {
    display: flex;
    gap: 8px;
    margin-bottom: 14px;
}
.lkc-input {
    flex: 1;
    height: 40px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
    padding: 0 10px;
}
.lkc-roster__list {
    list-style: none;
    margin: 0;
    padding: 0;
}
.lkc-roster__list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.lkc-roster__name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.lkc-roster__status {
    font-size: 12px;
    color: #93c5fd;
    margin: 0 8px;
}
.lkc-roster__remove {
    display: inline-flex;
    gap: 8px;
    flex-shrink: 0;
}
.lkc-link-danger,
.lkc-link-muted {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-size: 13px;
}
.lkc-link-danger {
    color: #f87171;
}
.lkc-link-muted {
    color: #94a3b8;
}
</style>
