<template>
    <div class="streams-page">
        <div class="sp-inner">
        <h1 class="sp-title">Трансляции</h1>

        <!-- ============================ DETAIL VIEW ============================ -->
        <template v-if="activeStreamId">
            <a class="sp-back sp-back-block" href="/streams" @click.prevent="backToList">← К списку эфиров</a>

            <div v-if="detailLoading" class="sp-muted">Загрузка эфира…</div>
            <div v-else-if="!detail" class="sp-card sp-muted">Эфир не найден.</div>

            <template v-else>
                <div class="sp-detail-head">
                    <span class="sp-badge" :class="'sp-badge-' + displayState">{{ displayLabel }}</span>
                    <span class="sp-price">{{ priceLabel(detail) }}</span>
                </div>
                <h2 class="sp-detail-title">{{ detail.title }}</h2>
                <div class="sp-detail-author">{{ authorName(detail) }}</div>
                <div class="sp-detail-sub">
                    <span v-if="displayState === 'scheduled' && detail.scheduled_at" class="sp-detail-when">🕐 Начало: {{ formatDateTime(detail.scheduled_at) }}</span>
                    <button class="sp-btn sp-btn-secondary sp-share-btn" @click="shareStream">🔗 {{ shareMsg || 'Поделиться' }}</button>
                </div>

                <!-- Player / gate -->
                <div class="sp-player-wrap">
                    <!-- Paid & no access: buy, or access-period-ended -->
                    <div v-if="!hasAccess" class="sp-player sp-player-msg">
                        <div v-if="canBuy">
                            <div class="sp-msg-title">Платный эфир — {{ priceLabel(detail) }}</div>
                            <div class="sp-muted">Доступ к эфиру и записи на {{ detail.access_months }} мес. с даты эфира.</div>
                            <button class="sp-btn sp-btn-primary sp-buy-btn" :disabled="buying" @click="buyStream">
                                {{ buying ? 'Переход к оплате…' : 'Купить за ' + priceLabel(detail) }}
                            </button>
                        </div>
                        <div v-else>
                            <div class="sp-msg-title">Доступ к записи завершён</div>
                            <div class="sp-muted">Период доступа к этому эфиру закончился.</div>
                        </div>
                    </div>
                    <!-- Waiting: own placeholder + light poll -->
                    <div v-else-if="displayState === 'scheduled'" class="sp-player sp-player-msg">
                        <div>
                            <div class="sp-msg-title">Эфир ещё не начался</div>
                            <div v-if="detail.scheduled_at" class="sp-msg-when">Начало: {{ formatDateTime(detail.scheduled_at) }}</div>
                            <div class="sp-muted">Страница обновится автоматически, когда трансляция начнётся.</div>
                        </div>
                    </div>
                    <!-- Ended, replay still transcoding: processing placeholder + light poll -->
                    <div v-else-if="replayProcessing" class="sp-player sp-player-msg">
                        <div>
                            <div class="sp-msg-title">Запись обрабатывается</div>
                            <div class="sp-muted">Эфир завершён. Запись появится здесь автоматически через несколько минут.</div>
                        </div>
                    </div>
                    <!-- Live / ended (replay ready): PeerTube iframe -->
                    <div v-else class="sp-player">
                        <iframe
                            :src="playerSrc"
                            allowfullscreen
                            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                            allow="autoplay; fullscreen"
                        ></iframe>
                    </div>
                </div>

                <p v-if="error" class="sp-error">{{ error }}</p>
                <p v-if="detail.description" class="sp-detail-desc">{{ detail.description }}</p>

                <!-- Viewer chat — same access gate as the stream itself -->
                <section v-if="hasAccess" class="sp-chat">
                    <h3 class="sp-chat-title">Чат эфира</h3>
                    <div ref="feedEl" class="sp-chat-feed">
                        <div v-if="chatLoading" class="sp-muted">Загрузка чата…</div>
                        <div v-else-if="!messages.length" class="sp-muted">Сообщений пока нет. Будьте первым!</div>
                        <div
                            v-for="m in messages"
                            :key="m.id"
                            class="sp-chat-row"
                            :class="{ 'sp-chat-mine': me && m.owner === me.id }"
                        >
                            <img v-if="m.authorUser?.Photo" :src="m.authorUser.Photo" class="sp-chat-ava" />
                            <div v-else class="sp-chat-ava sp-chat-ava-empty">{{ (m.authorUser?.Name || '?').slice(0, 1) }}</div>
                            <div class="sp-chat-bubble">
                                <div class="sp-chat-meta">
                                    <span class="sp-chat-name">{{ m.authorUser?.Name || 'Пользователь' }}</span>
                                    <span class="sp-chat-time">{{ msgTime(m.created_at) }}</span>
                                    <button v-if="canDeleteMsg(m)" class="sp-chat-del" @click="removeMessage(m)">удалить</button>
                                </div>
                                <div class="sp-chat-text">{{ m.text }}</div>
                            </div>
                        </div>
                    </div>
                    <div v-if="me" class="sp-chat-composer">
                        <textarea
                            v-model="chatText"
                            class="sp-chat-input"
                            rows="1"
                            placeholder="Написать в чат…"
                            @keydown.enter.exact.prevent="sendChat"
                        ></textarea>
                        <button class="sp-btn sp-btn-primary" :disabled="!chatText.trim() || sending" @click="sendChat">
                            {{ sending ? '…' : 'Отправить' }}
                        </button>
                    </div>
                    <div v-else class="sp-muted sp-chat-login">Войдите, чтобы писать в чат.</div>
                </section>
            </template>
        </template>

        <!-- ============================= LIST VIEW ============================= -->
        <template v-else>
            <div v-if="loading" class="sp-muted">Загрузка…</div>

            <template v-else>
                <!-- Create (speakers / institutions) -->
                <section v-if="isStreamer" class="sp-card">
                    <div class="sp-card-head">
                        <h2>Начать трансляцию</h2>
                        <button v-if="!showForm" class="sp-btn sp-btn-primary" @click="showForm = true">Начать трансляцию</button>
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
                        <label class="sp-field">
                            <span>Дата и время эфира <span class="sp-optional">(необязательно)</span></span>
                            <input v-model="form.scheduledAt" type="datetime-local" />
                        </label>
                        <div class="sp-field">
                            <span>Доступ</span>
                            <div class="sp-radio-row">
                                <label class="sp-radio"><input type="radio" value="free" v-model="form.kind" /> Бесплатно</label>
                                <label class="sp-radio"><input type="radio" value="paid" v-model="form.kind" /> Платно</label>
                            </div>
                        </div>
                        <div v-if="form.kind === 'paid'" class="sp-paid-fields">
                            <label class="sp-field">
                                <span>Цена, ₽</span>
                                <input v-model.number="form.price" type="number" min="1" step="1" placeholder="Например: 990" />
                            </label>
                            <label class="sp-field">
                                <span>Доступ к записи</span>
                                <select v-model.number="form.months">
                                    <option :value="1">1 месяц</option>
                                    <option :value="3">3 месяца</option>
                                    <option :value="6">6 месяцев</option>
                                    <option :value="12">12 месяцев</option>
                                </select>
                            </label>
                            <p class="sp-note">Доступ отсчитывается от даты эфира.</p>
                        </div>
                        <div class="sp-form-actions">
                            <button type="submit" class="sp-btn sp-btn-primary" :disabled="creating || !canSubmit">
                                {{ creating ? 'Создаём эфир…' : 'Создать эфир' }}
                            </button>
                            <button type="button" class="sp-btn sp-btn-secondary" :disabled="creating" @click="cancelForm">Отменить</button>
                        </div>
                    </form>
                    <p v-if="error" class="sp-error">{{ error }}</p>
                </section>

                <!-- OBS credentials -->
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

                <!-- All streams -->
                <section class="sp-card">
                    <h2>Все эфиры</h2>
                    <div v-if="!listItems.length" class="sp-muted">Пока нет эфиров.</div>
                    <div v-else class="sp-grid">
                        <button v-for="s in listItems" :key="s.id" class="sp-tile" @click="openStream(s.id)">
                            <div class="sp-thumb">
                                <img v-if="s.thumb" :src="s.thumb" alt="" />
                                <div v-else class="sp-thumb-ph">▶</div>
                                <span class="sp-badge sp-tile-badge" :class="'sp-badge-' + s.status">{{ statusLabel(s.status) }}</span>
                            </div>
                            <div class="sp-tile-body">
                                <div class="sp-tile-title">{{ s.title }}</div>
                                <div v-if="s.status === 'scheduled' && s.scheduled_at" class="sp-tile-when">🕐 {{ formatDateTime(s.scheduled_at) }}</div>
                                <div class="sp-tile-meta">
                                    <span>{{ authorName(s) }}</span>
                                    <span>{{ priceLabel(s) }}</span>
                                </div>
                            </div>
                        </button>
                    </div>
                </section>

                <!-- Author's own streams -->
                <section v-if="isStreamer" class="sp-card">
                    <h2>Мои эфиры</h2>
                    <p v-if="notice" class="sp-notice">{{ notice }}</p>
                    <div v-if="!myStreams.length" class="sp-muted">Пока нет созданных эфиров.</div>
                    <ul v-else class="sp-list">
                        <li v-for="s in myStreams" :key="s.id" class="sp-item">
                            <div class="sp-item-main">
                                <div class="sp-item-title">{{ s.title }}</div>
                                <div class="sp-item-meta">
                                    <span class="sp-badge" :class="'sp-badge-' + s.status">{{ statusLabel(s.status) }}</span>
                                    <span v-if="s.hidden" class="sp-badge sp-badge-hidden">Скрыт</span>
                                    <span>{{ priceLabel(s) }}</span>
                                </div>
                            </div>
                            <div class="sp-item-actions">
                                <template v-if="confirmDeleteId === s.id">
                                    <span class="sp-confirm-text">Удалить эфир? Если есть купившие — он будет скрыт (они сохранят доступ), иначе удалён полностью.</span>
                                    <button class="sp-btn sp-btn-mini sp-btn-danger" :disabled="busyId === s.id" @click="removeStream(s)">
                                        {{ busyId === s.id ? 'Удаляем…' : 'Да, удалить' }}
                                    </button>
                                    <button class="sp-btn sp-btn-mini" :disabled="busyId === s.id" @click="confirmDeleteId = null">Отмена</button>
                                </template>
                                <template v-else>
                                    <button v-if="s.status !== 'live'" class="sp-btn sp-btn-mini" :disabled="busyId === s.id" @click="goLive(s)">Я в эфире</button>
                                    <button v-else class="sp-btn sp-btn-mini" :disabled="busyId === s.id" @click="endLive(s)">Завершить</button>
                                    <button class="sp-btn sp-btn-mini" :disabled="busyId === s.id" @click="showCreds(s)">Данные OBS</button>
                                    <button v-if="!s.hidden" class="sp-btn sp-btn-mini sp-btn-danger" :disabled="busyId === s.id" @click="confirmDeleteId = s.id">Удалить</button>
                                </template>
                            </div>
                        </li>
                    </ul>
                </section>
            </template>
        </template>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { createLive, getLiveCredentials, getVideoInfo, embedUrl, assetUrl, VIDEO_STATE } from '@/_front/streams/peertubeLive.js';
