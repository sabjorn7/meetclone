<template>
    <div class="ev">
        <!-- Detail view (?event=<id>) — reuse the E5 detail component; :key remounts on id change.
             NOT wrapped in the narrow .ev-inner: EventDetailPage manages its own 1200px width to
             match CoursePage exactly (the 960px .ev-inner was squeezing it to ~848px). -->
        <template v-if="activeEventId || activeEventSlug">
            <div class="ev-detailtop">
                <a class="ev-back" href="/events" @click.prevent="backToList">← Все мероприятия</a>
            </div>
            <EventDetailPage :key="detailKey" />
        </template>

        <!-- Calendar (list) — pd-* system + full-width horizontal cards (like /articles brand) -->
        <template v-else>
            <main class="pd">
                <header class="pd-hero">
                    <div class="pd-wrap">
                        <h1 class="pd-hero__title">Мероприятия</h1>
                        <p class="pd-hero__sub">Очные семинары и встречи.</p>
                    </div>
                </header>

                <section class="pd-section">
                    <div class="pd-wrap">
                        <p v-if="error" class="pd-empty">{{ error }}</p>
                        <p v-else-if="loading" class="pd-empty">Загрузка…</p>

                        <template v-else>
                            <template v-if="upcoming.length">
                                <h2 class="pd-grouphead">Предстоящие</h2>
                                <div class="pd-list">
                                    <a v-for="ev in upcoming" :key="ev.id" class="pd-erow" :href="ev.slug ? `/event/${ev.slug}` : `/events?event=${ev.id}`">
                                        <div class="pd-erow__cover">
                                            <img v-if="ev.cover_url" :src="ev.cover_url" :alt="ev.title" loading="lazy" />
                                            <div v-else class="pd-erow__cover--empty">🗓</div>
                                            <span class="pd-erow__badge">Предстоящее</span>
                                        </div>
                                        <div class="pd-erow__body">
                                            <h3 class="pd-erow__title">{{ ev.title }}</h3>
                                            <div v-if="ev.starts_at" class="pd-erow__meta">🕐 {{ fmtRange(ev.starts_at, ev.ends_at) }}</div>
                                            <div v-if="ev.location" class="pd-erow__meta">📍 {{ ev.location }}</div>
                                            <div class="pd-erow__spacer"></div>
                                            <div class="pd-erow__price">{{ priceLabel(ev) }}</div>
                                        </div>
                                    </a>
                                </div>
                            </template>

                            <template v-if="past.length">
                                <h2 class="pd-grouphead">Прошедшие</h2>
                                <div class="pd-list">
                                    <a v-for="ev in past" :key="ev.id" class="pd-erow pd-erow--past" :href="ev.slug ? `/event/${ev.slug}` : `/events?event=${ev.id}`">
                                        <div class="pd-erow__cover">
                                            <img v-if="ev.cover_url" :src="ev.cover_url" :alt="ev.title" loading="lazy" />
                                            <div v-else class="pd-erow__cover--empty">🗓</div>
                                            <span class="pd-erow__badge pd-erow__badge--past">Прошло</span>
                                        </div>
                                        <div class="pd-erow__body">
                                            <h3 class="pd-erow__title">{{ ev.title }}</h3>
                                            <div v-if="ev.starts_at" class="pd-erow__meta">🕐 {{ fmtRange(ev.starts_at, ev.ends_at) }}</div>
                                            <div v-if="ev.location" class="pd-erow__meta">📍 {{ ev.location }}</div>
                                        </div>
                                    </a>
                                </div>
                            </template>

                            <p v-if="!upcoming.length && !past.length" class="pd-empty">Пока нет мероприятий.</p>
                        </template>
                    </div>
                </section>
            </main>
        </template>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { listPublishedEvents } from '@/_front/streams/eventsApi.js';
import EventDetailPage from './EventDetailPage.vue';

const sb = () => window.wwLib?.wwPlugins?.supabase?.instance;
const route = useRoute();

const activeEventId = computed(() => route.query.event || null);
const activeEventSlug = computed(() => route.params.slug || null);
const detailKey = computed(() => activeEventSlug.value || activeEventId.value);

const loading = ref(true);
const error = ref('');
const items = ref([]);

const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const timeFmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
function fmtRange(startIso, endIso) {
    if (!startIso) return '';
    const s = new Date(startIso);
    if (Number.isNaN(s.getTime())) return '';
    const sTxt = dateFmt.format(s);
    if (!endIso) return sTxt;
    const e = new Date(endIso);
    if (Number.isNaN(e.getTime())) return sTxt;
    return s.toDateString() === e.toDateString() ? `${sTxt} – ${timeFmt.format(e)}` : `${sTxt} – ${dayFmt.format(e)}`;
}
function priceLabel(ev) {
    const p = Number(ev.price) || 0;
    if (!p) return 'Бесплатно';
    let s = `${p.toLocaleString('ru-RU')} ₽`;
    if (ev.deposit_percent) s += ` · предоплата ${Math.round((p * ev.deposit_percent) / 100).toLocaleString('ru-RU')} ₽`;
    return s;
}

