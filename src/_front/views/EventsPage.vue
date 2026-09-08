<template>
    <div class="ev">
        <!-- Detail view (?event=<id>) — reuse the E5 detail component; :key remounts on id change -->
        <template v-if="activeEventId">
            <div class="ev-inner">
                <a class="ev-back" href="/events" @click.prevent="backToList">← Все мероприятия</a>
                <EventDetailPage :key="activeEventId" />
            </div>
        </template>

        <!-- Calendar (list) -->
        <template v-else>
            <div class="ev-inner">
                <h1 class="ev-title">Мероприятия</h1>
                <p v-if="error" class="ev-error">{{ error }}</p>
                <div v-if="loading" class="ev-muted">Загрузка…</div>

                <template v-else>
                    <section v-if="upcoming.length" class="ev-section">
                        <h2 class="ev-sub">Предстоящие</h2>
                        <div class="ev-grid">
                            <a v-for="ev in upcoming" :key="ev.id" class="ev-card" :href="`/events?event=${ev.id}`">
                                <div class="ev-card__cover">
                                    <img v-if="ev.cover_url" :src="ev.cover_url" alt="" />
                                    <div v-else class="ev-card__cover--empty">🗓</div>
                                </div>
                                <div class="ev-card__body">
                                    <div class="ev-card__title">{{ ev.title }}</div>
                                    <div v-if="fmtDate(ev.starts_at)" class="ev-card__meta">🕐 {{ fmtDate(ev.starts_at) }}</div>
                                    <div v-if="ev.location" class="ev-card__meta">📍 {{ ev.location }}</div>
                                    <div class="ev-card__price">{{ priceLabel(ev) }}</div>
                                </div>
                            </a>
                        </div>
                    </section>

                    <section v-if="past.length" class="ev-section">
                        <h2 class="ev-sub">Прошедшие</h2>
                        <div class="ev-grid">
                            <a v-for="ev in past" :key="ev.id" class="ev-card ev-card--past" :href="`/events?event=${ev.id}`">
                                <div class="ev-card__cover">
                                    <img v-if="ev.cover_url" :src="ev.cover_url" alt="" />
                                    <div v-else class="ev-card__cover--empty">🗓</div>
                                </div>
                                <div class="ev-card__body">
                                    <div class="ev-card__title">{{ ev.title }}</div>
                                    <div v-if="fmtDate(ev.starts_at)" class="ev-card__meta">🕐 {{ fmtDate(ev.starts_at) }}</div>
                                </div>
                            </a>
                        </div>
                    </section>

                    <div v-if="!upcoming.length && !past.length" class="ev-muted">Пока нет мероприятий.</div>
                </template>
            </div>
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

const loading = ref(true);
const error = ref('');
const items = ref([]);

const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
function fmtDate(iso) { if (!iso) return ''; const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : dateFmt.format(d); }
function priceLabel(ev) {
    const p = Number(ev.price) || 0;
    if (!p) return 'Бесплатно';
    let s = `${p.toLocaleString('ru-RU')} ₽`;
    if (ev.deposit_percent) s += ` · предоплата ${Math.round((p * ev.deposit_percent) / 100).toLocaleString('ru-RU')} ₽`;
    return s;
}

const now = Date.now();
const upcoming = computed(() => items.value.filter((e) => !e.starts_at || new Date(e.starts_at).getTime() >= now));
const past = computed(() => items.value.filter((e) => e.starts_at && new Date(e.starts_at).getTime() < now).reverse());

function backToList() { window.location.href = '/events'; }

onMounted(async () => {
    // In detail mode the child component loads itself; only the calendar needs the list.
    if (activeEventId.value) { loading.value = false; return; }
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
.ev-inner { max-width: 960px; margin: 0 auto; padding: 24px 16px 64px; font-family: 'Raleway', sans-serif; color: #0f172a; }
.ev-title { font-size: 28px; font-weight: 800; margin: 0 0 20px; }
.ev-sub { font-size: 20px; font-weight: 700; margin: 24px 0 12px; }
.ev-muted { color: #64748b; padding: 32px 0; }
.ev-error { color: #dc2626; }
.ev-back { display: inline-block; margin-bottom: 16px; color: #2563eb; text-decoration: none; }
.ev-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
.ev-card { display: flex; flex-direction: column; border: 1px solid #eceef1; border-radius: 14px; overflow: hidden; text-decoration: none; color: inherit; background: #fff; transition: box-shadow .15s; }
.ev-card:hover { box-shadow: 0 6px 20px rgba(15,23,42,.08); }
.ev-card--past { opacity: .7; }
.ev-card__cover { aspect-ratio: 16 / 9; background: #f4f5f7; }
.ev-card__cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ev-card__cover--empty { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 30px; }
.ev-card__body { padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; }
.ev-card__title { font-weight: 700; font-size: 16px; }
.ev-card__meta { font-size: 13px; color: #64748b; }
.ev-card__price { margin-top: 6px; font-weight: 700; color: #2563eb; font-size: 14px; }
</style>
