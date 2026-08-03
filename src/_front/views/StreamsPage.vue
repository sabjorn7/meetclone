<template>
    <div class="streams-page">
        <header class="sp-header">
            <a class="sp-back" href="/" @click.prevent="goHome">← На главную</a>
            <h1 class="sp-title">Трансляции</h1>
        </header>

        <div v-if="loading" class="sp-muted">Загрузка…</div>

        <template v-else>
            <!-- Create broadcast (speakers / institutions only) -->
            <section v-if="isStreamer" class="sp-card">
                <div class="sp-card-head">
                    <h2>Начать трансляцию</h2>
                    <button v-if="!showForm" class="sp-btn sp-btn-primary" @click="showForm = true">
                        Начать трансляцию
                    </button>
                </div>

                <form v-if="showForm" class="sp-form" @submit.prevent="createBroadcast">
                    <label class="sp-field">
                        <span>Название</span>
                        <input v-model.trim="form.title" type="text" maxlength="200" placeholder="Например: Разбор кейсов по кинезиологии" required />
                    </label>
                    <label class="sp-field">
                        <span>Описание</span>
                        <textarea v-model.trim="form.description" rows="3" maxlength="2000" placeholder="Коротко о чём эфир"></textarea>
                    </label>
                    <p class="sp-note">На этом этапе эфиры бесплатные. Платные добавим следующим шагом.</p>

                    <div class="sp-form-actions">
                        <button type="submit" class="sp-btn sp-btn-primary" :disabled="creating || !form.title">
                            {{ creating ? 'Создаём эфир…' : 'Создать эфир' }}
                        </button>
                        <button type="button" class="sp-btn sp-btn-secondary" :disabled="creating" @click="cancelForm">
                            Отменить
                        </button>
                    </div>
                </form>

                <p v-if="error" class="sp-error">{{ error }}</p>
            </section>

            <section v-else class="sp-card sp-muted">
                Трансляции могут создавать спикеры и учебные заведения. Здесь появятся эфиры, на которые вы подписаны.
            </section>

            <!-- OBS credentials for the just-created / re-opened stream -->
            <section v-if="creds" class="sp-card sp-creds">
                <div class="sp-card-head">
                    <h2>Данные для OBS</h2>
                    <button class="sp-close" @click="creds = null" aria-label="Закрыть">✕</button>
                </div>
                <p class="sp-muted">«{{ creds.title }}». Вставьте в OBS → Настройки → Трансляция → «Особый…»:</p>
                <div class="sp-cred-row">
                    <span class="sp-cred-label">Сервер (URL)</span>
                    <code class="sp-cred-val">{{ creds.rtmpUrl }}</code>
                    <button class="sp-btn sp-btn-mini" @click="copy(creds.rtmpUrl)">Копировать</button>
                </div>
                <div class="sp-cred-row">
                    <span class="sp-cred-label">Ключ потока</span>
                    <code class="sp-cred-val">{{ maskKey ? '••••••••••••' : creds.streamKey }}</code>
                    <button class="sp-btn sp-btn-mini" @click="maskKey = !maskKey">{{ maskKey ? 'Показать' : 'Скрыть' }}</button>
                    <button class="sp-btn sp-btn-mini" @click="copy(creds.streamKey)">Копировать</button>
                </div>
                <p class="sp-note">Никому не передавайте ключ потока — по нему можно вести эфир от вашего имени.</p>
            </section>

            <!-- Author's own streams -->
            <section v-if="isStreamer" class="sp-card">
                <h2>Мои эфиры</h2>
                <div v-if="!myStreams.length" class="sp-muted">Пока нет созданных эфиров.</div>
                <ul v-else class="sp-list">
                    <li v-for="s in myStreams" :key="s.id" class="sp-item">
                        <div class="sp-item-main">
                            <div class="sp-item-title">{{ s.title }}</div>
                            <div class="sp-item-meta">
                                <span class="sp-badge" :class="'sp-badge-' + s.status">{{ statusLabel(s.status) }}</span>
                                <span>{{ Number(s.price) > 0 ? s.price + ' ₽' : 'бесплатно' }}</span>
                            </div>
                        </div>
                        <div class="sp-item-actions">
                            <button v-if="s.status !== 'live'" class="sp-btn sp-btn-mini" :disabled="busyId === s.id" @click="goLive(s)">Я в эфире</button>
                            <button v-else class="sp-btn sp-btn-mini" :disabled="busyId === s.id" @click="endLive(s)">Завершить</button>
                            <button class="sp-btn sp-btn-mini" :disabled="busyId === s.id" @click="showCreds(s)">Данные OBS</button>
                        </div>
                    </li>
                </ul>
            </section>
        </template>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { createLive, getLiveCredentials } from '@/_front/streams/peertubeLive.js';
import { getCurrentUser, canStream, createStream, listMyStreams, setStreamStatus } from '@/_front/streams/streamsApi.js';

const loading = ref(true);
const me = ref(null);
const myStreams = ref([]);
const showForm = ref(false);
const creating = ref(false);
const busyId = ref(null);
const error = ref('');
const creds = ref(null);
const maskKey = ref(false);
const form = ref({ title: '', description: '' });

const isStreamer = computed(() => canStream(me.value));

function supa() {
    const inst = window.wwLib?.wwPlugins?.supabase?.instance;
    if (!inst) throw new Error('Supabase недоступен на этой странице.');
    return inst;
}

