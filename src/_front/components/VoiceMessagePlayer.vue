<template>
    <div class="vmp" :class="{ 'vmp--mine': mine, 'vmp--failed': decodeFailed }">
        <button type="button" class="vmp__btn" :aria-label="playing ? 'Пауза' : 'Воспроизвести'" @click="toggle">
            <svg v-if="!playing" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
        </button>
        <div
            ref="barsEl" class="vmp__wave" role="slider" aria-label="Перемотка"
            :aria-valuenow="Math.round(progress * 100)" aria-valuemin="0" aria-valuemax="100"
            @click="onSeek"
        >
            <span
                v-for="(h, i) in displayBars" :key="i" class="vmp__bar"
                :class="{ 'is-played': (i + 0.5) / displayBars.length <= progress }"
                :style="{ height: (18 + h * 82) + '%' }"
            ></span>
        </div>
        <span class="vmp__time">{{ timeLabel }}</span>
        <audio
            ref="audioEl" class="vmp__audio" :src="src" preload="none"
            @timeupdate="onTimeUpdate" @play="onPlay" @pause="onPause" @ended="onEnded" @loadedmetadata="onLoadedMeta"
        ></audio>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { buildWaveform } from '@/_front/helpers/waveform.js';
import { setActive, clearActive, getAudioContext, decodeAudio } from '@/_front/helpers/voicePlayback.js';

const props = defineProps({
    src: { type: String, required: true },
    mine: { type: Boolean, default: false },
    bars: { type: Number, default: 56 },
});

const audioEl = ref(null);
const barsEl = ref(null);
const playing = ref(false);
const currentTime = ref(0);
const duration = ref(0);          // authoritative — from the decoded buffer
const waveBars = ref([]);
const decodeFailed = ref(false);
let decodeStarted = false;
let abort = null;
let io = null;

const PLACEHOLDER = Array.from({ length: 56 }, () => 0.3);
const displayBars = computed(() => (waveBars.value.length ? waveBars.value : PLACEHOLDER));
const progress = computed(() => (duration.value > 0 ? Math.min(1, currentTime.value / duration.value) : 0));

function fmt(s) {
    if (!Number.isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
}
const timeLabel = computed(() => fmt((playing.value || currentTime.value > 0) ? currentTime.value : duration.value));

// ── waveform decode (lazy: on first viewport entry, or on first play) ────────
async function decode() {
    if (decodeStarted) return;
    decodeStarted = true;
    const ctx = getAudioContext();
    if (!ctx) { decodeFailed.value = true; return; }
    abort = new AbortController();
    try {
        const res = await fetch(props.src, { signal: abort.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arr = await res.arrayBuffer();
        const buf = await decodeAudio(ctx, arr);
        waveBars.value = buildWaveform(buf.getChannelData(0), props.bars);
        if (buf.duration && Number.isFinite(buf.duration)) duration.value = buf.duration;
    } catch (e) {
        if (e?.name !== 'AbortError') decodeFailed.value = true;
    }
}

// ── playback (native <audio>; controls hidden) ──────────────────────────────
function stop() { const el = audioEl.value; if (el && !el.paused) el.pause(); }
function toggle() {
    const el = audioEl.value;
    if (!el) return;
    if (el.paused) { setActive(stop); el.play().catch(() => { /* gesture/format */ }); if (!decodeStarted) decode(); }
    else el.pause();
}
function onPlay() { playing.value = true; }
function onPause() { playing.value = false; clearActive(stop); }
function onEnded() { playing.value = false; currentTime.value = 0; const el = audioEl.value; if (el) el.currentTime = 0; clearActive(stop); }
function onTimeUpdate() { const el = audioEl.value; if (el) currentTime.value = el.currentTime; }
function onLoadedMeta() {
    // Fallback duration if decode hasn't set it and the element reports a finite one
    // (webm/opus from MediaRecorder often reports Infinity — hence decoded duration is primary).
    const el = audioEl.value;
    if (duration.value <= 0 && el && Number.isFinite(el.duration)) duration.value = el.duration;
}
function onSeek(e) {
    const wrap = barsEl.value; const el = audioEl.value;
    if (!wrap || !el || duration.value <= 0) return;
    const rect = wrap.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const t = frac * duration.value;
    try { el.currentTime = t; } catch (err) { /* seek before buffered */ }
    currentTime.value = t;
}

onMounted(() => {
    if (typeof IntersectionObserver !== 'undefined' && barsEl.value) {
        io = new IntersectionObserver((entries) => {
            if (entries.some((en) => en.isIntersecting)) { decode(); io?.disconnect(); io = null; }
        }, { threshold: 0.1 });
        io.observe(barsEl.value);
    } else {
        decode();
    }
});
onBeforeUnmount(() => {
    stop(); clearActive(stop);
    if (abort) { try { abort.abort(); } catch (e) { /* noop */ } }
    if (io) { try { io.disconnect(); } catch (e) { /* noop */ } io = null; }
});
</script>

<style scoped>
.vmp { display: flex; align-items: center; gap: 10px; width: 100%; }
.vmp__btn { width: 34px; height: 34px; flex: none; border: none; border-radius: 50%; background: var(--blue, #2563eb); color: #fff; display: grid; place-items: center; cursor: pointer; }
.vmp--mine .vmp__btn { background: #fff; color: var(--blue, #2563eb); }
.vmp__btn svg { width: 18px; height: 18px; fill: currentColor; }
.vmp__wave { flex: 1; min-width: 0; height: 34px; display: flex; align-items: center; gap: 2px; cursor: pointer; }
.vmp__bar { flex: 1; min-width: 2px; border-radius: 2px; background: var(--ink-3, #94a3b8); opacity: 0.45; }
.vmp__bar.is-played { opacity: 1; background: var(--blue, #2563eb); }
.vmp--mine .vmp__bar { opacity: 1; background: rgba(255, 255, 255, 0.55); }
.vmp--mine .vmp__bar.is-played { background: #fff; }
.vmp--failed .vmp__wave { cursor: default; }
.vmp__time { flex: none; font-size: 0.72rem; color: var(--ink-3, #94a3b8); font-variant-numeric: tabular-nums; min-width: 34px; text-align: right; }
.vmp--mine .vmp__time { color: rgba(255, 255, 255, 0.8); }
.vmp__audio { display: none; }
</style>