import {
    getCurrentUser,
    canStream,
    createStream,
    createBackingCourse,
    purchaseStream,
    hasBoughtStream,
    accessExpiry,
    listMyStreams,
    listAllStreams,
    getStreamById,
    setStreamStatus,
    deleteStream,
    listStreamMessages,
    sendStreamMessage,
    deleteStreamMessage,
} from '@/_front/streams/streamsApi.js';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const me = ref(null);
const listItems = ref([]);
const myStreams = ref([]);

// create-form state
const showForm = ref(false);
const creating = ref(false);
const busyId = ref(null);
const confirmDeleteId = ref(null);
const notice = ref('');
const error = ref('');
const creds = ref(null);
const maskKey = ref(false);
const form = ref({ title: '', description: '', scheduledAt: '', kind: 'free', price: null, months: 3 });
const shareMsg = ref('');

const canSubmit = computed(() => {
    if (!form.value.title) return false;
    if (form.value.kind === 'paid') return Number(form.value.price) > 0;
    return true;
});

// detail state
const detail = ref(null);
const detailInfo = ref(null);
const detailLoading = ref(false);
const bought = ref(false);
const buying = ref(false);
let pollTimer = null;

// viewer-chat state
const messages = ref([]);
const chatText = ref('');
const chatLoading = ref(false);
const sending = ref(false);
const feedEl = ref(null);
let chatTimer = null;

