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
                    :class="{ on: screenSharing }"
                    :title="screenSharing ? 'Остановить демонстрацию' : 'Демонстрация экрана'"
                    @click="toggleScreenShare"
                >
                    <svg class="lkc-ic" viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
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
    </div>
</template>

<script setup>
import { ref, shallowRef, computed, onMounted, onBeforeUnmount, markRaw } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import { DisconnectReason, Room, RoomEvent, Track } from 'livekit-client';

import { getLiveToken, inviteCohost, removeCohost, LiveApiError } from '@/_front/streams/liveApi.js';
import { listCohosts } from '@/_front/streams/cohosts.js';
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
const role = ref('cohost');

// Screen share is desktop-only (getDisplayMedia is absent on mobile browsers).
const canScreenShare =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices && !!navigator.mediaDevices.getDisplayMedia;

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

function onVisibility() {
    const r = room.value;
    if (!r) return;
    if (document.visibilityState === 'visible') {
        if (userWantsCamera.value) r.localParticipant.setCameraEnabled(true).catch(() => {});
    } else {
        // Hidden: drop the camera (mirror the mobile compromise), keep the mic → audio continues.
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
