<!--
  SuperadminPage.vue — hand-written rebuild of the WeWeb /superadmin admin back-office.
  Built at /superadmin-demo FIRST; the live WeWeb /superadmin stays untouched until each tab
  is proven, then /superadmin is swapped via PAGE_OVERRIDES. Shares the visual language + isAdmin
  gate with DashboardPage (analytics). This is a WRITE surface (real money + publishing) — but
  S0 is shell-only: tab nav + read-only queue-count badges, NO mutations yet.

    S0 (this): shell + gate + tabs + queue counts.  S1 Курсы · S2 Статьи · S3 Жалобы(UGC) ·
    S4 Комиссия · S5 Выплаты · S6 Видео — each adds real admin actions behind admin-gated RPCs.

  ACCESS (admin-only): guest → /login; logged in but not admin (role!=='admin' && !superadmin) → /.
-->
<template>
    <main class="sa">
        <div v-if="loading" class="sa-boot">Загрузка…</div>

        <template v-else>
            <header class="sa-top">
                <div class="sa-top__l">
                    <h1 class="sa-title">Модерация</h1>
                    <p class="sa-sub">Панель администратора · действия с реальными последствиями</p>
                </div>
                <a class="sa-analytics" href="/dashboard">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>
                    Аналитика
                </a>
            </header>

            <nav class="sa-tabs" role="tablist">
                <button v-for="t in TABS" :key="t.key" type="button" role="tab"
                        class="sa-tab" :class="{ 'is-on': active === t.key }" :aria-selected="active === t.key"
                        @click="active = t.key">
                    {{ t.label }}
                    <span v-if="counts[t.key]" class="sa-badge">{{ counts[t.key] }}</span>
                </button>
            </nav>

            <!-- LIVE: Курсы -->
            <section v-if="active === 'courses'" class="sa-panel sa-pad">
                <div class="sa-panelhead">
                    <h2>Очередь на модерацию</h2>
                    <span class="sa-note">Статус «Отправлено на модерацию»</span>
                </div>
                <div v-if="queue.loading" class="sa-empty">Загрузка…</div>
                <div v-else-if="!queue.rows.length" class="sa-empty">Очередь пуста</div>
                <div v-else class="sa-tablewrap">
                    <table class="sa-table">
                        <thead><tr><th>Название</th><th>Автор</th><th>Создан</th><th class="ta-r">Действия</th></tr></thead>
                        <tbody>
                            <tr v-for="c in queue.rows" :key="c.id">
                                <td class="ttl">{{ c.Title || 'Без названия' }}</td>
                                <td>{{ c.ownerName }}<span v-if="c.ownerRole" class="role-chip">{{ c.ownerRole }}</span></td>
                                <td class="muted">{{ fmtDate(c.created_at) }}</td>
                                <td class="ta-r acts">
                                    <button type="button" class="btn btn-ok" @click="askApprove(c)">Одобрить</button>
                                    <button type="button" class="btn btn-ghost" @click="askReturn(c)">Вернуть</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <!-- Placeholders for the other phases -->
            <section v-else class="sa-panel sa-soon">
                <div class="soon">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
                    <h2>{{ activeTab.label }}</h2>
                    <p>{{ activeTab.descr }}</p>
                    <span v-if="counts[active]" class="soon__queue">В очереди: {{ counts[active] }}</span>
                    <span class="soon__tag">Фаза {{ activeTab.phase }}</span>
                </div>
            </section>

            <!-- Confirmation modal (mandatory before any mutation) -->
            <div v-if="modal.open" class="sa-modal" @click.self="closeModal">
                <div class="sa-modal__box" role="dialog" aria-modal="true">
                    <template v-if="modal.mode === 'approve'">
                        <h3>Опубликовать курс?</h3>
                        <p class="sa-modal__course">«{{ modal.course?.Title }}»</p>
                        <p class="sa-modal__warn">⚠️ Курс станет виден всем пользователям платформы.</p>
                    </template>
                    <template v-else>
                        <h3>Вернуть на доработку?</h3>
                        <p class="sa-modal__course">«{{ modal.course?.Title }}»</p>
                        <p class="sa-modal__hint">Автор увидит этот комментарий в своём кабинете.</p>
                        <textarea v-model="modal.comment" class="sa-modal__ta" rows="4" placeholder="Что нужно исправить"></textarea>
                    </template>
                    <p v-if="modal.error" class="sa-modal__err">{{ modal.error }}</p>
                    <div class="sa-modal__acts">
                        <button type="button" class="btn btn-ghost" :disabled="modal.busy" @click="closeModal">Отмена</button>
                        <button type="button" class="btn" :class="modal.mode === 'approve' ? 'btn-ok' : 'btn-warn'"
                                :disabled="modal.busy || (modal.mode === 'return' && !modal.comment.trim())" @click="confirmAction">
                            {{ modal.busy ? 'Сохранение…' : (modal.mode === 'approve' ? 'Опубликовать' : 'Вернуть') }}
                        </button>
                    </div>
                </div>
            </div>

            <div v-if="toastMsg" class="sa-toast">{{ toastMsg }}</div>
        </template>
    </main>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getSupabase, loadUser, isLikelyLoggedIn } from '@/_front/chrome/headerAccount.js';

