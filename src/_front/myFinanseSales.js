// Hand-written "История продаж" list for the my_finanse page, mounted like
// profileChatButton.js / mySubscriptions.js (an ordinary Vue app in a plain DOM node).
// Replaces the original WeWeb sales repeater (which rendered ALL 634 rows at once — a
// 41000px-tall list) with a paginated list sourced from the get_user_sales RPC, adding
// the BUYER (name + email) with a click-through to the buyer's profile. The correct
// grand total comes from get_user_sales_summary (server-side, all rows). RLS is off, so
// the shared supabase client can call the RPCs directly.
import { createApp, h, ref, onMounted } from 'vue';

const MY_FINANSE_PAGE_ID = '8df505c3-6c02-4a63-9666-e17c4d845756';
const PROFILE_PAGE_ID = '6ff5d3f0-8211-4a41-9774-a6e6a9d8e55d';
const CURRENT_USER_COLLECTION_ID = 'ebe8a1ca-0b4e-494f-a496-5e281d06bd16';
const AUTH_PLUGIN_ID = '1fa0dd68-5069-436c-9a7d-3b54c340f1fa';
const ANCHOR_UID = 'cefa599a-1993-4f1c-a0ef-a67a4045ad5d'; // original MySales block (list+total+header)
const FILTER_ROW_UID = '68f1453e-c0f8-4114-9166-cd9d1d9c8b37'; // original category/date filter row
const CONTAINER_ID = 'my-finanse-sales-root';
const STYLE_ID = 'my-finanse-sales-style';
const PAGE_SIZE = 30;
const MOUNT_TIMEOUT_MS = 15000;

const BLUE = '#5495F3';

let mountedApp = null;
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

const SalesList = {
    setup() {
        const rows = ref([]);
        const total = ref(null);
        const loading = ref(true);
        const loadingMore = ref(false);
        const hasMore = ref(false);
        const offset = ref(0);

        async function loadSummary() {
            const client = supa();
            const me = meId();
            if (!client || !me) return;
            try {
                const { data } = await client.rpc('get_user_sales_summary', { p_user: me });
                total.value = data?.total_price ?? 0;
            } catch (e) {
                console.warn('sales summary failed', e);
            }
        }

        async function loadPage(reset) {
            const client = supa();
            const me = meId();
            if (!client || !me) return;
            const off = reset ? 0 : offset.value;
            try {
                const { data, error } = await client.rpc('get_user_sales', {
                    p_user: me,
                    p_limit: PAGE_SIZE,
                    p_offset: off,
                });
                if (error) throw error;
                const page = Array.isArray(data) ? data : [];
                rows.value = reset ? page : [...rows.value, ...page];
                offset.value = off + page.length;
                hasMore.value = page.length === PAGE_SIZE;
            } catch (e) {
                console.warn('get_user_sales failed', e);
            }
        }

        async function loadMore() {
            if (loadingMore.value || !hasMore.value) return;
            loadingMore.value = true;
            await loadPage(false);
            loadingMore.value = false;
        }

        function openBuyer(id) {
            if (!id) return;
            wwLib.wwApp.goTo(wwLib.wwPageHelper.getPagePath(PROFILE_PAGE_ID), { user: id });
        }

        onMounted(async () => {
            await Promise.all([loadSummary(), loadPage(true)]);
            loading.value = false;
        });

        return { rows, total, loading, loadingMore, hasMore, loadMore, openBuyer };
    },
    render() {
        const th = (label, style) =>
            h('div', { style: { fontWeight: 600, fontSize: '14px', color: '#1B1F27', ...style } }, label);
        const td = (children, style) => h('div', { style: { fontSize: '15px', color: '#1B1F27', ...style } }, children);

        const header = h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 18px', background: '#F4F5F7', borderRadius: '10px' } },
            [
                th('Наименование товара', { flex: '2 1 0', minWidth: 0 }),
                th('Покупатель', { flex: '2 1 0', minWidth: 0 }),
                th('Сумма', { width: '90px', textAlign: 'center' }),
                th('Дата', { width: '110px', textAlign: 'center' }),
            ],
        );

        const row = r => {
            const clickable = !!r.buyer_id;
            return h(
                'div',
                {
                    key: r.id,
                    onClick: clickable ? () => this.openBuyer(r.buyer_id) : undefined,
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 18px',
                        borderRadius: '10px',
                        cursor: clickable ? 'pointer' : 'default',
                        borderBottom: '1px solid #ECEEF2',
                    },
                },
                [
                    td(
                        [
                            h('div', { style: { fontWeight: 500 } }, r.position_name || '—'),
                            r.position_category
                                ? h('div', { style: { fontSize: '13px', color: '#8A94A6' } }, r.position_category)
                                : null,
                        ],
                        { flex: '2 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
                    ),
                    td(
                        r.buyer_name || r.buyer_email
                            ? [
                                  h('div', { style: { color: clickable ? BLUE : '#1B1F27', fontWeight: 500 } }, r.buyer_name || 'Покупатель'),
                                  r.buyer_email
                                      ? h('div', { style: { fontSize: '13px', color: '#8A94A6' } }, r.buyer_email)
                                      : null,
                              ]
                            : h('span', { style: { color: '#B0B7C3' } }, '—'),
                        { flex: '2 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
                    ),
                    td(`${fmtMoney(r.price)}₽`, { width: '90px', textAlign: 'center' }),
                    td(fmtDate(r.created_at), { width: '110px', textAlign: 'center', color: '#8A94A6' }),
                ],
            );
        };

        const children = [
            h(
                'div',
                { style: { textAlign: 'center', fontSize: '18px', fontWeight: 500, margin: '4px 0 16px' } },
                `Продано на сумму: ${fmtMoney(this.total)} руб.`,
            ),
            header,
        ];

        if (this.loading) {
            children.push(h('div', { style: { textAlign: 'center', color: '#8A94A6', padding: '24px' } }, 'Загрузка…'));
        } else if (this.rows.length === 0) {
            children.push(h('div', { style: { textAlign: 'center', color: '#8A94A6', padding: '24px' } }, 'Продаж пока нет'));
        } else {
            this.rows.forEach(r => children.push(row(r)));
            if (this.hasMore) {
                children.push(
                    h(
                        'button',
                        {
                            type: 'button',
                            disabled: this.loadingMore,
                            onClick: this.loadMore,
                            style: {
                                display: 'block',
                                margin: '16px auto 0',
                                padding: '10px 24px',
                                borderRadius: '8px',
                                background: '#FFFFFF',
                                border: `1px solid ${BLUE}`,
                                color: BLUE,
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: this.loadingMore ? 'default' : 'pointer',
                            },
                        },
                        this.loadingMore ? 'Загрузка…' : 'Показать ещё',
                    ),
                );
            }
        }

        return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '5px', width: '100%' } }, children);
    },
};