const isStreamer = computed(() => canStream(me.value));
const activeStreamId = computed(() => route.query.stream || null);

function supa() {
    const inst = window.wwLib?.wwPlugins?.supabase?.instance;
    if (!inst) throw new Error('Supabase недоступен на этой странице.');
    return inst;
}

// ---------- labels ----------
function statusLabel(s) {
    return s === 'live' ? 'В эфире' : s === 'ended' ? 'Завершён' : 'Запланирован';
}
function priceLabel(s) {
    return Number(s.price) > 0 ? `${Number(s.price).toLocaleString('ru-RU')} ₽` : 'бесплатно';
}
function authorName(s) {
    return s.authorUser?.Name || 'Автор';
}
function formatDateTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}
async function shareStream() {
    if (!detail.value) return;
    const url = `${window.location.origin}/streams?stream=${detail.value.id}`;
    if (navigator.share) {
        try {
            await navigator.share({ title: detail.value.title, url });
            return;
        } catch (_) {
            return; // user cancelled the native share sheet
        }
    }
    try {
        await navigator.clipboard.writeText(url);
        shareMsg.value = 'Ссылка скопирована';
    } catch (_) {
        shareMsg.value = url;
    }
    setTimeout(() => (shareMsg.value = ''), 2500);
}

// ---------- navigation ----------
function goHome() {
    window.location.href = '/';
}
function openStream(id) {
    router.push({ path: '/streams', query: { stream: id } });
}
function backToList() {
    router.push({ path: '/streams' });
}
async function copy(text) {
    try {
        await navigator.clipboard.writeText(text);
    } catch (_) {
        /* clipboard may be blocked */
    }
}