const router = useRouter();
const loading = ref(true);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TABS = [
    { key: 'courses', label: 'Курсы', phase: 'S1', descr: 'Очередь на модерацию курсов: публикация и возврат на доработку с замечаниями.' },
    { key: 'articles', label: 'Статьи', phase: 'S2', descr: 'Модерация статей со статусами, замечаниями и логом изменений.' },
    { key: 'reports', label: 'Жалобы', phase: 'S3', descr: 'Жалобы на сообщения и пользователей (stream_reports) и блокировки — интерфейса пока нет, строим с нуля.' },
    { key: 'commission', label: 'Комиссия', phase: 'S4', descr: 'Комиссия авторов и корректировка баланса пользователей.' },
    { key: 'payouts', label: 'Выплаты', phase: 'S5', descr: 'Одобрение и отклонение заявок на вывод средств. Самое ответственное — реальные деньги.' },
    { key: 'video', label: 'Видео', phase: 'S6', descr: 'Инфраструктура видео (PeerTube): токены, обработка загрузок.' },
];
const active = ref('courses');
const activeTab = computed(() => TABS.find((t) => t.key === active.value) || TABS[0]);

// Read-only queue counts (SELECT only — safe). Keyed by tab; only the ones we can define now.
const counts = reactive({ courses: 0, reports: 0, payouts: 0 });

let sb = null;
async function countEq(table, col, val) {
    let q = sb.from(table).select('id', { count: 'exact', head: true });
    if (col) q = q.eq(col, val);
    const { count } = await q;
    return count || 0;
}
async function loadCounts() {
    const [courses, reports, payouts] = await Promise.all([
        countEq('course', 'ModStatus', 'Отправлено на модерацию'),
        countEq('stream_reports'),
        countEq('sales', 'status', 'Запрошено'),
    ]);
    counts.courses = courses; counts.reports = reports; counts.payouts = payouts;
}

