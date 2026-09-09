<template>
    <div class="em">
        <div v-if="!ready" class="em-center">Загрузка…</div>

        <template v-else>
            <div class="em-head">
                <h1 class="em-title">Мероприятия</h1>
                <button class="em-btn em-btn--primary" @click="openCreate">+ Создать мероприятие</button>
            </div>

            <p v-if="error" class="em-error">{{ error }}</p>

            <div v-if="!events.length" class="em-empty">Пока нет мероприятий. Создайте первое.</div>

            <div v-for="ev in events" :key="ev.id" class="em-item">
                <div class="em-row">
                    <img v-if="ev.cover_url" :src="ev.cover_url" class="em-row__cover" alt="" />
                    <div v-else class="em-row__cover em-row__cover--empty">🗓</div>
                    <div class="em-row__main">
                        <div class="em-row__title">{{ ev.title }}</div>
                        <div class="em-row__meta">
                            <span :class="['em-badge', ev.status === 'published' ? 'em-badge--pub' : 'em-badge--draft']">
                                {{ ev.status === 'published' ? 'Опубликовано' : 'Черновик' }}
                            </span>
                            <span v-if="ev.starts_at">🕐 {{ fmtDate(ev.starts_at) }}</span>
                            <span v-if="ev.location">📍 {{ ev.location }}</span>
                            <span>{{ priceLabel(ev) }}</span>
                            <button type="button" :class="['em-count', { 'em-count--open': expanded[ev.id] }]" @click="toggleRoster(ev)">
                                👥 {{ paidCounts[ev.id] ?? '…' }}<span v-if="ev.capacity">/{{ ev.capacity }}</span>
                                <span class="em-count__caret">{{ expanded[ev.id] ? '▲' : '▼' }}</span>
                            </button>
                        </div>
                    </div>
                    <div class="em-row__actions">
                        <button class="em-btn em-btn--sm" @click="openEdit(ev)">Изменить</button>
                        <button v-if="ev.status !== 'published'" class="em-btn em-btn--sm em-btn--primary" :disabled="busy" @click="doPublish(ev)">Опубликовать</button>
                        <button v-if="ev.chat" class="em-btn em-btn--sm" @click="openChat(ev)">Чат</button>
                        <button class="em-btn em-btn--sm em-btn--danger" :disabled="busy" @click="doDelete(ev)">Удалить</button>
                    </div>
                </div>

                <div v-if="expanded[ev.id]" class="em-roster">
                    <div v-if="rosterLoading[ev.id]" class="em-roster__msg">Загрузка…</div>
                    <div v-else-if="rosterError[ev.id]" class="em-roster__msg em-error">{{ rosterError[ev.id] }}</div>
                    <div v-else-if="!(rosters[ev.id] || []).length" class="em-roster__msg">Пока никто не записался.</div>
                    <ul v-else class="em-roster__list">
                        <li v-for="r in rosters[ev.id]" :key="r.id" class="em-roster__item">
                            <span class="em-roster__name">{{ r.user?.Name || 'Без имени' }}</span>
                            <span class="em-roster__email">{{ r.user?.email || '—' }}</span>
                            <span class="em-roster__pt">{{ r.payment_type === 'deposit' ? 'Депозит' : 'Полная' }}</span>
                            <span :class="['em-rstatus', r.status === 'paid' ? 'em-rstatus--paid' : 'em-rstatus--pending']">
                                {{ r.status === 'paid' ? 'Оплачено' : 'Ожидает' }}
                            </span>
                        </li>
                    </ul>
                </div>
            </div>
        </template>

        <!-- Create / edit dialog -->
        <div v-if="dialog" class="em-overlay" @click.self="closeDialog">
            <div class="em-dialog" role="dialog" aria-modal="true">
                <h2 class="em-dialog__title">{{ form.id ? 'Редактирование' : 'Новое мероприятие' }}</h2>

                <label class="em-field"><span>Название *</span>
                    <input v-model.trim="form.title" type="text" minlength="3" maxlength="120" placeholder="Название мероприятия" />
                </label>
                <label class="em-field"><span>Краткое описание (для карточек)</span>
                    <textarea v-model.trim="form.description" rows="2" placeholder="Короткий анонс для карточки и превью"></textarea>
                </label>
                <label class="em-field"><span>О чём мероприятие</span>
                    <textarea v-model="form.about" rows="4" placeholder="Подробно, абзацы разделяйте пустой строкой"></textarea>
                </label>
                <label class="em-field"><span>Чему научитесь</span>
                    <textarea v-model="form.what_you_learn" rows="4" placeholder="Каждый пункт — с новой строки"></textarea>
                </label>
                <label class="em-field"><span>Для кого</span>
                    <textarea v-model="form.for_whom" rows="4" placeholder="Каждый пункт — с новой строки"></textarea>
                </label>
                <label class="em-field"><span>Дата и время начала</span>
                    <input v-model="form.starts_at_local" type="datetime-local" />
                </label>
                <label class="em-field"><span>Окончание (для многодневных, необязательно)</span>
                    <input v-model="form.ends_at_local" type="datetime-local" />
                </label>
                <label class="em-field"><span>Место проведения</span>
                    <input v-model.trim="form.location" type="text" placeholder="Город, адрес, площадка" />
                </label>
                <div class="em-field"><span>Спикер</span>
                    <div v-if="form.speaker_id" class="em-speaker">
                        <span class="em-speaker__name">{{ form.speaker_name || 'Выбран' }}</span>
                        <button type="button" class="em-btn em-btn--sm" @click="clearSpeaker">Убрать</button>
                    </div>
                    <template v-else>
                        <input v-model="speakerQuery" type="text" placeholder="Поиск по имени или e-mail" @input="onSpeakerSearch" />
                        <ul v-if="speakerResults.length" class="em-picker">
                            <li v-for="u in speakerResults" :key="u.id" @click="pickSpeaker(u)">
                                {{ u.Name || u.email || 'Без имени' }}<span v-if="u.email" class="em-picker__email"> · {{ u.email }}</span>
                            </li>
                        </ul>
                    </template>
                </div>

                <div class="em-grid">
                    <label class="em-field"><span>Цена, ₽ *</span>
                        <input v-model.number="form.price" type="number" min="1" step="1" placeholder="0" />
                    </label>
                    <label class="em-field"><span>Предоплата, %</span>
                        <input v-model="form.deposit_percent" type="number" min="1" max="99" step="1" placeholder="нет" />
                    </label>
                    <label class="em-field"><span>Мест (лимит)</span>
                        <input v-model="form.capacity" type="number" min="1" step="1" placeholder="без лимита" />
                    </label>
                </div>

                <div class="em-field">
                    <span>Обложка</span>
                    <div class="em-cover">
                        <img v-if="form.cover_url" :src="form.cover_url" class="em-cover__img" alt="" />
                        <label class="em-btn em-btn--sm">
                            {{ coverBusy ? 'Загрузка…' : (form.cover_url ? 'Заменить' : 'Загрузить') }}
                            <input type="file" accept="image/*" hidden :disabled="coverBusy" @change="onCover" />
                        </label>
                    </div>
                </div>

                <p v-if="dialogError" class="em-error">{{ dialogError }}</p>
                <div class="em-dialog__actions">
                    <button class="em-btn" @click="closeDialog">Отмена</button>
                    <button class="em-btn em-btn--primary" :disabled="busy || !canSave" @click="save">
                        {{ busy ? 'Сохранение…' : 'Сохранить' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { getCurrentUser } from '@/_front/streams/streamsApi.js';
import {
    isEventsOrganizer,
    listMyEvents,
    countPaidRegistrations,
    listEventRegistrations,
    createEvent,
    updateEvent,
    publishEvent,
    deleteEvent,
    searchUsers,
    getUserBrief,
} from '@/_front/streams/eventsApi.js';

const BUCKET = 'profile';
const STORAGE_URL = 'https://sb.meetgu.ru/storage/v1/object/public/profile//';
const sb = () => window.wwLib?.wwPlugins?.supabase?.instance;

const ready = ref(false);
const me = ref(null);
const events = ref([]);
const paidCounts = ref({});
const error = ref('');
const busy = ref(false);

// roster accordion (per-event, lazy)
const expanded = ref({});
const rosters = ref({});
const rosterLoading = ref({});
const rosterError = ref({});

const dialog = ref(false);
const dialogError = ref('');
const coverBusy = ref(false);
const form = ref(null);

// speaker picker
const speakerQuery = ref('');
const speakerResults = ref([]);
let speakerTimer = null;

const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
function fmtDate(iso) { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : dateFmt.format(d); }
function priceLabel(ev) {
    const p = Number(ev.price) || 0;
    if (!p) return 'Бесплатно';
    let s = `${p.toLocaleString('ru-RU')} ₽`;
    if (ev.deposit_percent) s += ` (предоплата ${Math.round((p * ev.deposit_percent) / 100).toLocaleString('ru-RU')} ₽)`;
    return s;
}

const canSave = computed(() => {
    const f = form.value;
    return !!f && (f.title || '').trim().length >= 3 && Number(f.price) > 0;
});

async function load() {
    error.value = '';
    try {
        events.value = await listMyEvents(sb(), me.value.id);
        const counts = {};
        await Promise.all(events.value.map(async (ev) => { counts[ev.id] = await countPaidRegistrations(sb(), ev.id).catch(() => 0); }));
        paidCounts.value = counts;
    } catch (e) { error.value = e.message || String(e); }
}

// ── date helpers: <input datetime-local> ↔ ISO ──
function isoToLocal(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localToIso(local) { return local ? new Date(local).toISOString() : null; }

function blankForm() {
    return { id: null, title: '', description: '', about: '', what_you_learn: '', for_whom: '', starts_at_local: '', ends_at_local: '', location: '', speaker_id: null, speaker_name: '', price: null, deposit_percent: '', capacity: '', cover_url: null };
}
function resetSpeakerPicker() { speakerQuery.value = ''; speakerResults.value = []; clearTimeout(speakerTimer); }
function openCreate() { form.value = blankForm(); resetSpeakerPicker(); dialogError.value = ''; dialog.value = true; }
async function openEdit(ev) {
    form.value = {
        id: ev.id, title: ev.title || '', description: ev.description || '', about: ev.about || '', what_you_learn: ev.what_you_learn || '', for_whom: ev.for_whom || '', starts_at_local: isoToLocal(ev.starts_at), ends_at_local: isoToLocal(ev.ends_at),
        location: ev.location || '', speaker_id: ev.speaker_id || null, speaker_name: '', price: ev.price,
        deposit_percent: ev.deposit_percent ?? '', capacity: ev.capacity ?? '', cover_url: ev.cover_url || null,
    };
    resetSpeakerPicker();
    dialogError.value = ''; dialog.value = true;
    if (ev.speaker_id) {
        const u = await getUserBrief(sb(), ev.speaker_id).catch(() => null);
        if (form.value) form.value.speaker_name = u?.Name || u?.email || 'Выбран';
    }
}
function closeDialog() { dialog.value = false; form.value = null; resetSpeakerPicker(); }

function onSpeakerSearch() {
    clearTimeout(speakerTimer);
    const q = speakerQuery.value.trim();
    if (!q) { speakerResults.value = []; return; }
    speakerTimer = setTimeout(async () => {
        speakerResults.value = await searchUsers(sb(), q).catch(() => []);
    }, 280);
}
function pickSpeaker(u) {
    form.value.speaker_id = u.id;
    form.value.speaker_name = u.Name || u.email || 'Выбран';
    resetSpeakerPicker();
}
function clearSpeaker() { form.value.speaker_id = null; form.value.speaker_name = ''; }

async function onCover(e) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || coverBusy.value) return;
    coverBusy.value = true; dialogError.value = '';
    try {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const key = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await sb().storage.from(BUCKET).upload(key, file, { upsert: false });
        if (upErr) throw upErr;
        form.value.cover_url = STORAGE_URL + key;
    } catch { dialogError.value = 'Не удалось загрузить обложку.'; }
    finally { coverBusy.value = false; }
}

async function save() {
    if (!canSave.value || busy.value) return;
    busy.value = true; dialogError.value = '';
    const f = form.value;
    const payload = {
        title: f.title, description: f.description, about: f.about, what_you_learn: f.what_you_learn, for_whom: f.for_whom, starts_at: localToIso(f.starts_at_local), ends_at: localToIso(f.ends_at_local),
        location: f.location, speaker_id: f.speaker_id, cover_url: f.cover_url,
        price: Number(f.price),
        deposit_percent: f.deposit_percent === '' || f.deposit_percent == null ? null : Number(f.deposit_percent),
        capacity: f.capacity === '' || f.capacity == null ? null : Number(f.capacity),
    };
    try {
        if (f.id) await updateEvent(sb(), f.id, payload);
        else await createEvent(sb(), { owner: me.value.id, ...payload });
        closeDialog();
        await load();
    } catch (e) { dialogError.value = e.message || String(e); }
    finally { busy.value = false; }
}

async function doPublish(ev) {
    busy.value = true; error.value = '';
    try { await publishEvent(sb(), ev.id); await load(); }
    catch (e) { error.value = e.message; } finally { busy.value = false; }
}
async function doDelete(ev) {
    if (!window.confirm(`Удалить «${ev.title}»?`)) return;
    busy.value = true; error.value = '';
    try { await deleteEvent(sb(), ev.id); await load(); }
    catch (e) { error.value = e.message; } finally { busy.value = false; }
}
function openChat(ev) { if (ev.chat) window.location.href = `/chats?chat=${ev.chat}`; }

async function toggleRoster(ev) {
    const id = ev.id;
    const willOpen = !expanded.value[id];
    expanded.value = { ...expanded.value, [id]: willOpen };
    if (willOpen) await loadRoster(id);
}
async function loadRoster(id) {
    rosterLoading.value = { ...rosterLoading.value, [id]: true };
    rosterError.value = { ...rosterError.value, [id]: '' };
    try {
        rosters.value = { ...rosters.value, [id]: await listEventRegistrations(sb(), id) };
    } catch (e) {
        rosterError.value = { ...rosterError.value, [id]: e.message || String(e) };
    } finally {
        rosterLoading.value = { ...rosterLoading.value, [id]: false };
    }
}

onMounted(async () => {
    me.value = await getCurrentUser(sb()).catch(() => null);
    if (!me.value || !isEventsOrganizer(me.value.id)) { window.location.href = '/'; return; }
    await load();
    ready.value = true;
});
</script>

<style scoped>
.em { max-width: 960px; margin: 0 auto; padding: 24px 16px 64px; font-family: 'Raleway', sans-serif; color: #0f172a; }
.em-center, .em-empty { text-align: center; color: #64748b; padding: 48px 0; }
.em-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.em-title { font-size: 26px; font-weight: 800; margin: 0; }
.em-error { color: #dc2626; margin: 8px 0; }
.em-row { display: flex; gap: 14px; align-items: center; padding: 12px; border: 1px solid #eceef1; border-radius: 14px; margin-bottom: 10px; }
.em-row__cover { width: 88px; height: 66px; object-fit: cover; border-radius: 10px; flex: 0 0 auto; }
.em-row__cover--empty { display: flex; align-items: center; justify-content: center; background: #f4f5f7; font-size: 26px; }
.em-row__main { flex: 1; min-width: 0; }
.em-row__title { font-weight: 700; font-size: 16px; }
.em-row__meta { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; font-size: 13px; color: #64748b; }
.em-row__actions { display: flex; flex-wrap: wrap; gap: 6px; }
.em-badge { padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; color: #fff; }
.em-badge--pub { background: #16a34a; }
.em-badge--draft { background: #94a3b8; }
.em-btn { border: 1px solid #d1d5db; background: #fff; border-radius: 10px; padding: 8px 14px; cursor: pointer; font-size: 14px; }
.em-btn--sm { padding: 6px 10px; font-size: 13px; }
.em-btn--primary { background: #2563eb; color: #fff; border-color: #2563eb; }
.em-btn--danger { color: #dc2626; border-color: #f0c0c0; }
.em-btn:disabled { opacity: .5; cursor: default; }
.em-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: flex-start; justify-content: center; padding: 24px; overflow-y: auto; z-index: 50; }
.em-dialog { background: #fff; border-radius: 16px; padding: 22px; width: min(560px, 100%); }
.em-dialog__title { margin: 0 0 14px; font-size: 20px; font-weight: 800; }
.em-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; font-size: 14px; }
.em-field > span { color: #64748b; font-weight: 600; }
.em-field input, .em-field textarea { border: 1px solid #d1d5db; border-radius: 10px; padding: 10px 12px; font: inherit; }
.em-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.em-speaker { display: flex; align-items: center; gap: 10px; }
.em-speaker__name { font-weight: 600; }
.em-picker { list-style: none; margin: 6px 0 0; padding: 0; border: 1px solid #eceef1; border-radius: 10px; max-height: 200px; overflow-y: auto; }
.em-picker li { padding: 8px 12px; cursor: pointer; font-size: 14px; }
.em-picker li:hover { background: #f4f5f7; }
.em-picker__email { color: #94a3b8; font-size: 12px; }
.em-cover { display: flex; align-items: center; gap: 12px; }
.em-cover__img { width: 120px; height: 80px; object-fit: cover; border-radius: 10px; }
.em-dialog__actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
.em-count { display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px; border: 1px solid #d8dbe0; background: #f8fafc; border-radius: 999px; font: inherit; font-size: 13px; color: #334155; cursor: pointer; }
.em-count:hover { background: #eef2f7; }
.em-count--open { background: #e6effe; border-color: #bcd4fb; color: #1d4ed8; }
.em-count__caret { font-size: 9px; opacity: .7; }
.em-roster { border: 1px solid #eceef1; border-top: none; border-radius: 0 0 14px 14px; margin: -10px 0 10px; padding: 6px 12px 10px; background: #fbfcfd; }
.em-roster__msg { padding: 10px 4px; font-size: 14px; color: #64748b; }
.em-roster__list { list-style: none; margin: 0; padding: 0; }
.em-roster__item { display: grid; grid-template-columns: 1.2fr 1.6fr auto auto; gap: 12px; align-items: center; padding: 8px 4px; border-bottom: 1px solid #eef1f4; font-size: 14px; }
.em-roster__item:last-child { border-bottom: none; }
.em-roster__name { font-weight: 600; color: #0f172a; }
.em-roster__email { color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.em-roster__pt { color: #475569; font-size: 13px; }
.em-rstatus { justify-self: end; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.em-rstatus--paid { background: #dcfce7; color: #15803d; }
.em-rstatus--pending { background: #fef3c7; color: #b45309; }
@media (max-width: 560px) { .em-roster__item { grid-template-columns: 1fr auto; row-gap: 2px; } .em-roster__email { grid-column: 1 / -1; } }
</style>