function injectStyleOnce() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    // Hide the original all-rows sales block + its filter row (replaced by this component).
    s.textContent =
        `[class*="ww-element-${ANCHOR_UID}"],[class*="ww-element-${FILTER_ROW_UID}"]{display:none !important;}`;
    document.head.appendChild(s);
}

function clearWaiters() {
    if (observer) { observer.disconnect(); observer = null; }
    if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
}

function unmount() {
    clearWaiters();
    if (mountedApp) { mountedApp.unmount(); mountedApp = null; }
    document.getElementById(CONTAINER_ID)?.remove();
}

function tryMount() {
    if (mountedApp || document.getElementById(CONTAINER_ID)) return;
    if (!wwLib.wwPlugins?.[AUTH_PLUGIN_ID]?.isAuthenticated) return;
    const anchor = document.querySelector(`[class*="ww-element-${ANCHOR_UID}"]`);
    if (!anchor?.parentNode) return;

    const container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.style.width = '100%';
    anchor.parentNode.insertBefore(container, anchor.nextSibling);

    mountedApp = createApp(SalesList);
    mountedApp.mount(container);
    clearWaiters();
}

function waitAndMount() {
    injectStyleOnce();
    tryMount();
    if (mountedApp) return;
    observer = new MutationObserver(tryMount);
    observer.observe(document.body, { childList: true, subtree: true });
    timeoutId = setTimeout(clearWaiters, MOUNT_TIMEOUT_MS);
}

function isFinansePageRoute(route) {
    return !!route?.name && route.name.startsWith(`page-${MY_FINANSE_PAGE_ID}`);
}

export function initMyFinanseSales(router) {
    if (isFinansePageRoute(router.currentRoute.value)) {
        waitAndMount();
    }
    router.afterEach(to => {
        unmount();
        if (isFinansePageRoute(to)) {
            waitAndMount();
        }
    });
}
