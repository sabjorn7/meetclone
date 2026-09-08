<template>
    <div class="ed">
        <div v-if="loading" class="ed-center">Загрузка…</div>
        <div v-else-if="notFound" class="ed-center">Мероприятие не найдено.</div>

        <template v-else>
            <div v-if="event.cover_url" class="ed-cover"><img :src="event.cover_url" alt="" /></div>

            <h1 class="ed-title">{{ event.title }}</h1>
            <span v-if="event.status !== 'published'" class="ed-draft">Черновик (виден только вам)</span>

            <div class="ed-meta">
                <div v-if="whenText" class="ed-meta__row">🕐 {{ whenText }}</div>
                <div v-if="event.location" class="ed-meta__row">📍 {{ event.location }}</div>
                <div v-if="speaker" class="ed-meta__row">
                    🎤 <a class="ed-speaker" :href="`/profile_page/?user=${speaker.id}`">{{ speaker.Name || 'Спикер' }}</a>
                </div>
                <div v-if="event.capacity != null" class="ed-meta__row">
                    👥 {{ seatsLeft > 0 ? `Осталось мест: ${seatsLeft}` : 'Мест нет' }}
                </div>
            </div>

            <p v-if="event.description" class="ed-desc">{{ event.description }}</p>

            <!-- Venue map (Yandex embed by the free-text address; no API key, no stored coords) -->
            <div v-if="event.location" class="ed-map">
                <h2 class="ed-map__title">Как добраться</h2>
                <div class="ed-map__addr">📍 {{ event.location }}</div>
                <iframe
                    class="ed-map__frame"
                    :src="`https://yandex.ru/map-widget/v1/?text=${encodeURIComponent(event.location)}`"
                    loading="lazy"
                    allowfullscreen
                ></iframe>
            </div>

            <!-- Registration card -->
            <div class="ed-card">
                <!-- guest -->
                <template v-if="!me">
                    <div class="ed-price">{{ money(event.price) }} ₽</div>
                    <a class="ed-btn ed-btn--primary" href="/login">Войти, чтобы записаться</a>
                </template>

                <!-- already registered -->
                <template v-else-if="reg && reg.status === 'paid'">
                    <div class="ed-ok">✓ Вы записаны</div>
                    <div v-if="reg.payment_type === 'deposit'" class="ed-note">
                        Оплачено {{ money(reg.amount_paid) }} ₽ из {{ money(reg.amount_total) }} ₽.
                        Остаток {{ money(reg.amount_total - reg.amount_paid) }} ₽ — на месте.
                    </div>
                    <a v-if="event.chat" class="ed-btn" :href="`/chats?chat=${event.chat}`">Чат мероприятия</a>
                </template>

                <!-- pending (payment not finished / just returned from Prodamus) -->
                <template v-else-if="reg && reg.status === 'pending'">
                    <div class="ed-note">
                        Оплата обрабатывается. Если вы только что оплатили — обновите страницу через минуту.
                        Не завершили оплату?
                    </div>
                    <button class="ed-btn ed-btn--primary" :disabled="busy" @click="pay(reg.payment_type || 'full')">
                        Оплатить снова
                    </button>
                </template>

                <!-- new registration -->
                <template v-else>
                    <div v-if="hasDeposit" class="ed-choices">
                        <label class="ed-choice" :class="{ on: choice === 'full' }">
                            <input type="radio" value="full" v-model="choice" />
                            Полная оплата — {{ money(event.price) }} ₽
                        </label>
                        <label class="ed-choice" :class="{ on: choice === 'deposit' }">
                            <input type="radio" value="deposit" v-model="choice" />
                            Предоплата — {{ money(depositAmount) }} ₽
                            <span class="ed-choice__sub">остаток {{ money(event.price - depositAmount) }} ₽ на месте</span>
                        </label>
                    </div>
                    <div v-else class="ed-price">{{ money(event.price) }} ₽</div>

                    <button class="ed-btn ed-btn--primary" :disabled="busy || seatsFull" @click="pay(choice)">
                        {{ seatsFull ? 'Мест нет' : (busy ? 'Переход к оплате…' : 'Оплатить') }}
                    </button>
                </template>

                <p v-if="payError" class="ed-error">{{ payError }}</p>
            </div>
        </template>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { getCurrentUser } from '@/_front/streams/streamsApi.js';
import {
    getEventById,
    getUserBrief,
    getMyEventRegistration,
    countPaidRegistrations,
    purchaseEvent,
    eventAmount,
} from '@/_front/streams/eventsApi.js';

const sb = () => window.wwLib?.wwPlugins?.supabase?.instance;
const route = useRoute();
const eventId = String(route.query.event || '');

const loading = ref(true);
const notFound = ref(false);
const event = ref(null);
const speaker = ref(null);
const me = ref(null);
const reg = ref(null);
const paidCount = ref(0);
const choice = ref('full');
const busy = ref(false);
const payError = ref('');

