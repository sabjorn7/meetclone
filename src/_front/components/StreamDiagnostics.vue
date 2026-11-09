<template>
    <div class="sq-diag">
        <p v-if="room">Камера: {{ cameraLabel || 'Недоступно' }} · Захват: {{ size(capture.width, capture.height) }} · {{ format(capture.frameRate, 'FPS') }}</p>
        <p v-if="warning" role="status">{{ warning }}</p>
        <details @toggle="toggle">
            <summary>Диагностика качества трансляции</summary>
            <section v-if="room" aria-label="Захват камеры">
                <h3>Захват камеры</h3>
                <p>Запрошено: {{ requested.label }} / {{ requested.fps }} FPS. Параметры устройства: {{ size(capture.width, capture.height) }} / {{ format(capture.frameRate, 'FPS') }}.</p>
                <p>Параметры устройства не являются измерением отправки кадров.</p>
            </section>
            <section v-if="room" aria-label="Отправка LiveKit">
                <h3>Отправка LiveKit</h3>
                <p>Соединение: {{ connection || 'Недоступно' }}.</p>
                <ul v-if="layers.length" class="sq-layers"><li v-for="layer in layers" :key="layer.key">
                    <strong>{{ layer.source }} · {{ layer.label }}</strong>
                    <p>{{ stateLabel(layer) }}</p>
                    <template v-if="!localStale(layer)">
                        <p>Отправленные кадры: {{ size(layer.width, layer.height) }} · {{ format(layer.fps, 'FPS', 1) }} · {{ format(layer.bitrate == null ? null : layer.bitrate / 1000000, 'Мбит/с', 2) }}.</p>
                        <p>Причина ограничения браузера: {{ layer.limitation || 'Недоступно' }}.</p>
                        <p>Обратная связь LiveKit (RTCP): {{ remoteFresh(layer) ? 'свежая' : 'устарела или недоступна' }}.</p>
                        <p>Jitter на приёме LiveKit: {{ format(remoteFresh(layer) ? layer.jitterMs : null, 'мс') }}. RTT до LiveKit: {{ format(remoteFresh(layer) ? layer.rttMs : null, 'мс') }}.</p>
                        <p>Потери по последнему RTCP-отчёту: {{ format(remoteFresh(layer) ? layer.lossPercent : null, '%', 1) }}.</p>
                    </template>
                    <small>Stats ID: {{ layer.id }}</small>
                </li></ul>
                <p v-else>Параметры отправки: недоступно.</p>
                <p>FPS и битрейт рассчитаны по приросту счётчиков. Нулевая отправка не устанавливает причину остановки.</p>
            </section>
            <section aria-label="Egress">
                <h3>Egress</h3>
                <p>Состояние: {{ egressFresh ? egress.state : egress ? 'Данные устарели' : 'Недоступно' }}.</p>
                <template v-if="egressFresh">
                    <p>Настроенный профиль: {{ egress.profile?.label || 'Недоступно' }}.</p>
                    <p>Заданный выход: {{ egress.profile ? `${egress.profile.width}×${egress.profile.height} / ${egress.profile.fps} FPS` : 'Недоступно' }}; целевой битрейт {{ format(egress.profile ? egress.profile.egressBitrate / 1000000 : null, 'Мбит/с', 1) }}.</p>
                    <p v-if="egress.error">Ошибка Egress: {{ egress.error }}</p>
                </template>
                <p v-if="egressError" role="status">Не удалось обновить состояние Egress.</p>
                <p>Измеренные вход, выход, битрейт и CPU/RAM Egress: недоступно.</p>
            </section>
            <section aria-label="Качество у зрителя">
                <h3>Качество у зрителя</h3>
                <p>Фактическое разрешение, FPS и битрейт у зрителя: недоступно.</p>
                <p>Захват камеры и заданный профиль Egress не подтверждают качество у зрителя.</p>
            </section>
        </details>
    </div>