// ---------- list ----------
async function load() {
    loading.value = true;
    error.value = '';
    try {
        me.value = await getCurrentUser(supa());
        listItems.value = await listAllStreams(supa());
        loadThumbs();
        if (isStreamer.value) myStreams.value = await listMyStreams(supa(), me.value.id);
    } catch (e) {
        error.value = e.message || String(e);
    } finally {
        loading.value = false;
    }
}

// Lazily attach PeerTube thumbnails to list tiles (best-effort, non-blocking).
function loadThumbs() {
    for (const s of listItems.value) {
        if (!s.peertube_video_id) continue;
        getVideoInfo(s.peertube_video_id).then(info => {
            if (info?.previewPath || info?.thumbnailPath) {
                s.thumb = assetUrl(info.previewPath || info.thumbnailPath);
            }
        });
    }
}

// ---------- detail ----------
const isAuthor = computed(() => !!me.value && !!detail.value && me.value.id === detail.value.author);
const isPaid = computed(() => !!detail.value && Number(detail.value.price) > 0 && !!detail.value.backing_course_id);
// Access window measured from the air date (accessExpiry); open if no expiry or not yet passed.
const accessWindowOpen = computed(() => {
    const exp = detail.value ? accessExpiry(detail.value) : null;
    return !exp || Date.now() <= exp.getTime();
});
const hasAccess = computed(() => !!detail.value && (!isPaid.value || isAuthor.value || (bought.value && accessWindowOpen.value)));
const canBuy = computed(() => isPaid.value && !isAuthor.value && !bought.value && accessWindowOpen.value);

// Hybrid state: PeerTube video.state is authoritative for "waiting"; the author's cached
// streams.status carries the live/ended intent.
const displayState = computed(() => {
    const row = detail.value;
    if (!row) return 'scheduled';
    const st = detailInfo.value?.stateId;
    if (st === VIDEO_STATE.WAITING_FOR_LIVE) return 'scheduled';
    if (row.status === 'live' || (st === VIDEO_STATE.PUBLISHED && detailInfo.value?.hasPlaylist && row.status !== 'ended')) return 'live';
    if (row.status === 'ended' || st === VIDEO_STATE.LIVE_ENDED) return 'ended';
    return 'scheduled';
});
const displayLabel = computed(() => statusLabel(displayState.value));
// A replay (or live) is actually watchable once PeerTube has a streaming playlist / PUBLISHED video.
const playable = computed(
    () => !!detailInfo.value && (detailInfo.value.hasPlaylist || detailInfo.value.stateId === VIDEO_STATE.PUBLISHED)
);
// Ended, but the replay is still transcoding (takes a few minutes after the live ends). We show a
// "processing" placeholder instead of PeerTube's "live ended" embed, and keep polling until ready.
const replayProcessing = computed(() => displayState.value === 'ended' && !playable.value);
const playerSrc = computed(() =>
    detail.value?.peertube_video_id
        ? embedUrl(detail.value.peertube_video_id, { autoplay: displayState.value === 'live' })
        : ''
);