const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const whenText = computed(() => {
    const s0 = event.value?.starts_at;
    if (!s0) return '';
    const s = new Date(s0);
    if (Number.isNaN(s.getTime())) return '';
    const sTxt = dateFmt.format(s);
    const e0 = event.value?.ends_at;
    if (!e0) return sTxt;
    const e = new Date(e0);
    if (Number.isNaN(e.getTime())) return sTxt;
    // same calendar day → append end time; multi-day → append full end date
    return s.toDateString() === e.toDateString() ? `${sTxt} – ${timeFmt.format(e)}` : `${sTxt} – ${dateFmt.format(e)}`;
});
const hasDeposit = computed(() => event.value?.deposit_percent != null && Number(event.value.deposit_percent) > 0);
const depositAmount = computed(() => (hasDeposit.value ? eventAmount(event.value, 'deposit') : 0));
const seatsLeft = computed(() => (event.value?.capacity != null ? Math.max(0, Number(event.value.capacity) - paidCount.value) : Infinity));
const seatsFull = computed(() => event.value?.capacity != null && seatsLeft.value <= 0);

function money(v) { return (Number(v) || 0).toLocaleString('ru-RU'); }

async function loadReg() {
    if (!me.value || !event.value) { reg.value = null; return; }
    reg.value = await getMyEventRegistration(sb(), event.value.id, me.value.id).catch(() => null);
}

async function load() {
    loading.value = true; notFound.value = false;
    try {
        me.value = await getCurrentUser(sb()).catch(() => null);
        const ev = eventId ? await getEventById(sb(), eventId) : null;
        // draft is visible only to its owner
        if (!ev || (ev.status !== 'published' && (!me.value || me.value.id !== ev.owner))) {
            notFound.value = true;
            return;
        }
        event.value = ev;
        choice.value = 'full';
        if (ev.speaker_id) speaker.value = await getUserBrief(sb(), ev.speaker_id).catch(() => null);
        if (ev.capacity != null) paidCount.value = await countPaidRegistrations(sb(), ev.id).catch(() => 0);
        await loadReg();
    } catch {
        notFound.value = true;
    } finally {
        loading.value = false;
    }
}

async function pay(paymentType) {
    if (busy.value || !event.value || !me.value) return;
    busy.value = true; payError.value = '';
    try {
        const payLink = await purchaseEvent(sb(), { buyer: me.value.id, event: event.value, paymentType });
        window.location.href = payLink;
    } catch (e) {
        payError.value = e.message || 'Не удалось перейти к оплате.';
        busy.value = false;
    }
}

onMounted(async () => {
    await load();
    // Returned from Prodamus with a fresh 'pending'? The callback is async — re-check once after a beat.
    if (reg.value && reg.value.status === 'pending') {
        setTimeout(loadReg, 5000);
    }
});
</script>

<style scoped>
.ed { max-width: 760px; margin: 0 auto; padding: 24px 16px 64px; font-family: 'Raleway', sans-serif; color: #0f172a; }
.ed-center { text-align: center; color: #64748b; padding: 64px 0; }
.ed-cover { border-radius: 16px; overflow: hidden; margin-bottom: 18px; }
.ed-cover img { width: 100%; display: block; }
.ed-title { font-size: 28px; font-weight: 800; margin: 0 0 6px; }
.ed-draft { display: inline-block; font-size: 12px; color: #b45309; background: #fef3c7; padding: 2px 8px; border-radius: 999px; margin-bottom: 12px; }
.ed-meta { display: flex; flex-direction: column; gap: 6px; margin: 12px 0; color: #334155; }
.ed-speaker { color: #2563eb; text-decoration: none; font-weight: 600; }
.ed-speaker:hover { text-decoration: underline; }
.ed-desc { line-height: 1.6; color: #334155; white-space: pre-line; margin: 16px 0; }
.ed-map { margin: 24px 0; }
.ed-map__title { font-size: 20px; font-weight: 700; margin: 0 0 8px; }
.ed-map__addr { color: #334155; margin-bottom: 10px; }
.ed-map__frame { width: 100%; height: 340px; border: 0; border-radius: 16px; box-shadow: 0 6px 20px rgba(15,23,42,.06); }
.ed-card { border: 1px solid #eceef1; border-radius: 18px; padding: 22px; margin-top: 20px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 8px 28px rgba(15,23,42,.07); }
.ed-price { font-size: 24px; font-weight: 800; }
.ed-ok { font-size: 18px; font-weight: 700; color: #16a34a; }
.ed-note { font-size: 14px; color: #64748b; }
.ed-choices { display: flex; flex-direction: column; gap: 8px; }
.ed-choice { border: 1px solid #d1d5db; border-radius: 12px; padding: 12px 14px; cursor: pointer; font-size: 15px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ed-choice.on { border-color: #2563eb; background: #eff6ff; }
.ed-choice__sub { flex-basis: 100%; color: #94a3b8; font-size: 13px; padding-left: 24px; }
.ed-btn { display: inline-block; text-align: center; border: 1px solid #d1d5db; background: #fff; border-radius: 12px; padding: 12px 20px; cursor: pointer; font-size: 15px; text-decoration: none; color: #0f172a; }
.ed-btn--primary { background: #2563eb; color: #fff; border-color: #2563eb; }
.ed-btn:disabled { opacity: .5; cursor: default; }
.ed-error { color: #dc2626; font-size: 14px; }
</style>
