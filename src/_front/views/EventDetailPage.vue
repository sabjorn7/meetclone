<template>
    <div class="ed">
        <div v-if="loading" class="ed-center">Загрузка…</div>
        <div v-else-if="notFound" class="ed-center">Мероприятие не найдено.</div>

        <template v-else>
            <div class="ed-narrow">
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
            </div><!-- /ed-narrow (hero) -->

            <!-- Marketing blocks — LITERALLY the CoursePage structure/classes (full 1200px width) -->
            <section v-if="learnItems.length" class="pd-section pd-section--tint">
                <div class="pd-wrap">
                    <h2 class="pd-h2">Чему научитесь</h2>
                    <ul class="pd-learn">
                        <li v-for="(t, i) in learnItems" :key="i" class="pd-learn__item">
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>
                            <span>{{ t }}</span>
                        </li>
                    </ul>
                </div>
            </section>

            <section v-if="aboutParagraphs.length" class="pd-section">
                <div class="pd-wrap pd-about">
                    <h2 class="pd-h2">О мероприятии</h2>
                    <div class="pd-about__body">
                        <p v-for="(p, i) in aboutParagraphs" :key="i">{{ p }}</p>
                    </div>
                </div>
            </section>

            <section v-if="forItems.length" class="pd-section pd-section--tint">
                <div class="pd-wrap">
                    <h2 class="pd-h2">Для кого</h2>
                    <div class="pd-cards pd-cards--for">
                        <article v-for="(t, i) in forItems" :key="i" class="pd-forcard">
                            <span class="pd-forcard__dot" aria-hidden="true"></span>
                            <p>{{ t }}</p>
                        </article>
                    </div>
                </div>
            </section>

            <div class="ed-narrow">
            <!-- Venue map: Google embed by the free-text address — centers on the address with a
                 marker immediately, no intermediate "found N" click, no API key. -->
            <div v-if="event.location" class="ed-map">
                <h2 class="ed-map__title">Как добраться</h2>
                <div class="ed-map__addr">📍 {{ event.location }}</div>
                <iframe
                    class="ed-map__frame"
                    :src="`https://www.google.com/maps?q=${encodeURIComponent(event.location)}&output=embed`"
                    loading="lazy"
                    allowfullscreen
                ></iframe>
            </div>
            </div><!-- /ed-narrow (hero + map) -->

            <!-- Registration — CoursePage pd-price layout (blue "what's included" + white price/CTA) -->
            <section class="pd-price-wrap">
                <div class="pd-wrap">
                    <div class="pd-price">
                        <div class="pd-price__l">
                            <h2 class="pd-price__h">Участие в мероприятии</h2>
                            <p class="pd-price__sub">{{ event.title }}</p>
                            <ul class="pd-price__incl">
                                <li v-if="whenText"><svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>{{ whenText }}</li>
                                <li v-if="event.location"><svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>{{ event.location }}</li>
                                <li><svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>Чат участников после регистрации</li>
                            </ul>
                        </div>
                        <div class="pd-price__card">
                            <!-- guest -->
                            <template v-if="!me">
                                <span class="pd-price__label">Стоимость</span>
                                <div class="pd-price__amount">{{ money(event.price) }}<span class="cur"> ₽</span></div>
                                <a class="pd-btn pd-btn--lg pd-btn--block" href="/login">Войти, чтобы записаться</a>
                            </template>

                            <!-- already registered -->
                            <template v-else-if="reg && reg.status === 'paid'">
                                <div class="pd-price__ok">✓ Вы записаны</div>
                                <p v-if="reg.payment_type === 'deposit'" class="pd-price__demo">
                                    Оплачено {{ money(reg.amount_paid) }} из {{ money(reg.amount_total) }} ₽. Остаток {{ money(reg.amount_total - reg.amount_paid) }} ₽ — на месте.
                                </p>
                                <a v-if="event.chat" class="pd-btn pd-btn--lg pd-btn--block" :href="`/chats?chat=${event.chat}`">Чат мероприятия</a>
                            </template>

                            <!-- pending -->
                            <template v-else-if="reg && reg.status === 'pending'">
                                <p class="pd-price__demo">Оплата обрабатывается. Если только что оплатили — обновите страницу через минуту.</p>
                                <button class="pd-btn pd-btn--lg pd-btn--block" :disabled="busy" @click="pay(reg.payment_type || 'full')">Оплатить снова</button>
                            </template>

                            <!-- new registration -->
                            <template v-else>
                                <span class="pd-price__label">Стоимость</span>
                                <div v-if="!hasDeposit" class="pd-price__amount">{{ money(event.price) }}<span class="cur"> ₽</span></div>
                                <div v-else class="ed-choices">
                                    <label class="ed-choice" :class="{ on: choice === 'full' }">
                                        <input type="radio" value="full" v-model="choice" />
                                        Полная — {{ money(event.price) }} ₽
                                    </label>
                                    <label class="ed-choice" :class="{ on: choice === 'deposit' }">
                                        <input type="radio" value="deposit" v-model="choice" />
                                        Предоплата — {{ money(depositAmount) }} ₽
                                        <span class="ed-choice__sub">остаток {{ money(event.price - depositAmount) }} ₽ на месте</span>
                                    </label>
                                </div>
                                <button class="pd-btn pd-btn--lg pd-btn--block" :disabled="busy || seatsFull" @click="pay(choice)">
                                    {{ seatsFull ? 'Мест нет' : (busy ? 'Переход к оплате…' : 'Оплатить') }}
                                </button>
                            </template>

                            <p v-if="payError" class="pd-buyerr">{{ payError }}</p>
                        </div>
                    </div>
                </div>
            </section>
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

