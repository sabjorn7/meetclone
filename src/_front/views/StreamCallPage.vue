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
                <p class="lkc-center__text">Подключение к эфиру…</p>
            </template>
        </div>

        <!-- Room -->
        <template v-else>
            <div v-if="reconnecting" class="lkc-banner">Переподключение…</div>

            <div class="lkc-grid" :class="gridClass">
                <StreamTile v-for="p in participants" :key="p.sid" :entry="p" />
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
                    </li>
                </ul>
            </div>

            <!-- Controls -->
            <div class="lkc-controls">
                <button class="lkc-ctrl" :class="{ off: !micOn }" title="Микрофон" @click="toggleMic">
                    {{ micOn ? '🎙' : '🔇' }}
                </button>
                <button class="lkc-ctrl" :class="{ off: !camOn }" title="Камера" @click="toggleCam">
                    {{ camOn ? '📹' : '🚫' }}
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

                <button
                    v-if="isOwner"
                    class="lkc-ctrl"
                    title="Со-ведущие"
                    @click="toggleRoster"
                >
                    👥
                </button>
                <button class="lkc-ctrl lkc-ctrl--danger" title="Выйти" @click="leave">✕</button>
            </div>
        </template>

        <!-- Hidden container for remote audio elements -->
        <div ref="audioBox" style="display: none"></div>
    </div>
</template>

<script setup>
import { ref, shallowRef, computed, onMounted, onBeforeUnmount, markRaw } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import { Room, RoomEvent, Track } from 'livekit-client';

import { getLiveToken, inviteCohost, LiveApiError } from '@/_front/streams/liveApi.js';
import { listCohosts } from '@/_front/streams/cohosts.js';
import StreamTile from './StreamTile.vue';

const supa = () => window.wwLib?.wwPlugins?.supabase?.instance;

const route = useRoute();
const router = useRouter();
const streamId = String(route.query.stream || '');

const room = shallowRef(null); // LiveKit Room — NOT deeply reactive
const phase = ref('loading'); // loading | connecting | connected | error
const errorMsg = ref(null);
const reconnecting = ref(false);

const participants = ref([]); // flat plain snapshots (see snapshot())
const micOn = ref(true);
const camOn = ref(true);
const userWantsCamera = ref(true); // intent — survives the background camera suspend
const role = ref('cohost');

const devices = ref({ cams: [], mics: [] });
const selectedCam = ref('');
const selectedMic = ref('');

// Owner roster
const rosterOpen = ref(false);
const cohosts = ref([]);
const inviteEmail = ref('');
const inviting = ref(false);

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

function snapshot(p, isLocal) {
    const camPub = p.getTrackPublication(Track.Source.Camera);
    return {
        sid: p.sid,
        identity: p.identity,
        name: p.name || p.identity,
        isLocal,
        speaking: p.isSpeaking,
        micEnabled: p.isMicrophoneEnabled,
        hasCamera: !!camPub && !!camPub.track && !camPub.isMuted,
        participant: markRaw(p),
    };
}

function syncParticipants() {
    const r = room.value;
    if (!r) return;
    participants.value = [
        snapshot(r.localParticipant, true),
        ...[...r.remoteParticipants.values()].map((p) => snapshot(p, false)),
    ];
    micOn.value = r.localParticipant.isMicrophoneEnabled;
    camOn.value = r.localParticipant.isCameraEnabled;
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

async function connect() {
    if (!streamId) {
        errorMsg.value = 'Не указан эфир.';
        phase.value = 'error';
        return;
    }
    phase.value = 'connecting';
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
        syncParticipants();
        loadDevices();
    } catch (e) {
        errorMsg.value = e instanceof LiveApiError ? e.message : e?.message || 'Не удалось подключиться к эфиру.';
        phase.value = 'error';
    }
}

let leaving = false;
function onRoomDisconnected() {
    if (leaving) return; // user-initiated → handled by leave()
    errorMsg.value = 'Соединение потеряно.';
    phase.value = 'error';
}

function reconnect() {
    teardownRoom();
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
    grid-template-columns: min(92vw, 960px);
}
.lkc-grid--3 {
    grid-template-columns: repeat(3, min(31vw, 460px));
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
    font-size: 20px;
    background: rgba(255, 255, 255, 0.16);
    color: #fff;
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
.lkc-roster__status {
    font-size: 12px;
    color: #93c5fd;
}
</style>
