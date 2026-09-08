<template>
    <div class="ed">
        <div v-if="loading" class="ed-center">Загрузка…</div>
        <div v-else-if="notFound" class="ed-center">Мероприятие не найдено.</div>

        <template v-else>
            <!-- Two-column hero like CoursePage (pd-chero): main + sticky pd-buycard sidebar -->
            <header class="pd-hero">
                <div class="pd-wrap pd-chero">
                    <div class="pd-chero__main">
                        <span class="pd-badge"><span class="pd-badge__dot" aria-hidden="true"></span>Мероприятие</span>
                        <span v-if="event.status !== 'published'" class="ed-draft">Черновик (виден только вам)</span>
                        <h1 class="pd-hero__title--course">{{ event.title }}</h1>
                        <p v-if="event.description" class="pd-hero__hook">{{ event.description }}</p>

                        <a v-if="speaker" class="pd-author-mini" :href="`/profile_page/?user=${speaker.id}`">
                            <img v-if="speaker.Photo" :src="speaker.Photo" :alt="speaker.Name" />
                            <span v-else class="pd-author-mini__ava">{{ (speaker.Name || '?').slice(0, 1) }}</span>
                            <span class="pd-author-mini__text"><span class="muted">Спикер</span><b>{{ speaker.Name || 'Спикер' }}</b></span>
                        </a>

                        <div v-if="event.cover_url" class="pd-video pd-video--static">
                            <img :src="event.cover_url" :alt="event.title" />
                        </div>
                    </div>

                    <aside class="pd-chero__side">
                        <div class="pd-buycard">
                            <!-- guest -->
                            <template v-if="!me">
                                <div class="pd-buycard__price"><span class="pd-buycard__now">{{ money(event.price) }} ₽</span></div>
                                <a class="pd-btn pd-btn--lg pd-btn--block" href="/login">Войти, чтобы записаться</a>
                            </template>
                            <!-- registered (paid) -->
                            <template v-else-if="reg && reg.status === 'paid'">
                                <div class="pd-buycard__ok">✓ Вы записаны</div>
                                <p v-if="reg.payment_type === 'deposit'" class="pd-buycard__note">
                                    Оплачено {{ money(reg.amount_paid) }} из {{ money(reg.amount_total) }} ₽. Остаток {{ money(reg.amount_total - reg.amount_paid) }} ₽ — на месте.
                                </p>
                                <a v-if="event.chat" class="pd-btn pd-btn--lg pd-btn--block" :href="`/chats?chat=${event.chat}`">Чат мероприятия</a>
                            </template>
                            <!-- pending -->
                            <template v-else-if="reg && reg.status === 'pending'">
                                <p class="pd-buycard__note">Оплата обрабатывается. Если только что оплатили — обновите страницу через минуту.</p>
                                <button class="pd-btn pd-btn--lg pd-btn--block" :disabled="busy" @click="pay(reg.payment_type || 'full')">Оплатить снова</button>
                            </template>
                            <!-- new registration -->
                            <template v-else>
                                <div class="pd-buycard__price"><span class="pd-buycard__now">{{ money(event.price) }} ₽</span></div>
                                <div v-if="hasDeposit" class="ed-choices">
                                    <label class="ed-choice" :class="{ on: choice === 'full' }">
                                        <input type="radio" value="full" v-model="choice" /> Полная — {{ money(event.price) }} ₽
                                    </label>
                                    <label class="ed-choice" :class="{ on: choice === 'deposit' }">
                                        <input type="radio" value="deposit" v-model="choice" /> Предоплата — {{ money(depositAmount) }} ₽
                                        <span class="ed-choice__sub">остаток {{ money(event.price - depositAmount) }} ₽ на месте</span>
                                    </label>
                                </div>
                                <button class="pd-btn pd-btn--lg pd-btn--block" :disabled="busy || seatsFull" @click="pay(choice)">
                                    {{ seatsFull ? 'Мест нет' : (busy ? 'Переход к оплате…' : 'Записаться') }}
                                </button>
                            </template>
                            <p v-if="payError" class="pd-buyerr">{{ payError }}</p>

                            <ul class="pd-statlist">
                                <li v-if="whenText"><svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg><span>{{ whenText }}</span></li>
                                <li v-if="event.location"><svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg><span>{{ event.location }}</span></li>
                                <li v-if="event.capacity != null"><svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><span>{{ seatsLeft > 0 ? `Осталось мест: ${seatsLeft}` : 'Мест нет' }}</span></li>
                                <li><svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>Чат участников после оплаты</span></li>
                            </ul>
                        </div>
                    </aside>
                </div>
            </header>

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

            <!-- Venue map: Google embed by the free-text address — instant marker, no click, no key. -->
            <section v-if="event.location" class="pd-section">
                <div class="pd-wrap">
                    <h2 class="pd-h2">Как добраться</h2>
                    <div class="ed-map__addr">📍 {{ event.location }}</div>
                    <iframe
                        class="ed-map__frame"
                        :src="`https://www.google.com/maps?q=${encodeURIComponent(event.location)}&output=embed`"
                        loading="lazy"
                        allowfullscreen
                    ></iframe>
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
/* Full-width page (like course main.pd); EVERY block sits in a pd-wrap (1200/40) → same width. */
.ed { width: 100%; font-family: 'Raleway', sans-serif; color: #091747; }
.ed-center { text-align: center; color: #64748b; padding: 64px 0; }
.ed-draft { display: inline-block; font-size: 12px; color: #b45309; background: #fef3c7; padding: 2px 8px; border-radius: 999px; margin: 10px 0; }
.ed-map__addr { color: #5b6472; margin-bottom: 14px; }
.ed-map__frame { width: 100%; height: 380px; border: 0; border-radius: 16px; box-shadow: 0 6px 20px rgba(15,23,42,.06); }
.ed-choices { display: flex; flex-direction: column; gap: 8px; }
.ed-choice { border: 1px solid #d1d5db; border-radius: 12px; padding: 12px 14px; cursor: pointer; font-size: 15px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ed-choice.on { border-color: #2563eb; background: #eff6ff; }
.ed-choice__sub { flex-basis: 100%; color: #94a3b8; font-size: 13px; padding-left: 24px; }

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
/* ── Hero (pd-chero) + sticky buycard — copied from CoursePage (values inlined) ── */
.pd-hero { padding: 24px 0 8px; }
.pd-chero { display: grid; grid-template-columns: minmax(0, 1fr) 358px; gap: 44px; align-items: start; }
.pd-chero__main { min-width: 0; }
.pd-badge { display: inline-flex; align-items: center; gap: 9px; padding: 8px 16px; border-radius: 999px; background: #eaf1fe; color: #1f5fc9; font-weight: 600; font-size: 14px; }
.pd-badge__dot { width: 8px; height: 8px; border-radius: 50%; background: #f09157; box-shadow: 0 0 0 4px rgba(240,145,87,0.22); }
.pd-hero__title--course { margin: 18px 0 0; font-weight: 700; font-size: clamp(1.9rem, 3.4vw, 2.9rem); line-height: 1.08; letter-spacing: -0.02em; }
.pd-hero__hook { margin: 20px 0 0; max-width: 60ch; font-size: 1.1rem; color: #5b6472; white-space: pre-line; }
.pd-author-mini { display: inline-flex; align-items: center; gap: 12px; margin-top: 24px; text-decoration: none; color: inherit; }
.pd-author-mini img, .pd-author-mini__ava { width: 46px; height: 46px; border-radius: 50%; object-fit: cover; flex: none; }
.pd-author-mini__ava { display: grid; place-items: center; background: #eaf1fe; color: #1f5fc9; font-weight: 700; }
.pd-author-mini__text { display: flex; flex-direction: column; line-height: 1.25; font-size: 0.98rem; }
.pd-author-mini__text .muted { color: #98a0ad; font-size: 0.85rem; }
.pd-video { position: relative; width: 100%; aspect-ratio: 16 / 9; margin-top: 30px; border-radius: 26px; overflow: hidden; background: #091747; box-shadow: 0 14px 40px -20px rgba(9,23,71,0.24); border: 1px solid #e4e9f1; }
.pd-video--static img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.pd-chero__side { min-width: 0; }
.pd-buycard { position: sticky; top: 82px; background: #fff; border: 1px solid #e4e9f1; border-radius: 26px; padding: 26px 26px 22px; box-shadow: 0 14px 40px -20px rgba(9,23,71,0.24); }
.pd-buycard__price { display: flex; align-items: baseline; gap: 12px; margin-bottom: 18px; }
.pd-buycard__now { font-weight: 700; font-size: 2.1rem; letter-spacing: -0.02em; color: #091747; }
.pd-buycard__ok { font-weight: 700; font-size: 1.4rem; color: #21a366; margin-bottom: 14px; }
.pd-buycard__note { margin: 0 0 14px; font-size: 0.9rem; color: #5b6472; }
.pd-buycard .ed-choices { margin-bottom: 16px; }
.pd-statlist { list-style: none; margin: 22px 0 0; padding: 20px 0 0; border-top: 1px solid #e4e9f1; display: grid; gap: 14px; }
.pd-statlist li { display: flex; align-items: center; gap: 12px; color: #5b6472; font-size: 0.98rem; }
.pd-statlist .pd-ic { flex: none; width: 20px; height: 20px; stroke: #1f5fc9; fill: none; stroke-width: 2; }
.pd-buyerr { margin: 12px 0 0; text-align: center; font-size: 0.85rem; color: #dc2626; }
.pd-btn { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; border: 0; cursor: pointer; font-family: inherit; font-weight: 700; background: #2e70dd; color: #fff; border-radius: 999px; transition: background 0.16s; }
.pd-btn:hover { background: #2360c6; }
.pd-btn:disabled { opacity: 0.55; cursor: default; }
.pd-btn--lg { padding: 16px 28px; font-size: 1.05rem; }
.pd-btn--block { width: 100%; }

@media (max-width: 1000px) {
    .pd-chero { grid-template-columns: 1fr; gap: 26px; }
    .pd-buycard { position: static; }
    .pd-learn { grid-template-columns: 1fr; }
    .pd-cards--for { grid-template-columns: 1fr; }
}
@media (max-width: 900px) {
    .pd-wrap { padding-inline: 22px; }
    .pd-section { padding: 56px 0; }
}
</style>