async function loadDetail(id) {
    detailLoading.value = true;
    detail.value = null;
    detailInfo.value = null;
    bought.value = false;
    error.value = '';
    stopPoll();
    stopChatPoll();
    try {
        if (!me.value) me.value = await getCurrentUser(supa());
        detail.value = await getStreamById(supa(), id);
        if (detail.value?.peertube_video_id) {
            detailInfo.value = await getVideoInfo(detail.value.peertube_video_id);
        }
        // Has the current user already purchased this paid stream?
        if (detail.value && Number(detail.value.price) > 0 && detail.value.backing_course_id && me.value) {
            bought.value = await hasBoughtStream(supa(), detail.value, me.value.id);
        }
        // Poll while waiting for the live to start (state 4 → 1) OR for a just-ended live's replay
        // to finish transcoding (ended but not yet playable).
        if ((displayState.value === 'scheduled' || replayProcessing.value) && detail.value?.peertube_video_id) startPoll();
        // Viewer chat — same access gate as the stream; poll for new messages while open.
        if (hasAccess.value) {
            chatLoading.value = true;
            await loadChat(id, { scroll: true });
            chatLoading.value = false;
            startChatPoll(id);
        }
    } catch (e) {
        error.value = e.message || String(e);
    } finally {
        detailLoading.value = false;
    }
}

async function buyStream() {
    if (buying.value || !detail.value) return;
    buying.value = true;
    error.value = '';
    try {
        if (!me.value) throw new Error('Войдите, чтобы купить эфир.');
        const payLink = await purchaseStream(supa(), { buyer: me.value.id, stream: detail.value });
        window.location.href = payLink; // redirect to Prodamus (clone of the course change-page step)
    } catch (e) {
        error.value = e.message || String(e);
        buying.value = false;
    }
}

function startPoll() {
    stopPoll();
    let attempts = 0;
    const maxAttempts = Math.ceil((15 * 60000) / 20000); // ~15 min backstop (replay transcoding)
    pollTimer = setInterval(async () => {
        if (!detail.value?.peertube_video_id) return stopPoll();
        detailInfo.value = await getVideoInfo(detail.value.peertube_video_id);
        // re-fetch the author's cached status too (they may have pressed "я в эфире")
        const fresh = await getStreamById(supa(), detail.value.id);
        if (fresh) detail.value = fresh;
        attempts += 1;
        // Stop once the live has resolved AND we're not waiting on a replay, or after the backstop.
        if ((displayState.value !== 'scheduled' && !replayProcessing.value) || attempts >= maxAttempts) stopPoll();
    }, 20000);
}
function stopPoll() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

// ---------- viewer chat ----------
function msgTime(iso) {
    return iso ? new Date(iso).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
}
function canDeleteMsg(m) {
    return !!me.value && (m.owner === me.value.id || (!!detail.value && detail.value.author === me.value.id));
}
function scrollFeed() {
    nextTick(() => {
        const el = feedEl.value;
        if (el) el.scrollTop = el.scrollHeight;
    });
}
async function loadChat(id, { scroll = false } = {}) {
    try {
        const prevLen = messages.value.length;
        messages.value = await listStreamMessages(supa(), id);
        if (scroll || messages.value.length !== prevLen) scrollFeed();
    } catch (_) {
        // keep the current messages on a transient refresh failure
    }
}
async function sendChat() {
    const text = chatText.value.trim();
    if (!text || sending.value || !detail.value || !me.value) return;
    sending.value = true;
    try {
        await sendStreamMessage(supa(), { stream: detail.value.id, owner: me.value.id, text });
        chatText.value = '';
        await loadChat(detail.value.id, { scroll: true });
    } catch (e) {
        error.value = e.message || String(e);
    } finally {
        sending.value = false;
    }
}
async function removeMessage(m) {
    try {
        await deleteStreamMessage(supa(), m.id);
        messages.value = messages.value.filter(x => x.id !== m.id);
    } catch (e) {
        error.value = e.message || String(e);
    }
}
function startChatPoll(id) {
    stopChatPoll();
    chatTimer = setInterval(() => loadChat(id), 7000);
}
function stopChatPoll() {
    if (chatTimer) {
        clearInterval(chatTimer);
        chatTimer = null;
    }
    messages.value = [];
    chatText.value = '';
}

// React to ?stream= changes (list ↔ detail without a full reload).
watch(
    activeStreamId,
    id => {
        if (id) loadDetail(id);
        else {
            detail.value = null;
            stopPoll();
            stopChatPoll();
        }
    },
    { immediate: false }
);

