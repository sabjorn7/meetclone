<!--
  DashboardPage.vue — "/dashboard" admin analytics panel (Yandex.Metrika-style), hand-written
  rebuild of the dead WeWeb dashboard.
    Ф0: access gate + shell (date range, tabs, KPI tiles) + "Пользователи" (registrations chart).
    Ф1: "Деньги" tab — revenue over time (paid orders) + sales attribution by author, via two
        SECURITY DEFINER RPCs (admin_revenue_daily / admin_sales_by_author, admin-gated inside).
    Ф3/Ф4: "Курсы и мероприятия" / "Чаты и модерация" are still Фаза-N placeholders.

  ACCESS (admin-only): guest → /login; logged in but not admin (role!=='admin' && !superadmin) → /.
  Moderation actions live on /superadmin — cross-linked from the header here.
  Data: simple counters + registrations = direct queries; money = admin-gated RPCs. RLS is off.
-->
<template>
    <main class="dash">
        <div v-if="loading" class="dash-boot">Загрузка панели…</div>

        <template v-else>
            <!-- sub-header: title + moderation link -->
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

            <!-- LIVE: Деньги -->
            <section v-if="active === 'money'" class="dash-panel">
                <div v-if="moneyLoading" class="panel-empty" style="height:200px">Загрузка…</div>
                <template v-else>
                    <div class="dash-subkpis">
                        <div class="skpi"><span class="skpi__n">{{ fmtRub(money.revenue) }}</span><span class="skpi__l">Выручка (оплаченные заказы)</span></div>
                        <div class="skpi"><span class="skpi__n">{{ fmt(money.orders) }}</span><span class="skpi__l">Заказов</span></div>
                        <div class="skpi"><span class="skpi__n">{{ fmtRub(money.avg) }}</span><span class="skpi__l">Средний чек</span></div>
                        <div class="skpi"><span class="skpi__n">{{ fmtRub(money.accrued) }}</span><span class="skpi__l">Начислено авторам</span></div>
                    </div>

                    <div class="panel-head">
                        <h2>Выручка по {{ weekly ? 'неделям' : 'дням' }}</h2>
                        <span class="panel-note">оплаченные заказы за период</span>
                    </div>
                    <div class="panel-chart">
                        <MetricChart v-if="money.rev.labels.length && money.revenue" :labels="money.rev.labels" :datasets="money.rev.datasets" />
                        <div v-else class="panel-empty">Нет оплат в этом периоде</div>
                    </div>

                    <div class="panel-head" style="margin-top:24px">
                        <h2>Продажи по авторам</h2>
                        <span class="panel-note">
                            Учебные заведения {{ fmtRub(money.roleSplit.edu) }} · Спикеры {{ fmtRub(money.roleSplit.speaker) }}<template v-if="money.roleSplit.other"> · Прочее {{ fmtRub(money.roleSplit.other) }}</template>
                        </span>
                    </div>
                    <div v-if="money.authors.length" class="dash-tablewrap">
                        <table class="dash-table">
                            <thead>
                                <tr><th>Автор</th><th>Роль</th><th class="num">Продаж</th><th class="num">Выручка</th><th class="num">Начислено</th></tr>
                            </thead>
                            <tbody>
                                <tr v-for="a in money.authors" :key="a.author_id || a.name || Math.random()">
                                    <td>{{ a.name || 'Не указан' }}</td>
                                    <td><span class="role-badge" :class="roleCls(a.role)">{{ a.role }}</span></td>
                                    <td class="num">{{ fmt(a.sales_n) }}</td>
                                    <td class="num strong">{{ fmtRub(a.gross) }}</td>
                                    <td class="num muted">{{ fmtRub(a.accrued) }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div v-else class="panel-empty">Нет продаж в этом периоде</div>
                    <p class="dash-foot">Атрибуция по авторам считается из начислений (sales) и может немного отличаться от суммы оплаченных заказов из-за возвратов и подписок.</p>
                </template>
            </section>

            <!-- LIVE: Пользователи -->
            <section v-else-if="active === 'users'" class="dash-panel">
                <div class="panel-head">
                    <h2>Регистрации по {{ weekly ? 'неделям' : 'дням' }}</h2>
                    <span class="panel-note">{{ fmt(kpi.newInRange) }} за выбранный период</span>
                </div>
                <div class="panel-chart">
                    <MetricChart v-if="reg.labels.length" :labels="reg.labels" :datasets="reg.datasets" />
                    <div v-else class="panel-empty">Нет регистраций в этом периоде</div>
                </div>
            </section>

            <!-- LIVE: Курсы и мероприятия -->
            <section v-else-if="active === 'content'" class="dash-panel">
                <div v-if="contentLoading" class="panel-empty" style="height:160px">Загрузка…</div>
                <template v-else>
                    <div class="dash-subkpis">
                        <div class="skpi"><span class="skpi__n">{{ fmt(content.total) }}</span><span class="skpi__l">Курсов всего</span></div>
                        <div class="skpi"><span class="skpi__n">{{ fmt(content.published) }}</span><span class="skpi__l">Опубликовано</span></div>
                        <div class="skpi"><span class="skpi__n">{{ fmt(content.drafts) }}</span><span class="skpi__l">Черновиков</span></div>
                        <div class="skpi"><span class="skpi__n">{{ fmt(content.createdInRange) }}</span><span class="skpi__l">Создано за период</span></div>
                    </div>

                    <div class="panel-head"><h2>Статусы курсов</h2><span class="panel-note">снимок сейчас</span></div>
                    <div class="statbars">
                        <div v-for="s in content.statuses" :key="s.label" class="statbar">
                            <span class="statbar__lbl">{{ s.label }}</span>
                            <span class="statbar__track"><span class="statbar__fill" :style="{ width: s.pct + '%', background: s.color }"></span></span>
                            <span class="statbar__n">{{ fmt(s.n) }}</span>
                        </div>
                    </div>

                    <div class="two-col">
                        <div class="two-col__c">
                            <div class="panel-head"><h2>Топ по ученикам</h2><span class="panel-note">за период</span></div>
                            <div v-if="content.topEnroll.length" class="dash-tablewrap">
                                <table class="dash-table">
                                    <thead><tr><th>Курс</th><th>Статус</th><th class="num">Учеников</th></tr></thead>
                                    <tbody>
                                        <tr v-for="c in content.topEnroll" :key="c.course_id || c.title">
                                            <td><div class="ttl">{{ c.title || 'Без названия' }}</div><div class="sub">{{ c.owner }}</div></td>
                                            <td><span class="role-badge" :class="statusCls(c.status)">{{ c.status || '—' }}</span></td>
                                            <td class="num strong">{{ fmt(c.enroll_n) }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div v-else class="panel-empty" style="height:120px">Нет данных за период</div>
                        </div>
                        <div class="two-col__c">
                            <div class="panel-head"><h2>Топ по выручке</h2><span class="panel-note">за период</span></div>
                            <div v-if="content.topRevenue.length" class="dash-tablewrap">
                                <table class="dash-table">
                                    <thead><tr><th>Курс</th><th class="num">Продаж</th><th class="num">Выручка</th></tr></thead>
                                    <tbody>
                                        <tr v-for="c in content.topRevenue" :key="c.course_id || c.title">
                                            <td><div class="ttl">{{ c.title || 'Без названия' }}</div></td>
                                            <td class="num muted">{{ fmt(c.sales_n) }}</td>
                                            <td class="num strong">{{ fmtRub(c.revenue) }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div v-else class="panel-empty" style="height:120px">Нет продаж за период</div>
                        </div>
                    </div>
                    <p class="dash-foot">Ученики — все владения курсом (user_course), включая бесплатные и выданные доступы. Выручка по курсам считается из начислений (sales→shop) и покрывает не все продажи (подписки без привязки к курсу не учитываются).</p>

                    <div class="ev-empty">
                        <h2>Мероприятия</h2>
                        <p>Мероприятий пока нет — раздел оживёт, когда появятся события и оплаченные регистрации.</p>
                    </div>
                </template>
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
import { ref, reactive, computed, watch, onMounted } from 'vue';
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
const rangeKey = () => `${from.value}_${to.value}`;

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
    { key: 'money', label: 'Деньги', phase: 1, soon: '' },
    { key: 'users', label: 'Пользователи', phase: 2, soon: '' },
    { key: 'content', label: 'Курсы и мероприятия', phase: 3, soon: 'Сколько создано и продано, самые популярные курсы и мероприятия, черновики против опубликованных.' },
    { key: 'moder', label: 'Чаты и модерация', phase: 4, soon: 'Динамика жалоб (stream_reports), активные чаты и объём сообщений.' },
];
const active = ref('money');
const activeTab = computed(() => TABS.find((t) => t.key === active.value) || TABS[0]);

/* ---------- shared bucketing ---------- */
function startOfWeek(d) { const x = new Date(d); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x; }
function bucketKeys(f, t, byWeek) {
    const keys = []; let cur = byWeek ? startOfWeek(f) : new Date(f); const end = new Date(t);
    while (cur <= end) { keys.push(ymd(cur)); cur = new Date(cur); cur.setDate(cur.getDate() + (byWeek ? 7 : 1)); }
    return keys;
}
const label = (k) => { const [, m, d] = k.split('-'); return `${d}.${m}`; };
// dayMap: 'YYYY-MM-DD' -> number. Buckets by day, or by week (sum) when the span > 92 days.
function seriesFromDayMap(dayMap) {
    const f = new Date(from.value + 'T00:00:00');
    const t = new Date(to.value + 'T23:59:59.999');
    const byWeek = Math.round((t - f) / 86400000) > 92;
    const keys = bucketKeys(f, t, byWeek);
    const data = keys.map((k) => {
        if (!byWeek) return dayMap.get(k) || 0;
        let sum = 0; const ws = new Date(k + 'T00:00:00');
        for (let i = 0; i < 7; i++) { const d = new Date(ws); d.setDate(d.getDate() + i); sum += dayMap.get(ymd(d)) || 0; }
        return sum;
    });
    return { byWeek, labels: keys.map((k) => label(k)), data };
}

/* ---------- data ---------- */
let sb = null;
const kpi = reactive({ users: 0, newInRange: 0, delta: null, courses: 0, events: 0, sales: 0, reports: 0 });
const reg = reactive({ labels: [], datasets: [] });
const weekly = ref(false);
const moneyLoading = ref(false);
const moneyKey = ref('');
const money = reactive({
    revenue: 0, orders: 0, avg: 0, accrued: 0,
    rev: { labels: [], datasets: [] },
    authors: [], roleSplit: { edu: 0, speaker: 0, other: 0 },
});
const contentLoading = ref(false);
const contentKey = ref('');
const content = reactive({
    total: 0, published: 0, drafts: 0, statuses: [],
    createdInRange: 0, topEnroll: [], topRevenue: [],
});
// Course ModStatus -> colour + badge class. Extras fall back to the "draft" grey.
const STATUS_META = {
    'Опубликовано': { color: '#3ba55d', cls: 'ok' },
    'Черновик': { color: '#8a94a6', cls: 'draft' },
    'Снято с публикации': { color: '#e2574c', cls: 'off' },
    'Отправлено на доработку': { color: '#f0a92e', cls: 'fix' },
};

async function count(table, build) {
    let q = sb.from(table).select('id', { count: 'exact', head: true });
    if (build) q = build(q);
    const { count: n } = await q;
    return n || 0;
}

async function loadRegistrations() {
    const f = new Date(from.value + 'T00:00:00');
    const t = new Date(to.value + 'T23:59:59.999');
    const { data } = await sb.from('users').select('created_at')
        .gte('created_at', f.toISOString()).lte('created_at', t.toISOString()).limit(100000);
    const rows = data || [];
    const dayMap = new Map();
    for (const r of rows) { if (!r.created_at) continue; const k = ymd(new Date(r.created_at)); dayMap.set(k, (dayMap.get(k) || 0) + 1); }
    const s = seriesFromDayMap(dayMap);
    weekly.value = s.byWeek;
    reg.labels = s.labels;
    reg.datasets = [{
        label: 'Регистрации', data: s.data, borderColor: '#5495f3', backgroundColor: 'rgba(84,149,243,0.14)',
        fill: true, tension: 0.35, borderWidth: 2, pointRadius: s.labels.length > 40 ? 0 : 3, pointHoverRadius: 4,
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
async function loadMoney() {
    moneyLoading.value = true;
    try {
        const p_from = from.value, p_to = to.value;
        const [rev, auth] = await Promise.all([
            sb.rpc('admin_revenue_daily', { p_from, p_to }),
            sb.rpc('admin_sales_by_author', { p_from, p_to }),
        ]);
        if (rev.error) throw rev.error;
        if (auth.error) throw auth.error;

        const daily = Array.isArray(rev.data) ? rev.data : [];
        const dayMap = new Map();
        let revenue = 0, orders = 0;
        for (const r of daily) { const v = Number(r.revenue) || 0; dayMap.set(r.d, v); revenue += v; orders += Number(r.orders) || 0; }
        const s = seriesFromDayMap(dayMap);
        money.revenue = revenue; money.orders = orders; money.avg = orders ? Math.round(revenue / orders) : 0;
        money.rev = { labels: s.labels, datasets: [{
            label: 'Выручка', data: s.data, borderColor: '#2fa971', backgroundColor: 'rgba(47,169,113,0.14)',
            fill: true, tension: 0.35, borderWidth: 2, pointRadius: s.labels.length > 40 ? 0 : 3, pointHoverRadius: 4,
        }] };

        const authors = Array.isArray(auth.data) ? auth.data : [];
        const split = { edu: 0, speaker: 0, other: 0 };
        let accrued = 0;
        for (const a of authors) {
            accrued += Number(a.accrued) || 0;
            const g = Number(a.gross) || 0;
            if (a.role === 'Учебное заведение') split.edu += g;
            else if (a.role === 'Спикер') split.speaker += g;
            else split.other += g;
        }
        money.accrued = accrued; money.authors = authors; money.roleSplit = split;
        moneyKey.value = rangeKey();
    } catch (e) {
        console.warn('loadMoney failed', e);
        money.revenue = 0; money.orders = 0; money.avg = 0; money.accrued = 0;
        money.rev = { labels: [], datasets: [] }; money.authors = []; money.roleSplit = { edu: 0, speaker: 0, other: 0 };
    }
    moneyLoading.value = false;
}
// Snapshot (current portfolio, not range-dependent): course statuses via a direct fetch.
async function loadContentSnapshot() {
    const { data } = await sb.from('course').select('ModStatus').limit(100000);
    const rows = data || [];
    const map = new Map();
    for (const r of rows) { const k = r.ModStatus || '∅'; map.set(k, (map.get(k) || 0) + 1); }
    content.total = rows.length;
    content.published = map.get('Опубликовано') || 0;
    content.drafts = map.get('Черновик') || 0;
    const order = [...Object.keys(STATUS_META).filter((k) => map.has(k)), ...[...map.keys()].filter((k) => !STATUS_META[k])];
    const max = Math.max(1, ...order.map((k) => map.get(k) || 0));
    content.statuses = order.map((k) => ({
        label: k, n: map.get(k) || 0,
        color: STATUS_META[k]?.color || '#5495f3',
        pct: Math.round((map.get(k) || 0) / max * 100),
    }));
}
// Range-dependent: courses created in range (direct) + top courses (admin-gated RPC).
async function loadContentRange() {
    const f = new Date(from.value + 'T00:00:00'); const t = new Date(to.value + 'T23:59:59.999');
    content.createdInRange = await count('course', (q) => q.gte('created_at', f.toISOString()).lte('created_at', t.toISOString()));
    const { data, error } = await sb.rpc('admin_top_courses', { p_from: from.value, p_to: to.value, p_limit: 8 });
    if (error) { console.warn('admin_top_courses failed', error); content.topEnroll = []; content.topRevenue = []; return; }
    content.topEnroll = Array.isArray(data?.by_enroll) ? data.by_enroll : [];
    content.topRevenue = Array.isArray(data?.by_revenue) ? data.by_revenue : [];
}
async function loadContent() {
    contentLoading.value = true;
    try {
        if (!content.total) await loadContentSnapshot();
        await loadContentRange();
        contentKey.value = rangeKey();
    } catch (e) { console.warn('loadContent failed', e); }
    contentLoading.value = false;
}
async function reload() {
    await loadRegistrations();
    await loadDelta();
    if (active.value === 'money') await loadMoney();
    if (active.value === 'content') await loadContent();
}
async function loadStatics() {
    [kpi.users, kpi.courses, kpi.events, kpi.sales, kpi.reports] = await Promise.all([
        count('users'), count('course'), count('events'), count('sales'), count('stream_reports'),
    ]);
}

// Lazy-load a tab's data the first time it's opened for the current range.
watch(active, (t) => {
    if (t === 'money' && moneyKey.value !== rangeKey()) loadMoney();
    if (t === 'content' && contentKey.value !== rangeKey()) loadContent();
});

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
const fmtRub = (n) => `${Math.round(Number(n) || 0).toLocaleString('ru-RU')} ₽`;
const roleCls = (role) => role === 'Учебное заведение' ? 'edu' : (role === 'Спикер' ? 'speaker' : 'other');
const statusCls = (s) => STATUS_META[s]?.cls || 'draft';
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
.panel-note { color: #8a94a6; font-size: 13px; text-align: right; }
.panel-chart { height: 320px; }
.panel-empty { display: flex; align-items: center; justify-content: center; height: 100%; color: #8a94a6; }

/* Деньги sub-KPIs */
.dash-subkpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
.skpi { background: #f7f9fc; border: 1px solid #eef1f5; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 4px; }
.skpi__n { font-size: 21px; font-weight: 800; letter-spacing: -0.02em; }
.skpi__l { font-size: 12px; color: #8a94a6; }

/* authors table */
.dash-tablewrap { overflow-x: auto; }
.dash-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.dash-table th { text-align: left; font-weight: 600; color: #8a94a6; font-size: 12px; padding: 8px 10px; border-bottom: 1px solid #eceef2; }
.dash-table td { padding: 10px; border-bottom: 1px solid #f2f4f7; }
.dash-table .num { text-align: right; white-space: nowrap; }
.dash-table .strong { font-weight: 700; }
.dash-table .muted { color: #8a94a6; }
.role-badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.role-badge.edu { background: #f0eafe; color: #7c4dff; }
.role-badge.speaker { background: #eaf2ff; color: #3d7ce0; }
.role-badge.other { background: #eef1f5; color: #8a94a6; }
.dash-foot { margin: 14px 0 0; color: #a4adba; font-size: 12px; line-height: 1.5; }

/* status badges (course ModStatus) */
.role-badge.ok { background: #e7f6ec; color: #2f9e57; }
.role-badge.draft { background: #eef1f5; color: #8a94a6; }
.role-badge.off { background: #fdeceb; color: #d1483d; }
.role-badge.fix { background: #fef3e2; color: #c9871a; }

/* course status horizontal bars */
.statbars { display: flex; flex-direction: column; gap: 10px; margin-bottom: 8px; }
.statbar { display: grid; grid-template-columns: 190px 1fr 56px; align-items: center; gap: 12px; }
.statbar__lbl { font-size: 13px; color: #5b6472; }
.statbar__track { height: 12px; border-radius: 999px; background: #f2f4f7; overflow: hidden; }
.statbar__fill { display: block; height: 100%; border-radius: 999px; min-width: 3px; }
.statbar__n { text-align: right; font-weight: 700; font-size: 14px; }

/* two side-by-side top lists */
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 22px; }
.two-col__c { min-width: 0; }
.dash-table .ttl { font-weight: 500; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dash-table .sub { font-size: 12px; color: #8a94a6; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.ev-empty { margin-top: 24px; padding: 22px; border: 1px dashed #dde2ea; border-radius: 14px; text-align: center; }
.ev-empty h2 { margin: 0 0 6px; font-size: 16px; }
.ev-empty p { margin: 0; color: #8a94a6; font-size: 14px; }

@media (max-width: 720px) {
    .two-col { grid-template-columns: 1fr; gap: 20px; }
    .statbar { grid-template-columns: 130px 1fr 48px; }
    .statbar__lbl { font-size: 12px; }
}

.dash-panel--soon { padding: 0; }
.soon { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 56px 24px; }
.soon svg { width: 40px; height: 40px; fill: none; stroke: #c2ccda; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.soon h2 { margin: 4px 0 0; font-size: 18px; }
.soon p { margin: 0; max-width: 460px; color: #8a94a6; font-size: 14px; line-height: 1.5; }
.soon__tag { margin-top: 6px; padding: 4px 12px; border-radius: 999px; background: #eef4ff; color: #5495f3; font-weight: 700; font-size: 12px; }

@media (max-width: 900px) { .dash-kpis { grid-template-columns: repeat(3, 1fr); } .dash-subkpis { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px) { .dash-kpis { grid-template-columns: repeat(2, 1fr); } .dash-title { font-size: 22px; } }
</style>
