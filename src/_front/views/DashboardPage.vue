<!--
  DashboardPage.vue — "/dashboard" admin analytics panel (Yandex.Metrika-style), hand-written
  rebuild of the dead WeWeb dashboard. PHASE 0: access gate + shell (date range, tabs, KPI tiles)
  + one LIVE tab ("Пользователи": daily registrations chart). Money / content / moderation tabs
  are placeholders filled by later phases (Ф1 revenue RPC, Ф3 courses/events, Ф4 reports/chats).

  ACCESS (admin-only): guest → /login; logged in but not admin (role!=='admin' && !superadmin) → /.
  Moderation actions live on /superadmin — cross-linked from the header here.
  Data: direct read-only queries only (no migration in Ф0). RLS is off project-wide.
-->
<template>
    <main class="dash">
        <div v-if="loading" class="dash-boot">Загрузка панели…</div>

        <template v-else>
            <!-- sub-header: title + range presets + moderation link -->
            <header class="dash-top">
                <div class="dash-top__l">
                    <h1 class="dash-title">Аналитика</h1>
                    <p class="dash-sub">Панель администратора · данные обновляются в реальном времени</p>
                </div>
                <a class="dash-modlink" href="/superadmin">Перейти в модерацию
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </a>
            </header>

            <div class="dash-range">
                <button v-for="p in PRESETS" :key="p.key" type="button"
                        class="dash-preset" :class="{ 'is-on': preset === p.key }" @click="applyPreset(p)">
                    {{ p.label }}
                </button>
                <span class="dash-range__sep"></span>
                <label class="dash-date">с <input type="date" :value="from" :max="to" @change="onFrom($event)"></label>
                <label class="dash-date">по <input type="date" :value="to" :min="from" :max="today" @change="onTo($event)"></label>
            </div>

            <!-- KPI tiles (global) -->
            <div class="dash-kpis">
                <div class="kpi"><span class="kpi__n">{{ fmt(kpi.users) }}</span><span class="kpi__l">Пользователей</span></div>
                <div class="kpi kpi--accent">
                    <span class="kpi__n">{{ fmt(kpi.newInRange) }}</span>
                    <span class="kpi__l">Новых за период
                        <b v-if="kpi.delta !== null" class="kpi__d" :class="kpi.delta >= 0 ? 'up' : 'down'">
                            {{ kpi.delta >= 0 ? '+' : '' }}{{ kpi.delta }}%
                        </b>
                    </span>
                </div>
                <div class="kpi"><span class="kpi__n">{{ fmt(kpi.courses) }}</span><span class="kpi__l">Курсов</span></div>
                <div class="kpi"><span class="kpi__n">{{ fmt(kpi.events) }}</span><span class="kpi__l">Мероприятий</span></div>
                <div class="kpi"><span class="kpi__n">{{ fmt(kpi.sales) }}</span><span class="kpi__l">Продаж</span></div>
                <div class="kpi"><span class="kpi__n">{{ fmt(kpi.reports) }}</span><span class="kpi__l">Жалоб</span></div>
            </div>

            <!-- tabs -->
            <nav class="dash-tabs" role="tablist">
                <button v-for="t in TABS" :key="t.key" type="button" role="tab"
                        class="dash-tab" :class="{ 'is-on': active === t.key }" :aria-selected="active === t.key"
                        @click="active = t.key">{{ t.label }}</button>
            </nav>

            <!-- LIVE: Пользователи -->
            <section v-if="active === 'users'" class="dash-panel">
                <div class="panel-head">
                    <h2>Регистрации по {{ weekly ? 'неделям' : 'дням' }}</h2>
                    <span class="panel-note">{{ fmt(kpi.newInRange) }} за выбранный период</span>
                </div>
                <div class="panel-chart">
                    <MetricChart v-if="reg.labels.length" :labels="reg.labels" :datasets="reg.datasets" />
                    <div v-else class="panel-empty">Нет регистраций в этом периоде</div>
                </div>
            </section>

            <!-- Placeholders for later phases -->
            <section v-else class="dash-panel dash-panel--soon">
                <div class="soon">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
                    <h2>{{ activeTab.label }}</h2>
                    <p>{{ activeTab.soon }}</p>
                    <span class="soon__tag">Фаза {{ activeTab.phase }}</span>
                </div>
            </section>
        </template>
    </main>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getSupabase, loadUser, isLikelyLoggedIn } from '@/_front/chrome/headerAccount.js';
import MetricChart from './MetricChart.vue';

const router = useRouter();
const loading = ref(true);