// If a live ends while the viewer is watching, start polling so the replay appears automatically
// once it finishes transcoding (the load-time start only covers already-ended streams).
watch(replayProcessing, processing => {
    if (processing && !pollTimer && detail.value?.peertube_video_id) startPoll();
});

// ---------- create / author actions ----------
function cancelForm() {
    showForm.value = false;
    form.value = { title: '', description: '', scheduledAt: '', kind: 'free', price: null, months: 3 };
    error.value = '';
}
async function createBroadcast() {
    if (!canSubmit.value || creating.value) return;
    creating.value = true;
    error.value = '';
    try {
        const paid = form.value.kind === 'paid';
        const price = paid ? Number(form.value.price) : 0;
        const months = paid ? Number(form.value.months) : null;
        const scheduled_at = form.value.scheduledAt ? new Date(form.value.scheduledAt).toISOString() : null;
        const live = await createLive(supa(), { name: form.value.title, description: form.value.description, saveReplay: true });
        // Paid → create the hidden backing course first, then link it to the stream.
        const backingId = paid
            ? await createBackingCourse(supa(), { owner: me.value.id, title: form.value.title, price, months })
            : null;
        const row = await createStream(supa(), {
            author: me.value.id,
            title: form.value.title,
            description: form.value.description,
            price,
            peertube_video_id: live.video.uuid,
            access_months: months,
            backing_course_id: backingId,
            scheduled_at,
        });
        const withAuthor = { ...row, authorUser: me.value };
        myStreams.value.unshift(withAuthor);
        listItems.value.unshift(withAuthor);
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

// Delete is available for FREE streams only for now (paid ones may have buyers).
function isFreeStream(s) {
    return Number(s.price) === 0 && !s.backing_course_id;
}
async function removeStream(s) {
    busyId.value = s.id;
    error.value = '';
    notice.value = '';
    try {
        const action = await deleteStream(supa(), s);
        confirmDeleteId.value = null;
        // Gone from the public list either way.
        listItems.value = listItems.value.filter(x => x.id !== s.id);
        if (action === 'hidden') {
            // Kept (has buyers) — reflect the hidden state in the author's own list.
            const it = myStreams.value.find(x => x.id === s.id);
            if (it) it.hidden = true;
            notice.value = 'Эфир скрыт: у него есть купившие — они сохранят доступ к записи.';
        } else {
            myStreams.value = myStreams.value.filter(x => x.id !== s.id);
        }
    } catch (e) {
        error.value = e.message || String(e);
    } finally {
        busyId.value = null;
    }
}

onMounted(async () => {
    await load();
    if (activeStreamId.value) loadDetail(activeStreamId.value);
});
onBeforeUnmount(() => {
    stopPoll();
    stopChatPoll();
});
</script>

<style scoped>
.streams-page {
    /* #app already reserves 62px for the fixed AppHeader (rendered globally by App.vue) */
    font-family: inherit;
    color: #1b1f27;
}
.sp-inner {
    max-width: 900px;
    margin: 0 auto;
    padding: 24px 16px 64px;
}
.sp-back {
    color: #5b6472;
    text-decoration: none;
    font-size: 14px;
}
.sp-back:hover {
    color: #5495f3;
}
.sp-back-block {
    display: inline-block;
    margin-bottom: 16px;
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

/* form */
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
.sp-radio-row {
    display: flex;
    gap: 18px;
    font-weight: 400;
}
.sp-radio {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 14px;
    color: #374151;
}
.sp-paid-fields {
    display: flex;
    flex-direction: column;
    gap: 14px;
}
.sp-field select {
    font: inherit;
    font-weight: 400;
    padding: 10px 12px;
    border: 1px solid #d7dee8;
    border-radius: 8px;
    color: #1b1f27;
    background: #fff;
}
.sp-buy-btn {
    margin-top: 14px;
}

/* buttons */
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
.sp-btn-danger {
    color: #e5484d;
    border-color: #f3c4c6;
}
.sp-btn-danger:hover {
    background: #fdecec;
}
.sp-confirm-text {
    font-size: 13px;
    color: #5b6472;
    align-self: center;
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

/* creds */
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

/* grid of stream tiles */
.sp-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
    margin-top: 8px;
}
.sp-tile {
    text-align: left;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    padding: 0;
    font: inherit;
    color: inherit;
}
.sp-tile:hover {
    border-color: #cfe0fb;
    box-shadow: 0 2px 10px rgba(84, 149, 243, 0.12);
}
.sp-thumb {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    background: #eef2f7;
}
.sp-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}
.sp-thumb-ph {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #b6c0cf;
    font-size: 30px;
}
.sp-tile-badge {
    position: absolute;
    top: 8px;
    left: 8px;
}
.sp-tile-body {
    padding: 10px 12px 12px;
}
.sp-tile-title {
    font-weight: 600;
    font-size: 15px;
    line-height: 1.3;
}
.sp-tile-meta {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-top: 6px;
    font-size: 13px;
    color: #6b7280;
}

/* author list */
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

/* badges */
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
.sp-badge-hidden {
    background: #fff4e5;
    color: #b06a00;
}
.sp-notice {
    background: #eef6ff;
    color: #235a97;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 14px;
    margin: 0 0 8px;
}

/* detail */
.sp-detail-head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 6px;
}
.sp-price {
    font-size: 14px;
    color: #6b7280;
}
.sp-detail-title {
    font-size: 22px;
    font-weight: 600;
    margin: 0 0 4px;
}
.sp-detail-author {
    color: #6b7280;
    font-size: 14px;
    margin-bottom: 10px;
}
.sp-detail-sub {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    margin-bottom: 16px;
}
.sp-detail-when {
    font-size: 14px;
    color: #374151;
    font-weight: 600;
}
.sp-share-btn {
    padding: 7px 14px;
    font-size: 13px;
}
.sp-optional {
    font-weight: 400;
    color: #9ca3af;
}
.sp-tile-when {
    margin-top: 4px;
    font-size: 13px;
    color: #374151;
    font-weight: 600;
}
.sp-msg-when {
    font-size: 15px;
    font-weight: 600;
    color: #cfe0fb;
    margin-bottom: 6px;
}
.sp-detail-desc {
    margin-top: 16px;
    font-size: 15px;
    line-height: 1.5;
    color: #374151;
    white-space: pre-line;
}
.sp-player-wrap {
    width: 100%;
}
.sp-player {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    background: #0d0f12;
    border-radius: 12px;
    overflow: hidden;
}
.sp-player iframe {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
}
.sp-player-msg {
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: #e5e7eb;
    padding: 24px;
}
.sp-player-msg .sp-muted {
    color: #9ca3af;
}
.sp-msg-title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 6px;
    color: #fff;
}