const now = Date.now();
// An event counts as "past" only once its END (or start, if no end) is behind us — a multi-day
// event stays "upcoming" until it actually finishes.
function endMs(e) { const t = e.ends_at || e.starts_at; return t ? new Date(t).getTime() : Infinity; }
const upcoming = computed(() => items.value.filter((e) => endMs(e) >= now));
const past = computed(() => items.value.filter((e) => endMs(e) < now).reverse());

function backToList() { window.location.href = '/events'; }

onMounted(async () => {
    // In detail mode the child component loads itself; only the calendar needs the list.
    if (activeEventId.value || activeEventSlug.value) { loading.value = false; return; }
    try {
        items.value = await listPublishedEvents(sb());
    } catch (e) {
        error.value = e.message || String(e);
    } finally {
        loading.value = false;
    }
});
</script>

<style scoped>
.ev { min-height: 60vh; }
/* detail-mode top bar aligned to EventDetailPage's own 1200px container */
.ev-detailtop { max-width: 1200px; margin: 0 auto; padding: 16px 40px 0; }
.ev-back { display: inline-block; color: #1f5fc9; text-decoration: none; }
@media (max-width: 900px) { .ev-detailtop { padding: 16px 22px 0; } }

/* ── List: pd-* system copied from /articles (exact values) ── */
.pd {
    --bg: #ffffff; --bg-tint: #f1f6fd; --surface: #ffffff;
    --ink: #091747; --ink-2: #5b6472; --ink-3: #98a0ad; --line: #e4e9f1;
    --blue: #2e70dd; --blue-ink: #1f5fc9; --blue-tint: #eaf1fe;
    --r-lg: 22px; --r-pill: 999px;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --shadow-hov: 0 22px 46px -26px rgba(9, 23, 71, 0.34);
    --wrap: 1200px;
    background: var(--bg); color: var(--ink);
    font-family: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 17px; line-height: 1.55;
}
.pd *, .pd *::before, .pd *::after { box-sizing: border-box; }
.pd-wrap { width: 100%; max-width: var(--wrap); margin-inline: auto; padding-inline: 40px; }
.pd-hero { padding: 48px 0 20px; }
.pd-hero__title { margin: 0; font-weight: 800; font-size: clamp(2rem, 4.6vw, 3rem); line-height: 1.04; letter-spacing: -0.03em; }
.pd-hero__sub { margin: 14px 0 0; color: var(--ink-2); font-size: 1.08rem; }
.pd-section { padding: 8px 0 80px; }
.pd-empty { padding: 60px 0; text-align: center; color: var(--ink-3); }
.pd-grouphead { margin: 28px 0 16px; font-weight: 800; font-size: 1.35rem; letter-spacing: -0.02em; color: var(--ink); }

/* full-width horizontal cards */
.pd-list { display: flex; flex-direction: column; gap: 16px; }
.pd-erow { display: flex; gap: 22px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); overflow: hidden; text-decoration: none; color: inherit; transition: transform 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out), border-color 0.2s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .pd-erow:hover { transform: translateY(-2px); box-shadow: var(--shadow-hov); border-color: transparent; } }
.pd-erow--past { opacity: 0.72; }
.pd-erow__cover { position: relative; flex: 0 0 320px; aspect-ratio: 16 / 9; background: var(--bg-tint); }
.pd-erow__cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pd-erow__cover--empty { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 34px; }
.pd-erow__badge { position: absolute; top: 12px; left: 12px; background: rgba(255,255,255,0.94); color: var(--blue-ink); border-radius: var(--r-pill); padding: 5px 12px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; backdrop-filter: blur(4px); }
.pd-erow__badge--past { color: var(--ink-3); }
.pd-erow__body { flex: 1; min-width: 0; display: flex; flex-direction: column; padding: 22px 24px; }
.pd-erow__title { margin: 0; font-weight: 800; font-size: 1.35rem; line-height: 1.24; letter-spacing: -0.02em; }
.pd-erow__meta { margin-top: 8px; color: var(--ink-2); font-size: 0.98rem; }
.pd-erow__spacer { flex: 1; min-height: 12px; }
.pd-erow__price { margin-top: 12px; font-weight: 800; color: var(--blue-ink); font-size: 1.1rem; }

@media (max-width: 640px) {
    .pd-wrap { padding-inline: 22px; }
    .pd-erow { flex-direction: column; gap: 0; }
    .pd-erow__cover { flex-basis: auto; width: 100%; }
}
</style>