/* ---------- date helpers ---------- */
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = ymd(new Date());
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- range state ---------- */
const PRESETS = [
    { key: '7', label: '7 дней', days: 7 },
    { key: '30', label: '30 дней', days: 30 },
    { key: '90', label: '90 дней', days: 90 },
    { key: 'all', label: 'Всё время', days: null },
];
const preset = ref('30');
const from = ref(daysAgo(30));
const to = ref(today);
const ALL_FROM = '2025-01-01';

function applyPreset(p) {
    preset.value = p.key;
    to.value = today;
    from.value = p.days ? daysAgo(p.days) : ALL_FROM;
    reload();
}
function onFrom(e) { from.value = e.target.value; preset.value = ''; reload(); }
function onTo(e) { to.value = e.target.value; preset.value = ''; reload(); }

/* ---------- tabs ---------- */
const TABS = [
    { key: 'money', label: 'Деньги', phase: 1, soon: 'Выручка и продажи, разбивка по спикерам и учебным заведениям. Считается через SECURITY DEFINER RPC.' },
    { key: 'users', label: 'Пользователи', phase: 2, soon: '' },
    { key: 'content', label: 'Курсы и мероприятия', phase: 3, soon: 'Сколько создано и продано, самые популярные курсы и мероприятия, черновики против опубликованных.' },
    { key: 'moder', label: 'Чаты и модерация', phase: 4, soon: 'Динамика жалоб (stream_reports), активные чаты и объём сообщений.' },
];
const active = ref('users');
const activeTab = computed(() => TABS.find((t) => t.key === active.value) || TABS[0]);

/* ---------- data ---------- */
let sb = null;
const kpi = reactive({ users: 0, newInRange: 0, delta: null, courses: 0, events: 0, sales: 0, reports: 0 });
const reg = reactive({ labels: [], datasets: [] });
const weekly = ref(false);

async function count(table, build) {
    let q = sb.from(table).select('id', { count: 'exact', head: true });
    if (build) q = build(q);
    const { count: n } = await q;
    return n || 0;
}
function startOfWeek(d) { const x = new Date(d); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x; }
function bucketKeys(f, t, byWeek) {
    const keys = []; let cur = byWeek ? startOfWeek(f) : new Date(f); const end = new Date(t);
    while (cur <= end) { keys.push(ymd(cur)); cur = new Date(cur); cur.setDate(cur.getDate() + (byWeek ? 7 : 1)); }
    return keys;
}
const label = (k) => { const [, m, d] = k.split('-'); return `${d}.${m}`; };

async function loadRegistrations() {
    const f = new Date(from.value + 'T00:00:00');
    const t = new Date(to.value + 'T23:59:59.999');
    const span = Math.round((t - f) / 86400000);
    weekly.value = span > 92;

    const { data } = await sb.from('users').select('created_at')
        .gte('created_at', f.toISOString()).lte('created_at', t.toISOString()).limit(100000);
    const rows = data || [];

    const keys = bucketKeys(f, t, weekly.value);
    const idx = new Map(keys.map((k, i) => [k, i]));
    const counts = new Array(keys.length).fill(0);
    for (const r of rows) {
        if (!r.created_at) continue;
        const d = new Date(r.created_at);
        const key = ymd(weekly.value ? startOfWeek(d) : d);
        const i = idx.get(key);
        if (i != null) counts[i] += 1;
    }
    reg.labels = keys.map((k) => label(k));
    reg.datasets = [{
        label: 'Регистрации', data: counts, borderColor: '#5495f3', backgroundColor: 'rgba(84,149,243,0.14)',
        fill: true, tension: 0.35, borderWidth: 2, pointRadius: keys.length > 40 ? 0 : 3, pointHoverRadius: 4,
    }];
    kpi.newInRange = rows.length;
}
async function loadDelta() {
    const f = new Date(from.value + 'T00:00:00'); const t = new Date(to.value + 'T23:59:59.999');
    const span = t - f; if (span <= 0) { kpi.delta = null; return; }
    const prevTo = new Date(f.getTime() - 1); const prevFrom = new Date(f.getTime() - span);
    const prev = await count('users', (q) => q.gte('created_at', prevFrom.toISOString()).lte('created_at', prevTo.toISOString()));
    kpi.delta = prev > 0 ? Math.round((kpi.newInRange - prev) / prev * 100) : (kpi.newInRange > 0 ? 100 : 0);
}
async function reload() {
    await loadRegistrations();
    await loadDelta();
}
async function loadStatics() {
    [kpi.users, kpi.courses, kpi.events, kpi.sales, kpi.reports] = await Promise.all([
        count('users'), count('course'), count('events'), count('sales'), count('stream_reports'),
    ]);
}