/* viewer chat */
.sp-chat {
    margin-top: 24px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    background: #fff;
    padding: 16px;
}
.sp-chat-title {
    margin: 0 0 12px;
    font-size: 17px;
    font-weight: 700;
    color: #1b1f27;
}
.sp-chat-feed {
    max-height: 360px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-right: 4px;
}
.sp-chat-row {
    display: flex;
    gap: 10px;
    align-items: flex-start;
}
.sp-chat-ava {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    object-fit: cover;
    flex: 0 0 auto;
}
.sp-chat-ava-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #eef2f7;
    color: #5b6472;
    font-weight: 700;
    text-transform: uppercase;
}
.sp-chat-bubble {
    background: #f5f7fa;
    border-radius: 10px;
    padding: 8px 12px;
    max-width: 78%;
}
.sp-chat-mine {
    flex-direction: row-reverse;
}
.sp-chat-mine .sp-chat-bubble {
    background: #eaf2fe;
}
.sp-chat-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
}
.sp-chat-name {
    font-weight: 600;
    font-size: 13px;
    color: #374151;
}
.sp-chat-time {
    font-size: 11px;
    color: #9ca3af;
}
.sp-chat-del {
    font: inherit;
    font-size: 11px;
    color: #b6c0cf;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
}
.sp-chat-del:hover {
    color: #e5484d;
}
.sp-chat-text {
    font-size: 14px;
    color: #1b1f27;
    white-space: pre-wrap;
    word-break: break-word;
}
.sp-chat-composer {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    align-items: flex-end;
}
.sp-chat-input {
    flex: 1;
    font: inherit;
    font-size: 14px;
    resize: none;
    min-height: 40px;
    max-height: 120px;
    border: 1px solid #d7dee8;
    border-radius: 8px;
    padding: 9px 12px;
    color: #1b1f27;
}
.sp-chat-input:focus {
    outline: none;
    border-color: #5495f3;
}
.sp-chat-login {
    margin-top: 12px;
    text-align: center;
}
</style>