// Marketing blocks — same storage/parsing as CoursePage: about = paragraphs split on blank lines;
// what_you_learn / for_whom = one bullet per line ("- item" markers stripped).
function bullets(text) {
    return (text || '').split(/\n+/).map((l) => l.replace(/^[\s•\-–—*]+/, '').trim()).filter(Boolean);
}
const aboutParagraphs = computed(() => (event.value?.about || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean));
const learnItems = computed(() => bullets(event.value?.what_you_learn));
const forItems = computed(() => bullets(event.value?.for_whom));

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
.ed { max-width: 1200px; margin: 0 auto; padding: 24px 40px 64px; font-family: 'Raleway', sans-serif; color: #091747; }
/* Hero / map / registration stay in a comfortable reading column; pd-sections go full 1200px. */
.ed-narrow { max-width: 820px; margin: 0 auto; }
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

/* ── Marketing blocks — pd-* structure copied verbatim from CoursePage (exact values) ── */
.pd-section { padding: 80px 0; }
.pd-section--tint { background: #f1f6fd; }
.pd-wrap { width: 100%; max-width: 1200px; margin-inline: auto; padding-inline: 40px; }
.pd-h2 { margin: 0 0 32px; font-weight: 700; font-size: clamp(1.9rem, 4vw, 3rem); line-height: 1.06; letter-spacing: -0.02em; color: #091747; }
.pd-learn { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px 32px; }
.pd-learn__item { display: flex; align-items: flex-start; gap: 12px; font-size: 1.06rem; color: #091747; }
.pd-learn__item .pd-ic { flex: none; width: 24px; height: 24px; stroke-width: 2.6; stroke: #21a366; fill: none; margin-top: 2px; }
.pd-about { max-width: 820px; }
.pd-about__body p { margin: 0 0 16px; font-size: 1.1rem; color: #5b6472; line-height: 1.6; }
.pd-cards--for { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.pd-forcard { position: relative; background: #fff; border: 1px solid #e4e9f1; border-radius: 16px; padding: 24px 24px 24px 28px; }
.pd-forcard__dot { position: absolute; left: 24px; top: 30px; width: 10px; height: 10px; border-radius: 50%; background: #5495f3; }
.pd-forcard p { margin: 0 0 0 22px; color: #5b6472; font-size: 1rem; }
/* ── Registration (pd-price) — copied verbatim from CoursePage (values inlined) ── */
.pd-price-wrap { padding: 20px 0 40px; }
.pd-price { display: grid; grid-template-columns: 1.25fr 0.85fr; border-radius: 26px; overflow: hidden; box-shadow: 0 14px 40px -20px rgba(9,23,71,0.24); }
.pd-price__l { background: #2e70dd; color: #fff; padding: 46px 44px; }
.pd-price__h { margin: 0 0 8px; font-weight: 700; font-size: clamp(1.6rem, 3vw, 2.3rem); letter-spacing: -0.02em; line-height: 1.1; }
.pd-price__sub { margin: 0 0 24px; font-weight: 500; color: rgba(255,255,255,0.85); }
.pd-price__incl { list-style: none; margin: 0; padding: 0; display: grid; gap: 13px; }
.pd-price__incl li { display: flex; align-items: flex-start; gap: 12px; font-weight: 500; }
.pd-price__incl .pd-ic { flex: none; width: 22px; height: 22px; stroke-width: 2.4; stroke: #fff; fill: none; margin-top: 1px; }
.pd-price__card { background: #fff; padding: 42px 40px; display: flex; flex-direction: column; justify-content: center; }
.pd-price__label { font-weight: 500; font-size: 0.9rem; color: #98a0ad; }
.pd-price__amount { margin: 8px 0 0; font-weight: 700; font-size: clamp(2.6rem, 5vw, 3.6rem); line-height: 0.95; letter-spacing: -0.03em; color: #091747; }
.pd-price__amount .cur { color: #c2410c; }
.pd-price__ok { font-weight: 700; font-size: 1.4rem; color: #21a366; }
.pd-price__demo { margin: 12px 0 0; text-align: center; font-size: 0.82rem; color: #98a0ad; }
.pd-buyerr { margin: 12px 0 0; text-align: center; font-size: 0.85rem; color: #dc2626; }
.pd-price__card .pd-btn, .pd-price__card .ed-choices { margin-top: 22px; }
.pd-btn { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; border: 0; cursor: pointer; font-family: inherit; font-weight: 700; background: #2e70dd; color: #fff; border-radius: 999px; transition: background 0.16s; }
.pd-btn:hover { background: #2360c6; }
.pd-btn:disabled { opacity: 0.55; cursor: default; }
.pd-btn--lg { padding: 16px 28px; font-size: 1.05rem; }
.pd-btn--block { width: 100%; }

@media (max-width: 900px) {
    .ed { padding-inline: 22px; }
    .pd-wrap { padding-inline: 22px; }
    .pd-section { padding: 56px 0; }
    .pd-price { grid-template-columns: 1fr; }
    .pd-price__l, .pd-price__card { padding: 32px 26px; }
}
@media (max-width: 560px) {
    .pd-learn { grid-template-columns: 1fr; }
    .pd-cards--for { grid-template-columns: 1fr; }
}
</style>
