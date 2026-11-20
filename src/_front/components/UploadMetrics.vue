<template>
    <div class="upload-metrics" aria-label="Показатели загрузки видео">
        <span>{{ view.volume }}</span>
        <span>{{ view.status || view.speed }}</span>
        <span v-if="view.eta">{{ view.eta }}</span>
    </div>
</template>
<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { uploadMetricView } from '../streams/uploadMetrics.js';
const props = defineProps({ metrics: { type: Object, default: null } });
const clock = ref(performance.now()), invalidatedAt = ref(-Infinity), unavailable = ref(false);
let timer, lastTick = performance.now();
function invalidate() {
    invalidatedAt.value = performance.now();
    unavailable.value = document.hidden || navigator.onLine === false;
    clock.value = performance.now();
}
onMounted(() => {
    unavailable.value = document.hidden || navigator.onLine === false;
    document.addEventListener('visibilitychange', invalidate);
    window.addEventListener('offline', invalidate); window.addEventListener('online', invalidate);
    timer = setInterval(() => {
        const current = performance.now();
        if (current - lastTick > 3000 || current < lastTick) invalidate();
        lastTick = current; clock.value = current;
    }, 1000);
});
onUnmounted(() => {
    clearInterval(timer); document.removeEventListener('visibilitychange', invalidate);
    window.removeEventListener('offline', invalidate); window.removeEventListener('online', invalidate);
});
const view = computed(() => uploadMetricView(props.metrics, clock.value, invalidatedAt.value, unavailable.value));
</script>
<style scoped>
.upload-metrics { display: flex; flex-wrap: wrap; gap: 4px 16px; color: var(--ink-2, #515b6b); font-size: 0.82rem; line-height: 1.5; font-variant-numeric: tabular-nums; }
</style>
