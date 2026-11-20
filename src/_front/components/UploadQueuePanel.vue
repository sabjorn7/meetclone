<template>
    <aside v-if="jobs.length" class="upload-queue" aria-label="Загрузки видео">
        <header><strong>Загрузки видео · {{ pending }}</strong><button type="button" :aria-expanded="!collapsed" @click="collapsed = !collapsed">{{ collapsed ? 'Развернуть' : 'Свернуть' }}</button></header>
        <template v-if="!collapsed">
            <p class="upload-queue__hint">Можно закрыть редактор и перейти на другую страницу сайта. Эту вкладку оставьте открытой.</p>
            <ol>
                <li v-for="job in jobs" :key="job.key">
                    <strong class="upload-queue__title">{{ job.title }}</strong>
                    <span role="status">{{ labels[job.state] || 'Подготовка…' }}</span>
                    <progress v-if="job.metrics" max="100" :value="job.progress" :aria-label="'Загрузка: ' + job.title" />
                    <UploadMetrics v-if="job.metrics && ['uploading','pausing','paused','finalizing','saving'].includes(job.state)" :metrics="job.metrics" />
                    <p v-if="job.error" class="upload-queue__error">{{ job.error }}</p>
                    <div class="upload-queue__actions">
                        <button v-if="['queued','uploading'].includes(job.state)" type="button" @click="act('pause',job.key)">Пауза</button>
                        <button v-if="['paused','pausing','paused_queue'].includes(job.state)" type="button" @click="act('resume',job.key)">Продолжить</button>
                        <button v-if="job.canRetry" type="button" @click="act('retry',job.key)">Повторить</button>
                        <button v-if="!['complete','cancelled','saving','cancelling','interrupted'].includes(job.state)" type="button" @click="cancel(job)">{{ job.state === 'cleanup_error' ? 'Повторить удаление' : 'Отменить загрузку' }}</button>
                        <button v-if="['complete','cancelled','interrupted'].includes(job.state)" type="button" @click="act('dismiss',job.key)">Убрать</button>
                    </div>
                </li>
            </ol>
            <p v-if="actionError" role="status">{{ actionError }}</p>
        </template>
    </aside>
</template>
<script setup>
import {ref, computed} from 'vue';
import {uploadQueueState, getUploadQueue} from '../streams/uploadQueueState.js';
import UploadMetrics from './UploadMetrics.vue';
const jobs = uploadQueueState, collapsed = ref(false), actionError = ref('');
const pending = computed(() => jobs.value.filter(j => !['complete','cancelled'].includes(j.state)).length);
const labels = {queued:'В очереди', preparing:'Подготовка…', uploading:'Загружается', pausing:'Останавливаем после текущего блока…', paused:'На паузе — очередь ждёт продолжения', paused_queue:'В очереди · на паузе', finalizing:'Завершаем передачу…', saving:'Сохраняем видео в урок…', cancelling:'Отмена и удаление…', cancelled:'Отменено', complete:'Видео сохранено', error:'Нужна повторная попытка', cleanup_error:'Не удалось удалить', interrupted:'Загрузка остановлена'};
async function act(action, key) {
    actionError.value = '';
    try { (await getUploadQueue())[action](key); }
    catch (_) { actionError.value = 'Не удалось выполнить действие. Откройте редактор и проверьте загрузку.'; }
}
function cancel(job) {
    if (window.confirm('Отменить эту загрузку и удалить её незавершённые данные? Прежнее видео останется.')) void act('cancel', job.key);
}
</script>
<style scoped>
.upload-queue { position:fixed; right:16px; bottom:calc(16px + env(safe-area-inset-bottom)); z-index:1500; width:min(380px,calc(100vw - 32px)); max-height:65vh; overflow:auto; background:var(--surface,#fff); color:var(--ink,#202936); border:1px solid #dce3eb; border-radius:16px; padding:16px; font-family:var(--font, system-ui, sans-serif); font-size:14px; line-height:1.5; }
header,.upload-queue__actions { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; }
button { font:inherit; color:#2563eb; background:transparent; border:1px solid #dce3eb; border-radius:8px; padding:7px 10px; cursor:pointer; }
button:hover { background:#f1f5fb; } button:focus-visible { outline:2px solid #2563eb; outline-offset:2px; }
ol { list-style:none; padding:0; margin:0; } li { display:grid; gap:8px; padding:12px 0; border-top:1px solid #e6ebf1; }
.upload-queue__title { overflow-wrap:anywhere; } progress { width:100%; height:8px; accent-color:#2563eb; }
.upload-queue__hint { color:#515b6b; font-size:12px; } .upload-queue__error { margin:0; color:#b42318; }
.upload-queue__actions { justify-content:flex-start; }
</style>
