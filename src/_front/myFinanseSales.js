// Hand-written enhancements for the my_finanse page, mounted like profileChatButton.js /
// mySubscriptions.js. Two things:
//   1) Replaces the original WeWeb "История продаж" (sales) and "История заказов" (orders)
//      lists with paginated/clean components sourced from RPCs (get_user_sales +
//      get_user_sales_summary; get_user_orders) — same look, buyer attribution on sales.
//   2) Injects CSS to unify the tabs and restyle the "Вывод средств" tab to the same
//      design (typography/spacing/colours). The withdrawal request FORM logic is NOT
//      touched — styling only.
// The original heavy lists are CSS-hidden and the sales collection is limited to 1 row
// (page JSON) so WeWeb stops rendering them. Responsive: tables on desktop, cards on mobile.
import { createApp, h, ref, onMounted } from 'vue';

const MY_FINANSE_PAGE_ID = '8df505c3-6c02-4a63-9666-e17c4d845756';
const PROFILE_PAGE_ID = '6ff5d3f0-8211-4a41-9774-a6e6a9d8e55d';
const CURRENT_USER_COLLECTION_ID = 'ebe8a1ca-0b4e-494f-a496-5e281d06bd16';
const AUTH_PLUGIN_ID = '1fa0dd68-5069-436c-9a7d-3b54c340f1fa';

const SALES_ANCHOR_UID = 'cefa599a-1993-4f1c-a0ef-a67a4045ad5d'; // original sales block
const SALES_FILTER_UID = 'b6b99640-0fcc-4ee9-81ae-1d4dfc551f3a'; // original sales filter row
const ORDERS_ANCHOR_UID = '3d1fa149-99d2-4799-b8f0-887604dbf1f0'; // orders repeater
const ORDERS_BLOCK_UID = 'aad73a92-dfed-4584-927a-59876dd5cca2'; // orders tab content block
// Tabs + withdrawal ("Вывод средств") elements — styled in place.
const TAB_TEXT_UID = '1408cb30-5b54-469e-beb9-45480d14615b';
const WD_BALANCE_UID = '98b414da-dd43-4423-8c8b-fbf9130aca97';
const WD_BUTTON_UID = '21e9a5a1-07ff-43bf-bb3b-957f122b6b8a';
const WD_HEADER_UID = '6e036746-8b3a-4483-a356-171717834ed4';
const WD_EMPTY_IMG_UID = '03ae9fa0-64f7-45ee-8e12-a5a52ff2ffba'; // off-brand empty-state illustration
const WD_EMPTY_TXT_UID = 'd26b58ba-8c18-44b3-9456-3d9d09a9803f'; // "Список пуст" text

const SALES_ROOT_ID = 'my-finanse-sales-root';
const ORDERS_ROOT_ID = 'my-finanse-orders-root';
const STYLE_ID = 'my-finanse-sales-style';
const PAGE_SIZE = 30;
const MOUNT_TIMEOUT_MS = 15000;

const appByRoot = {}; // rootId -> mounted Vue app
let observer = null;
let timeoutId = null;

function supa() {
    return wwLib.wwPlugins?.supabase?.instance || null;
}
function meId() {
    return wwLib.$store.getters['data/getCollections']?.[CURRENT_USER_COLLECTION_ID]?.data?.[0]?.id || null;
}
function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}
function fmtMoney(n) {
    if (n == null) return '0';
    return Math.round(Number(n)).toLocaleString('ru-RU');
}
function waitForMe(cb) {
    let tries = 0;
    const tick = () => {
        if (meId()) return cb();
        if (tries++ < 60) setTimeout(tick, 250);
    };
    tick();
}