/* ── S1: Курсы — moderation queue + actions ─────────────────────────────────── */
const queue = reactive({ loading: false, rows: [] });
const modal = reactive({ open: false, mode: null, course: null, comment: '', busy: false, error: '' });
const toastMsg = ref('');
let toastTimer = null;
function toast(m) { toastMsg.value = m; if (toastTimer) clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastMsg.value = ''; }, 3000); }
function fmtDate(iso) { if (!iso) return ''; const d = new Date(iso); const p = (n) => String(n).padStart(2, '0'); return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`; }

async function loadQueue() {
    queue.loading = true;
    try {
        const { data } = await sb.from('course').select('id,"Title",created_at,owner')
            .in('ModStatus', ['Отправлено на модерацию', 'На модерации'])
            .order('created_at', { ascending: true });
        const rows = data || [];
        const ids = [...new Set(rows.map((r) => r.owner).filter(Boolean))];
        const owners = {};
        if (ids.length) {
            const { data: us } = await sb.from('users').select('id,"Name",role').in('id', ids);
            for (const u of (us || [])) owners[u.id] = u;
        }
        queue.rows = rows.map((r) => ({ ...r, ownerName: owners[r.owner]?.Name || '—', ownerRole: owners[r.owner]?.role || '' }));
        counts.courses = queue.rows.length;
    } catch (e) { console.warn('loadQueue failed', e); }
    queue.loading = false;
}

function askApprove(c) { modal.open = true; modal.mode = 'approve'; modal.course = c; modal.comment = ''; modal.error = ''; }
function askReturn(c) { modal.open = true; modal.mode = 'return'; modal.course = c; modal.comment = ''; modal.error = ''; }
function closeModal() { if (modal.busy) return; modal.open = false; modal.course = null; modal.comment = ''; modal.error = ''; }

function friendlyError(e) {
    const m = e?.message || '';
    if (/forbidden/i.test(m)) return 'Нет прав администратора.';
    if (/not in moderation queue/i.test(m)) return 'Курс уже не в очереди — обновите список.';
    if (/not found/i.test(m)) return 'Курс не найден.';
    if (/comment required/i.test(m)) return 'Укажите комментарий для автора.';
    return `Не удалось выполнить: ${m || 'ошибка'}`;
}

async function confirmAction() {
    if (modal.busy || !modal.course) return;
    if (modal.mode === 'return' && !modal.comment.trim()) { modal.error = 'Укажите комментарий для автора.'; return; }
    modal.busy = true; modal.error = '';
    try {
        const id = modal.course.id;
        const { error } = modal.mode === 'approve'
            ? await sb.rpc('admin_approve_course', { p_course: id })
            : await sb.rpc('admin_return_course', { p_course: id, p_comment: modal.comment.trim() });
        if (error) throw error;
        queue.rows = queue.rows.filter((r) => r.id !== id);
        counts.courses = queue.rows.length;
        modal.open = false; modal.course = null; modal.comment = '';
        toast(modal.mode === 'approve' ? 'Курс опубликован' : 'Курс возвращён на доработку');
    } catch (e) { modal.error = friendlyError(e); }
    modal.busy = false;
}

// load the queue when the Курсы tab is (or becomes) active
watch(active, (t) => { if (t === 'courses') loadQueue(); });

onMounted(async () => {
    if (!isLikelyLoggedIn()) { router.replace('/login'); return; }
    for (let i = 0; i < 40 && !getSupabase(); i++) await sleep(150);
    sb = getSupabase();
    if (!sb) { router.replace('/'); return; }

    const me = await loadUser(sb);
    const isAdmin = !!me && (me.role === 'admin' || me.superadmin === true);
    if (!isAdmin) { router.replace('/'); return; }

    try { await loadCounts(); } catch (e) { console.warn('loadCounts failed', e); }
    if (active.value === 'courses') await loadQueue();
    loading.value = false;
});
</script>

<style scoped>
.sa {
    min-height: calc(100vh - 62px);
    background: #f4f5f7;
    color: #1b1f27;
    font-family: 'Onest', system-ui, -apple-system, sans-serif;
    padding: 24px 20px 64px;
    max-width: 1200px; margin: 0 auto;
    box-sizing: border-box;
}
.sa * { box-sizing: border-box; }
.sa-boot { text-align: center; color: #8a94a6; padding: 80px 0; }

.sa-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.sa-title { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; margin: 0; }
.sa-sub { margin: 4px 0 0; color: #8a94a6; font-size: 14px; }
.sa-analytics { display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 16px; border-radius: 10px;
    background: #fff; border: 1px solid #e1e5ea; color: #1b1f27; font-weight: 600; font-size: 14px; text-decoration: none; }
.sa-analytics:hover { border-color: #5495f3; color: #5495f3; }
.sa-analytics svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

.sa-tabs { display: flex; gap: 6px; flex-wrap: wrap; border-bottom: 1px solid #e3e7ee; margin: 22px 0 18px; }
.sa-tab { display: inline-flex; align-items: center; gap: 7px; appearance: none; border: none; background: transparent; padding: 10px 14px; font: inherit; font-weight: 600; font-size: 14px; color: #5b6472; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.sa-tab:hover { color: #5495f3; }
.sa-tab.is-on { color: #5495f3; border-bottom-color: #5495f3; }
.sa-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: #e2574c; color: #fff; font-size: 11px; font-weight: 700; }

.sa-panel { background: #fff; border: 1px solid #eceef2; border-radius: 16px; }
.sa-soon { padding: 0; }
.soon { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 56px 24px; }
.soon svg { width: 40px; height: 40px; fill: none; stroke: #c2ccda; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.soon h2 { margin: 4px 0 0; font-size: 18px; }
.soon p { margin: 0; max-width: 480px; color: #8a94a6; font-size: 14px; line-height: 1.5; }
.soon__queue { margin-top: 4px; padding: 4px 12px; border-radius: 999px; background: #fdeceb; color: #d1483d; font-weight: 700; font-size: 12px; }
.soon__tag { margin-top: 2px; padding: 4px 12px; border-radius: 999px; background: #eef4ff; color: #5495f3; font-weight: 700; font-size: 12px; }

/* S1 Курсы — queue table + actions */
.sa-pad { padding: 20px; }
.sa-panelhead { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.sa-panelhead h2 { font-size: 17px; font-weight: 700; margin: 0; }
.sa-note { color: #8a94a6; font-size: 13px; }
.sa-empty { text-align: center; color: #8a94a6; padding: 40px 0; }
.sa-tablewrap { overflow-x: auto; }
.sa-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.sa-table th { text-align: left; font-weight: 600; color: #8a94a6; font-size: 12px; padding: 8px 10px; border-bottom: 1px solid #eceef2; }
.sa-table td { padding: 12px 10px; border-bottom: 1px solid #f2f4f7; vertical-align: middle; }
.sa-table .ttl { font-weight: 500; max-width: 340px; }
.sa-table .muted { color: #8a94a6; white-space: nowrap; }
.sa-table .ta-r { text-align: right; }
.role-chip { display: inline-block; margin-left: 8px; padding: 1px 8px; border-radius: 999px; background: #eef1f5; color: #5b6472; font-size: 11px; font-weight: 600; }
.acts { white-space: nowrap; }
.btn { appearance: none; border: 1px solid transparent; border-radius: 9px; padding: 8px 14px; font: inherit; font-weight: 600; font-size: 13px; cursor: pointer; }
.btn:disabled { opacity: .55; cursor: default; }
.btn-ok { background: #3ba55d; color: #fff; }
.btn-warn { background: #e2854c; color: #fff; }
.btn-ghost { background: #fff; border-color: #e1e5ea; color: #5b6472; margin-left: 8px; }
.btn-ghost:hover:not(:disabled) { border-color: #5495f3; color: #5495f3; }

.sa-modal { position: fixed; inset: 0; z-index: 1000; background: rgba(11, 31, 77, .38); display: flex; align-items: center; justify-content: center; padding: 20px; }
.sa-modal__box { background: #fff; border-radius: 16px; padding: 24px; max-width: 440px; width: 100%; box-shadow: 0 20px 60px rgba(11, 31, 77, .25); }
.sa-modal__box h3 { margin: 0 0 8px; font-size: 18px; }
.sa-modal__course { margin: 0 0 10px; font-weight: 600; }
.sa-modal__warn { margin: 0 0 4px; color: #d1483d; font-size: 14px; font-weight: 600; }
.sa-modal__hint { margin: 0 0 10px; color: #8a94a6; font-size: 13px; }
.sa-modal__ta { width: 100%; border: 1px solid #e1e5ea; border-radius: 10px; padding: 10px; font: inherit; font-size: 14px; resize: vertical; box-sizing: border-box; }
.sa-modal__err { margin: 10px 0 0; color: #d1483d; font-size: 13px; }
.sa-modal__acts { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
.sa-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 1001; background: #0b1f4d; color: #fff; padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 600; box-shadow: 0 10px 30px rgba(11, 31, 77, .3); }

@media (max-width: 560px) { .sa-title { font-size: 22px; } }
</style>