</template>
<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { Track } from 'livekit-client';
import { videoProfile, captureWarning } from '../streams/videoQuality.js';
import { summarizeVideoStats, STATS_MAX_AGE_MS, LAYER_STATES } from '../streams/videoStats.js';
import { getLiveQuality } from '../streams/liveApi.js';
const props = defineProps({ room: Object, profile: { type: String, default: 'hd' }, streamId: String });
const capture = ref({}), cameraLabel = ref(''), connection = ref(null), layers = ref([]), egress = ref(null), egressError = ref(false);
const clock = () => performance.timeOrigin + performance.now();
const now = ref(clock()), egressAt = ref(null), egressValid = ref(false);
const requested = computed(() => videoProfile(props.profile));
const warning = computed(() => props.room?.localParticipant.isCameraEnabled ? captureWarning(capture.value, props.profile) : '');
const egressFresh = computed(() => opened.value && egressValid.value && egress.value && egressAt.value !== null && now.value - egressAt.value <= STATS_MAX_AGE_MS);
const opened = ref(false);
let timer, serverTimer, ageTimer, localBusy = false, serverBusy = false, disposed = false, generation = 0, serverGeneration = 0, previous = new Map();
const format = (v, unit, digits = 0) => typeof v === 'number' && Number.isFinite(v) ? `${v.toFixed(digits)} ${unit}` : 'Недоступно';
const size = (w, h) => Number.isFinite(w) && Number.isFinite(h) ? `${w}×${h}` : 'Недоступно';
const localStale = l => !opened.value || now.value - l.sampledAt > STATS_MAX_AGE_MS || l.state === 'stale';
const remoteFresh = l => !localStale(l) && l.remoteFresh && l.remoteAgeMs + now.value - l.sampledAt <= STATS_MAX_AGE_MS;
const stateLabel = l => LAYER_STATES[localStale(l) ? 'stale' : l.state] || LAYER_STATES.unknown;
const publication = source => props.room?.localParticipant.getTrackPublication(source)?.track;
async function boundedStats(track) {
    let timeout;
    try { return await Promise.race([track.getRTCStatsReport(), new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Stats unavailable')), 5000); })]); }
    finally { clearTimeout(timeout); }
}
async function sample() {
    if (localBusy || disposed) return; localBusy = true;
    const version = generation, room = props.room;
    try {
        const camera = publication(Track.Source.Camera);
        connection.value = room?.state || null;
        capture.value = camera?.mediaStreamTrack?.getSettings?.() || {};
        cameraLabel.value = camera?.mediaStreamTrack?.label || '';
        if (!opened.value || !room || room.state !== 'connected') { layers.value = []; previous.clear(); return; }
        const sources = [['Камера', Track.Source.Camera, camera], ['Экран/PDF', Track.Source.ScreenShare, publication(Track.Source.ScreenShare)]].filter(([, , track]) => track);
        const alive = new Set(sources.map(([, , track]) => track));
        for (const track of previous.keys()) if (!alive.has(track)) previous.delete(track);
        const collected = [];
        await Promise.all(sources.map(async ([source, kind, track]) => {
            try {
                if (!track.getRTCStatsReport) return;
                const report = await boundedStats(track);
                if (disposed || version !== generation || room !== props.room || publication(kind) !== track || !opened.value) return;
                const sampledAt = clock();
                const stats = summarizeVideoStats(report, previous.get(track), { now: sampledAt, encodings: track.sender?.getParameters?.()?.encodings || [] });
                previous.set(track, stats.previous);
                collected.push(...stats.layers.map(layer => ({ ...layer, source, sampledAt, key: `${source}:${layer.id}` })));
            } catch { previous.delete(track); }
        }));
        if (!disposed && version === generation && opened.value) layers.value = collected;
    } catch { if (!disposed && version === generation) { layers.value = []; previous.clear(); } }
    finally { localBusy = false; }
}
async function sampleEgress() {
    if (!opened.value || !props.streamId || serverBusy || disposed) return;
    serverBusy = true; const version = serverGeneration, id = props.streamId;
    try {
        const result = await getLiveQuality(window.wwLib?.wwPlugins?.supabase?.instance, id);
        if (!disposed && version === serverGeneration && props.streamId === id && opened.value) {
            egress.value = result; egressAt.value = clock(); egressValid.value = true; egressError.value = false;
        }
    } catch { if (!disposed && version === serverGeneration) { egressError.value = true; egressValid.value = false; } }
    finally { serverBusy = false; }
}
function reset() { generation++; previous = new Map(); layers.value = []; }
function resetEgress() { serverGeneration++; egress.value = null; egressAt.value = null; egressValid.value = false; egressError.value = false; }
function toggle(event) {
    opened.value = event.target.open; reset(); resetEgress();
    if (opened.value) { sample(); sampleEgress(); }
}
watch(() => props.room, () => { reset(); capture.value = {}; cameraLabel.value = ''; sample(); });
watch(() => props.streamId, () => { resetEgress(); sampleEgress(); });
watch(() => props.room?.state, state => { if (state !== 'connected') reset(); });
onMounted(() => { sample(); timer = setInterval(sample, 3000); serverTimer = setInterval(sampleEgress, 5000); ageTimer = setInterval(() => { now.value = clock(); }, 1000); });
onBeforeUnmount(() => { disposed = true; generation++; serverGeneration++; clearInterval(timer); clearInterval(serverTimer); clearInterval(ageTimer); });
</script>
<style scoped>
.sq-diag { padding: 8px 16px; font-size: 14px; line-height: 1.5; background: #fff; color: #17233e; overflow-wrap: anywhere; }
.sq-diag p { margin: 5px 0; }
.sq-diag details { max-height: 60vh; overflow: auto; }
.sq-diag summary { cursor: pointer; }
.sq-diag section { padding: 12px 0; border-top: 1px solid #e4e9f1; }
.sq-diag h3 { font-size: 15px; margin: 0 0 8px; }
.sq-layers { list-style: none; padding: 0; margin: 0; }
.sq-layers li { padding: 10px 0; border-bottom: 1px solid #e4e9f1; }
.sq-diag small { display: block; }
</style>