/* ------------------------------- Sales (with buyer + filters) ------------------------------- */
const SalesList = {
    setup() {
        const rows = ref([]), total = ref(null), loading = ref(true);
        const loadingMore = ref(false), hasMore = ref(false), offset = ref(0);
        const categories = ref([]), category = ref(''), dateFrom = ref(''), dateTo = ref('');

        function filterParams() {
            const p = {};
            if (category.value) p.p_category = category.value;
            if (dateFrom.value) p.p_from = dateFrom.value;
            if (dateTo.value) p.p_to = dateTo.value;
            return p;
        }
        async function loadCategories() {
            const c = supa(), me = meId();
            if (!c || !me) return;
            try {
                const { data } = await c.from('sales').select('position_category').eq('user', me);
                categories.value = [...new Set((data || []).map(r => r.position_category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
            } catch (e) { console.warn('sale categories failed', e); }
        }
        async function loadSummary() {
            const c = supa(), me = meId();
            if (!c || !me) return;
            try {
                const { data } = await c.rpc('get_user_sales_summary', { p_user: me, ...filterParams() });
                total.value = data?.total_price ?? 0;
            } catch (e) { console.warn('sales summary failed', e); }
        }
        async function loadPage(reset) {
            const c = supa(), me = meId();
            if (!c || !me) return;
            const off = reset ? 0 : offset.value;
            try {
                const { data, error } = await c.rpc('get_user_sales', { p_user: me, p_limit: PAGE_SIZE, p_offset: off, ...filterParams() });
                if (error) throw error;
                const page = Array.isArray(data) ? data : [];
                rows.value = reset ? page : [...rows.value, ...page];
                offset.value = off + page.length;
                hasMore.value = page.length === PAGE_SIZE;
            } catch (e) { console.warn('get_user_sales failed', e); }
        }
        async function applyFilters() { loading.value = true; offset.value = 0; await Promise.all([loadSummary(), loadPage(true)]); loading.value = false; }
        async function loadMore() { if (loadingMore.value || !hasMore.value) return; loadingMore.value = true; await loadPage(false); loadingMore.value = false; }
        function resetFilters() { if (!category.value && !dateFrom.value && !dateTo.value) return; category.value = ''; dateFrom.value = ''; dateTo.value = ''; applyFilters(); }
        function openBuyer(id) { if (id) wwLib.wwApp.goTo(wwLib.wwPageHelper.getPagePath(PROFILE_PAGE_ID), { user: id }); }

        onMounted(() => waitForMe(async () => { await Promise.all([loadCategories(), loadSummary(), loadPage(true)]); loading.value = false; }));
        return { rows, total, loading, loadingMore, hasMore, categories, category, dateFrom, dateTo, applyFilters, resetFilters, loadMore, openBuyer };
    },
    render() {
        const hasFilter = !!(this.category || this.dateFrom || this.dateTo);
        const filterBar = h('div', { class: 'mfs-filters' }, [
            h('select', { class: 'mfs-input', value: this.category, onChange: e => { this.category = e.target.value; this.applyFilters(); } },
                [h('option', { value: '' }, 'Все категории'), ...this.categories.map(c => h('option', { value: c }, c))]),
            h('span', { class: 'mfs-flabel' }, 'Дата от/до'),
            h('input', { class: 'mfs-input', type: 'date', value: this.dateFrom, onChange: e => { this.dateFrom = e.target.value; this.applyFilters(); } }),
            h('input', { class: 'mfs-input', type: 'date', value: this.dateTo, onChange: e => { this.dateTo = e.target.value; this.applyFilters(); } }),
            hasFilter ? h('button', { class: 'mfs-reset', type: 'button', onClick: this.resetFilters }, 'Сбросить') : null,
        ]);
        const children = [
            filterBar,
            h('div', { class: 'mfs-total' }, `Продано на сумму: ${fmtMoney(this.total)} руб.`),
            h('div', { class: 'mfs-head' }, [
                h('div', { class: 'mfs-c-name' }, 'Наименование товара'),
                h('div', { class: 'mfs-c-buyer' }, 'Покупатель'),
                h('div', { class: 'mfs-c-sum' }, 'Сумма'),
                h('div', { class: 'mfs-c-date' }, 'Дата'),
            ]),
        ];
        const row = r => {
            const clickable = !!r.buyer_id;
            return h('div', { key: r.id, class: ['mfs-row', clickable ? 'mfs-clickable' : ''], onClick: clickable ? () => this.openBuyer(r.buyer_id) : undefined }, [
                h('div', { class: 'mfs-c-name' }, [
                    h('div', { class: 'mfs-name' }, r.position_name || '—'),
                    r.position_category ? h('div', { class: 'mfs-sub' }, r.position_category) : null,
                ]),
                h('div', { class: 'mfs-c-buyer' }, r.buyer_name || r.buyer_email
                    ? [h('div', { class: clickable ? 'mfs-buyer-link' : 'mfs-buyer' }, r.buyer_name || 'Покупатель'), r.buyer_email ? h('div', { class: 'mfs-sub' }, r.buyer_email) : null]
                    : h('span', { class: 'mfs-dash' }, '—')),
                h('div', { class: 'mfs-c-sum' }, [h('span', { class: 'mfs-mobile-label' }, 'Сумма: '), `${fmtMoney(r.price)}₽`]),
                h('div', { class: 'mfs-c-date' }, fmtDate(r.created_at)),
            ]);
        };
        if (this.loading) children.push(h('div', { class: 'mfs-empty' }, 'Загрузка…'));
        else if (this.rows.length === 0) children.push(h('div', { class: 'mfs-empty' }, hasFilter ? 'Ничего не найдено' : 'Продаж пока нет'));
        else {
            this.rows.forEach(r => children.push(row(r)));
            if (this.hasMore) children.push(h('button', { type: 'button', class: 'mfs-more', disabled: this.loadingMore, onClick: this.loadMore }, this.loadingMore ? 'Загрузка…' : 'Показать ещё'));
        }
        return h('div', { class: 'mfs' }, children);
    },
};

/* --------------------------------------- Orders --------------------------------------- */
const OrdersList = {
    setup() {
        const rows = ref([]), loading = ref(true);
        async function load() {
            const c = supa(), me = meId();
            if (!c || !me) return;
            try {
                const { data } = await c.rpc('get_user_orders', { p_user: me });
                rows.value = Array.isArray(data) ? data : [];
            } catch (e) { console.warn('get_user_orders failed', e); }
        }
        onMounted(() => waitForMe(async () => { await load(); loading.value = false; }));
        return { rows, loading };
    },
    render() {
        const children = [
            h('div', { class: 'mfs-head' }, [
                h('div', { class: 'mfs-c-name' }, 'Наименование товаров'),
                h('div', { class: 'mfs-c-paid' }, 'Оплачено'),
                h('div', { class: 'mfs-c-sum' }, 'Сумма'),
                h('div', { class: 'mfs-c-date' }, 'Дата'),
            ]),
        ];
        const names = o => {
            const list = Array.isArray(o.course_position) ? o.course_position.map(p => p && p.title).filter(Boolean) : [];
            return list.length ? list.join(', ') : 'Покупка';
        };
        const row = o => h('div', { key: o.id, class: 'mfs-row' }, [
            h('div', { class: 'mfs-c-name' }, h('div', { class: 'mfs-name' }, names(o))),
            h('div', { class: 'mfs-c-paid' }, [
                h('span', { class: 'mfs-mobile-label' }, 'Оплачено: '),
                h('span', { class: o.paid ? 'mfs-paid-yes' : 'mfs-paid-no' }, o.paid ? 'Оплачено' : 'Не оплачено'),
            ]),
            h('div', { class: 'mfs-c-sum' }, [h('span', { class: 'mfs-mobile-label' }, 'Сумма: '), `${fmtMoney(o.summ)}₽`]),
            h('div', { class: 'mfs-c-date' }, fmtDate(o.created_at)),
        ]);
        if (this.loading) children.push(h('div', { class: 'mfs-empty' }, 'Загрузка…'));
        else if (this.rows.length === 0) children.push(h('div', { class: 'mfs-empty' }, 'Заказов пока нет'));
        else this.rows.forEach(o => children.push(row(o)));
        return h('div', { class: 'mfs' }, children);
    },
};

/* --------------------------------------- Styles --------------------------------------- */
const CSS = `
#${SALES_ROOT_ID},#${ORDERS_ROOT_ID}{width:100%;}
.mfs{display:flex;flex-direction:column;gap:5px;width:100%;box-sizing:border-box;}
.mfs *{box-sizing:border-box;}
.mfs-filters{display:flex;flex-wrap:wrap;align-items:center;gap:10px;justify-content:center;margin-bottom:12px;}
.mfs-flabel{color:#8A94A6;font-size:14px;}
.mfs-input{height:40px;border:1px solid #E1E5EA;border-radius:8px;padding:0 12px;font-size:14px;color:#1B1F27;background:#fff;}
.mfs-reset{height:40px;border:1px solid #5495F3;border-radius:8px;background:#fff;color:#5495F3;font-size:14px;font-weight:600;padding:0 16px;cursor:pointer;}
.mfs-total{text-align:center;font-size:18px;font-weight:500;margin:4px 0 16px;color:#1B1F27;}
.mfs-head{display:flex;align-items:center;gap:12px;padding:10px 18px;background:#F4F5F7;border-radius:10px;font-weight:600;font-size:14px;color:#1B1F27;}
.mfs-row{display:flex;align-items:center;gap:12px;padding:10px 18px;border-radius:10px;border-bottom:1px solid #ECEEF2;font-size:15px;color:#1B1F27;}
.mfs-clickable{cursor:pointer;}
.mfs-clickable:hover{background:#f7f9fc;}
.mfs-c-name{flex:2 1 0;min-width:0;display:flex;flex-direction:column;gap:2px;}
.mfs-c-buyer{flex:2 1 0;min-width:0;display:flex;flex-direction:column;gap:2px;}
.mfs-c-paid{width:120px;flex:none;}
.mfs-c-sum{width:90px;text-align:center;flex:none;}
.mfs-c-date{width:110px;text-align:center;flex:none;color:#8A94A6;}
.mfs-name{font-weight:500;}
.mfs-sub{font-size:13px;color:#8A94A6;overflow-wrap:anywhere;}
.mfs-buyer{font-weight:500;}
.mfs-buyer-link{font-weight:500;color:#5495F3;}
.mfs-dash{color:#B0B7C3;}
.mfs-paid-yes{color:#3BA55D;font-weight:500;}
.mfs-paid-no{color:#8A94A6;}
.mfs-empty{text-align:center;color:#8A94A6;padding:24px;}
.mfs-more{display:block;margin:16px auto 0;padding:10px 24px;border-radius:8px;background:#fff;border:1px solid #5495F3;color:#5495F3;font-size:14px;font-weight:600;cursor:pointer;}
.mfs-mobile-label{display:none;}
@media (max-width:640px){
  .mfs-head{display:none;}
  .mfs-row{flex-direction:column;align-items:stretch;gap:4px;padding:12px 4px;}
  .mfs-c-paid,.mfs-c-sum,.mfs-c-date{width:auto;text-align:left;flex:none;}
  .mfs-mobile-label{display:inline;color:#8A94A6;}
  .mfs-input{flex:1 1 40%;}
}
/* Hide the original sales + orders blocks (replaced by our components). Uid-based CSS so
   it survives WeWeb re-creating the tab DOM (which wipes any class we'd add ourselves). */
[class*="ww-element-${SALES_ANCHOR_UID}"],[class*="ww-element-${SALES_FILTER_UID}"]{display:none !important;}
[class*="ww-element-${ORDERS_BLOCK_UID}"] > :not(#${ORDERS_ROOT_ID}){display:none !important;}
/* Tabs: unify typography with the lists. */
[class*="ww-element-${TAB_TEXT_UID}"]{font-weight:600 !important;font-size:15px !important;}
/* "Вывод средств" tab — style only (the request form logic is untouched). */
[class*="ww-element-${WD_BALANCE_UID}"]{font-size:18px !important;font-weight:500 !important;text-align:center !important;color:#1B1F27 !important;margin:4px 0 16px !important;}
[class*="ww-element-${WD_HEADER_UID}"]{background:#F4F5F7 !important;border-radius:10px !important;padding:10px 18px !important;font-weight:600 !important;font-size:14px !important;color:#1B1F27 !important;}
button[class*="ww-element-${WD_BUTTON_UID}"]{border-radius:8px !important;font-weight:600 !important;}
[class*="ww-element-${WD_EMPTY_IMG_UID}"]{display:none !important;}
[class*="ww-element-${WD_EMPTY_TXT_UID}"]{text-align:center !important;color:#8A94A6 !important;font-size:15px !important;padding:24px 0 !important;}
`;

function injectStyleOnce() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
}

function clearWaiters() {
    if (observer) { observer.disconnect(); observer = null; }
    if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
}
function unmountApp(rootId) {
    if (appByRoot[rootId]) {
        try { appByRoot[rootId].unmount(); } catch (e) { /* ignore */ }
        delete appByRoot[rootId];
    }
}
function unmountAll() {
    clearWaiters();
    unmountApp(SALES_ROOT_ID);
    unmountApp(ORDERS_ROOT_ID);
    document.getElementById(SALES_ROOT_ID)?.remove();
    document.getElementById(ORDERS_ROOT_ID)?.remove();
}
function mountOne(anchorUid, rootId, Comp) {
    if (document.getElementById(rootId)) return; // already mounted and present
    unmountApp(rootId); // the tab was re-created — drop the stale (detached) app first
    const anchor = document.querySelector(`[class*="ww-element-${anchorUid}"]`);
    if (!anchor?.parentNode) return;
    const el = document.createElement('div');
    el.id = rootId;
    el.style.width = '100%';
    anchor.parentNode.insertBefore(el, anchor.nextSibling);
    const app = createApp(Comp);
    app.mount(el);
    appByRoot[rootId] = app;
}
// Reformat the withdrawal balance (e.g. "…504808.26₽") to the same money style as the
// other tabs. Guarded (only when it still has decimals) so re-writing the text can't loop.
function reformatBalance() {
    const el = document.querySelector(`[class*="ww-element-${WD_BALANCE_UID}"]`);
    if (!el) return;
    const t = el.textContent || '';
    if (!/\d[.,]\d/.test(t)) return;
    const m = t.match(/[\d]+[.,]?\d*/);
    if (!m) return;
    const num = Math.round(parseFloat(m[0].replace(',', '.')));
    if (Number.isFinite(num)) el.textContent = `Доступно для вывода: ${num.toLocaleString('ru-RU')} ₽`;
}
// WeWeb re-creates a tab's DOM each time you switch to it, destroying our mounted root.
// Keep observing and re-mount whenever an anchor reappears without our component.
function tryMount() {
    if (!wwLib.wwPlugins?.[AUTH_PLUGIN_ID]?.isAuthenticated) return;
    mountOne(SALES_ANCHOR_UID, SALES_ROOT_ID, SalesList);
    mountOne(ORDERS_ANCHOR_UID, ORDERS_ROOT_ID, OrdersList);
    reformatBalance();
}
function waitAndMount() {
    injectStyleOnce();
    tryMount();
    observer = new MutationObserver(tryMount);
    observer.observe(document.body, { childList: true, subtree: true });
}
function isFinansePageRoute(route) {
    return !!route?.name && route.name.startsWith(`page-${MY_FINANSE_PAGE_ID}`);
}

export function initMyFinanseSales(router) {
    if (isFinansePageRoute(router.currentRoute.value)) waitAndMount();
    router.afterEach(to => {
        unmountAll();
        if (isFinansePageRoute(to)) waitAndMount();
    });
}