function statusLabel(s) {
    return s === 'live' ? 'В эфире' : s === 'ended' ? 'Завершён' : 'Запланирован';
}
function goHome() {
    window.location.href = '/';
}
async function copy(text) {
    try {
        await navigator.clipboard.writeText(text);
    } catch (_) {
        /* clipboard may be blocked; ignore */
    }
}

async function load() {
    loading.value = true;
    error.value = '';
    try {
        me.value = await getCurrentUser(supa());
        if (isStreamer.value) myStreams.value = await listMyStreams(supa(), me.value.id);
    } catch (e) {
        error.value = e.message || String(e);
    } finally {
        loading.value = false;
    }
}

function cancelForm() {
    showForm.value = false;
    form.value = { title: '', description: '' };
    error.value = '';
}

async function createBroadcast() {
    if (!form.value.title || creating.value) return;
    creating.value = true;
    error.value = '';
    try {
        const live = await createLive(supa(), {
            name: form.value.title,
            description: form.value.description,
            saveReplay: true,
        });
        const row = await createStream(supa(), {
            author: me.value.id,
            title: form.value.title,
            description: form.value.description,
            price: 0,
            peertube_video_id: live.video.uuid,
        });
        myStreams.value.unshift(row);
        creds.value = { title: row.title, rtmpUrl: live.rtmpUrl, streamKey: live.streamKey };
        maskKey.value = false;
        cancelForm();
    } catch (e) {
        error.value = e.message || String(e);
    } finally {
        creating.value = false;
    }
}

async function showCreds(s) {
    busyId.value = s.id;
    error.value = '';
    try {
        const c = await getLiveCredentials(supa(), s.peertube_video_id);
        creds.value = { title: s.title, rtmpUrl: c.rtmpUrl, streamKey: c.streamKey };
        maskKey.value = true;
    } catch (e) {
        error.value = e.message || String(e);
    } finally {
        busyId.value = null;
    }
}

async function goLive(s) {
    busyId.value = s.id;
    try {
        await setStreamStatus(supa(), s.id, 'live');
        s.status = 'live';
    } catch (e) {
        error.value = e.message || String(e);
    } finally {
        busyId.value = null;
    }
}
async function endLive(s) {
    busyId.value = s.id;
    try {
        await setStreamStatus(supa(), s.id, 'ended');
        s.status = 'ended';
    } catch (e) {
        error.value = e.message || String(e);
    } finally {
        busyId.value = null;
    }
}

onMounted(load);
</script>

<style scoped>
.streams-page {
    max-width: 760px;
    margin: 0 auto;
    padding: 24px 16px 64px;
    font-family: inherit;
    color: #1b1f27;
}
.sp-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
}
.sp-back {
    color: #5b6472;
    text-decoration: none;
    font-size: 14px;
}
.sp-back:hover {
    color: #5495f3;
}
.sp-title {
    font-size: 26px;
    font-weight: 600;
    margin: 0;
}
.sp-card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 16px;
}
.sp-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
}
.sp-card h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 4px;
}
.sp-muted {
    color: #6b7280;
    font-size: 14px;
}
.sp-note {
    color: #8a93a2;
    font-size: 13px;
    margin: 8px 0 0;
}
.sp-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
}
.sp-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    color: #374151;
}
.sp-field input,
.sp-field textarea {
    font: inherit;
    font-weight: 400;
    padding: 10px 12px;
    border: 1px solid #d7dee8;
    border-radius: 8px;
    color: #1b1f27;
    resize: vertical;
}
.sp-field input:focus,
.sp-field textarea:focus {
    outline: none;
    border-color: #5495f3;
}
.sp-form-actions {
    display: flex;
    gap: 10px;
}
.sp-btn {
    font: inherit;
    font-weight: 600;
    font-size: 14px;
    border-radius: 8px;
    padding: 9px 18px;
    border: 1px solid transparent;
    cursor: pointer;
}
.sp-btn:disabled {
    opacity: 0.6;
    cursor: default;
}
.sp-btn-primary {
    background: #5495f3;
    color: #fff;
    border-color: #5495f3;
}
.sp-btn-secondary {
    background: #fff;
    color: #5b6472;
    border-color: #d7dee8;
}
.sp-btn-mini {
    padding: 5px 12px;
    font-size: 13px;
    background: #fff;
    color: #5b6472;
    border-color: #d7dee8;
}
.sp-close {
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 16px;
    cursor: pointer;
}
.sp-error {
    color: #e5484d;
    font-size: 14px;
    margin: 12px 0 0;
}
.sp-creds {
    border-color: #cfe0fb;
    background: #f5f9ff;
}
.sp-cred-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin: 10px 0;
}
.sp-cred-label {
    min-width: 110px;
    font-size: 13px;
    font-weight: 600;
    color: #374151;
}
.sp-cred-val {
    flex: 1;
    min-width: 200px;
    background: #fff;
    border: 1px solid #d7dee8;
    border-radius: 6px;
    padding: 7px 10px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px;
    overflow-x: auto;
    white-space: nowrap;
}
.sp-list {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
}
.sp-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 0;
    border-top: 1px solid #eef1f5;
}
.sp-item:first-child {
    border-top: none;
}
.sp-item-title {
    font-weight: 600;
    font-size: 15px;
}
.sp-item-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 4px;
    font-size: 13px;
    color: #6b7280;
}
.sp-item-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
}
.sp-badge {
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
}
.sp-badge-scheduled {
    background: #eef2f7;
    color: #5b6472;
}
.sp-badge-live {
    background: #fdecec;
    color: #e5484d;
}
.sp-badge-ended {
    background: #eef2f7;
    color: #8a93a2;
}
</style>
