<!--
  MetricChart.vue — thin, reusable Chart.js v4 wrapper for the admin dashboard.
  Props: type ('line'|'bar'), labels[], datasets[] (Chart.js dataset objects), optional yMax.
  Recreates the chart when type changes; updates in place when labels/datasets change.
-->
<template>
    <div class="mc"><canvas ref="cv"></canvas></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import {
    Chart, LineController, BarController, LineElement, BarElement,
    PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler,
} from 'chart.js';

Chart.register(
    LineController, BarController, LineElement, BarElement,
    PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler,
);

const props = defineProps({
    type: { type: String, default: 'line' },
    labels: { type: Array, default: () => [] },
    datasets: { type: Array, default: () => [] },
    yMax: { type: Number, default: undefined },
});

const cv = ref(null);
let chart = null;

const baseOptions = () => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
        legend: { display: props.datasets.length > 1, labels: { boxWidth: 12, font: { size: 12 } } },
        tooltip: {
            backgroundColor: '#0b1f4d', padding: 10, cornerRadius: 8, titleFont: { size: 12 }, bodyFont: { size: 13 },
        },
    },
    scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10, color: '#8a94a6', font: { size: 11 } } },
        y: { beginAtZero: true, suggestedMax: props.yMax, grid: { color: '#eef1f5' }, border: { display: false }, ticks: { precision: 0, color: '#8a94a6', font: { size: 11 } } },
    },
});

function build() {
    if (!cv.value) return;
    chart = new Chart(cv.value.getContext('2d'), {
        type: props.type,
        data: { labels: [...props.labels], datasets: props.datasets.map((d) => ({ ...d })) },
        options: baseOptions(),
    });
}
function refresh() {
    if (!chart) return;
    chart.data.labels = [...props.labels];
    chart.data.datasets = props.datasets.map((d) => ({ ...d }));
    chart.options = baseOptions();
    chart.update();
}

onMounted(build);
onBeforeUnmount(() => { if (chart) { chart.destroy(); chart = null; } });
watch(() => props.type, () => { if (chart) { chart.destroy(); chart = null; } build(); });
watch([() => props.labels, () => props.datasets], refresh, { deep: true });
</script>

<style scoped>
.mc { position: relative; width: 100%; height: 100%; min-height: 260px; }
</style>