/* ---------- gate + boot ---------- */
onMounted(async () => {
    if (!isLikelyLoggedIn()) { router.replace('/login'); return; }
    for (let i = 0; i < 40 && !getSupabase(); i++) await sleep(150);
    sb = getSupabase();
    if (!sb) { router.replace('/'); return; }

    const me = await loadUser(sb);
    const isAdmin = !!me && (me.role === 'admin' || me.superadmin === true);
    if (!isAdmin) { router.replace('/'); return; }

    await Promise.all([loadStatics(), reload()]);
    loading.value = false;
});

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU');
</script>

<style scoped>
.dash {
    min-height: calc(100vh - 62px);
    background: #f4f5f7;
    color: #1b1f27;
    font-family: 'Onest', system-ui, -apple-system, sans-serif;
    padding: 24px 20px 64px;
    max-width: 1200px; margin: 0 auto;
    box-sizing: border-box;
}
.dash * { box-sizing: border-box; }
.dash-boot { text-align: center; color: #8a94a6; padding: 80px 0; }

.dash-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.dash-title { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; margin: 0; }
.dash-sub { margin: 4px 0 0; color: #8a94a6; font-size: 14px; }
.dash-modlink { display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 16px; border-radius: 10px;
    background: #fff; border: 1px solid #e1e5ea; color: #1b1f27; font-weight: 600; font-size: 14px; text-decoration: none; }
.dash-modlink:hover { border-color: #5495f3; color: #5495f3; }
.dash-modlink svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

.dash-range { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 20px 0 18px; }
.dash-preset { height: 36px; padding: 0 14px; border-radius: 9px; border: 1px solid #e1e5ea; background: #fff; color: #5b6472; font-weight: 600; font-size: 13px; cursor: pointer; }
.dash-preset.is-on { background: #5495f3; border-color: #5495f3; color: #fff; }
.dash-range__sep { width: 1px; height: 24px; background: #e1e5ea; margin: 0 4px; }
.dash-date { display: inline-flex; align-items: center; gap: 6px; color: #8a94a6; font-size: 13px; }
.dash-date input { height: 36px; border: 1px solid #e1e5ea; border-radius: 9px; padding: 0 10px; font: inherit; color: #1b1f27; background: #fff; }

.dash-kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 22px; }
.kpi { background: #fff; border: 1px solid #eceef2; border-radius: 14px; padding: 16px 16px 14px; display: flex; flex-direction: column; gap: 4px; }
.kpi--accent { background: linear-gradient(180deg, #f2f7ff, #fff); border-color: #d9e6fb; }
.kpi__n { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.1; }
.kpi__l { font-size: 13px; color: #8a94a6; display: flex; align-items: center; gap: 6px; }
.kpi__d { font-weight: 700; font-size: 12px; }
.kpi__d.up { color: #3ba55d; } .kpi__d.down { color: #e2574c; }

.dash-tabs { display: flex; gap: 6px; flex-wrap: wrap; border-bottom: 1px solid #e3e7ee; margin-bottom: 18px; }
.dash-tab { appearance: none; border: none; background: transparent; padding: 10px 14px; font: inherit; font-weight: 600; font-size: 14px; color: #5b6472; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.dash-tab:hover { color: #5495f3; }
.dash-tab.is-on { color: #5495f3; border-bottom-color: #5495f3; }

.dash-panel { background: #fff; border: 1px solid #eceef2; border-radius: 16px; padding: 20px; }
.panel-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.panel-head h2 { font-size: 17px; font-weight: 700; margin: 0; }
.panel-note { color: #8a94a6; font-size: 13px; }
.panel-chart { height: 320px; }
.panel-empty { display: flex; align-items: center; justify-content: center; height: 100%; color: #8a94a6; }

.dash-panel--soon { padding: 0; }
.soon { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 56px 24px; }
.soon svg { width: 40px; height: 40px; fill: none; stroke: #c2ccda; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.soon h2 { margin: 4px 0 0; font-size: 18px; }
.soon p { margin: 0; max-width: 460px; color: #8a94a6; font-size: 14px; line-height: 1.5; }
.soon__tag { margin-top: 6px; padding: 4px 12px; border-radius: 999px; background: #eef4ff; color: #5495f3; font-weight: 700; font-size: 12px; }

@media (max-width: 900px) { .dash-kpis { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 560px) { .dash-kpis { grid-template-columns: repeat(2, 1fr); } .dash-title { font-size: 22px; } }
</style>
