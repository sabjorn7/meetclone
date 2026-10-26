// Hand-written finance components for the standalone MyFinancePage.vue (PAGE_OVERRIDES вариант 1).
// Вынесено из myFinanseSales.js / myFinanseWithdrawal.js, но с ОДНИМ отличием: источник uid и баланса —
// SECURITY DEFINER RPC get_my_profile_private (а НЕ WeWeb-коллекция ebe8a1ca…, которой на override-странице
// нет). Общий реактивный financeState наполняется один раз в MyFinancePage и используется всеми тремя
// компонентами (SalesList / OrdersList / WithdrawalTab). Никакого mount-in / DOM-hide / LCA здесь нет.
import { h, ref, reactive, computed, onMounted } from 'vue';

const PROFILE_PAGE_ID = '6ff5d3f0-8211-4a41-9774-a6e6a9d8e55d';
const PAGE_SIZE = 30;

// Общее состояние (uid/баланс/почта/роль) — заполняется loadMyProfilePrivate() из MyFinancePage.
export const financeState = reactive({ uid: null, balance: 0, email: '', role: '', loaded: false });

function supa() { return window.wwLib?.wwPlugins?.supabase?.instance || null; }
function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso); const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}
export function fmtMoney(n) {
    if (n == null) return '0';
    return Math.round(Number(n)).toLocaleString('ru-RU');
}

// Своя приватная строка через definer-RPC (баланс/почта/роль/id). Возвращает объект или null (гость).
export async function loadMyProfilePrivate() {
    const c = supa(); if (!c) return null;
    try {
        const { data, error } = await c.rpc('get_my_profile_private');
        if (error) throw error;
        const r = Array.isArray(data) ? data[0] : data; // jsonb-объект
        if (r && r.id) {
            financeState.uid = r.id;
            financeState.balance = Number(r.balance) || 0;
            financeState.email = r.email || '';
            financeState.role = r.role || '';
            financeState.loaded = true;
        }
        return r || null;
    } catch (e) { console.warn('get_my_profile_private failed', e); return null; }
}

/* ------------------------------- Продажи (с покупателем + фильтры) ------------------------------- */
export const SalesList = {
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
            const c = supa(), me = financeState.uid;
            if (!c || !me) return;
            try {
                const { data } = await c.from('sales').select('position_category').eq('user', me);
                categories.value = [...new Set((data || []).map((r) => r.position_category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
            } catch (e) { console.warn('sale categories failed', e); }
        }
        async function loadSummary() {
            const c = supa(), me = financeState.uid;
            if (!c || !me) return;
            try {
                const { data } = await c.rpc('get_user_sales_summary', { p_user: me, ...filterParams() });
                total.value = data?.total_price ?? 0;
            } catch (e) { console.warn('sales summary failed', e); }
        }
        async function loadPage(reset) {
            const c = supa(), me = financeState.uid;
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
        function openBuyer(id) { if (id) window.wwLib.wwApp.goTo(window.wwLib.wwPageHelper.getPagePath(PROFILE_PAGE_ID), { user: id }); }

        onMounted(async () => { await Promise.all([loadCategories(), loadSummary(), loadPage(true)]); loading.value = false; });
        return { rows, total, loading, loadingMore, hasMore, categories, category, dateFrom, dateTo, applyFilters, resetFilters, loadMore, openBuyer };
    },
    render() {
        const hasFilter = !!(this.category || this.dateFrom || this.dateTo);
        const filterBar = h('div', { class: 'mfs-filters' }, [
            h('select', { class: 'mfs-input', value: this.category, onChange: (e) => { this.category = e.target.value; this.applyFilters(); } },
                [h('option', { value: '' }, 'Все категории'), ...this.categories.map((c) => h('option', { value: c }, c))]),
            h('span', { class: 'mfs-flabel' }, 'Дата от/до'),
            h('input', { class: 'mfs-input', type: 'date', value: this.dateFrom, onChange: (e) => { this.dateFrom = e.target.value; this.applyFilters(); } }),
            h('input', { class: 'mfs-input', type: 'date', value: this.dateTo, onChange: (e) => { this.dateTo = e.target.value; this.applyFilters(); } }),
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
        const row = (r) => {
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
            this.rows.forEach((r) => children.push(row(r)));
            if (this.hasMore) children.push(h('button', { type: 'button', class: 'mfs-more', disabled: this.loadingMore, onClick: this.loadMore }, this.loadingMore ? 'Загрузка…' : 'Показать ещё'));
        }
        return h('div', { class: 'mfs' }, children);
    },
};

/* --------------------------------------- Заказы --------------------------------------- */
export const OrdersList = {
    setup() {
        const rows = ref([]), loading = ref(true);
        async function load() {
            const c = supa(), me = financeState.uid;
            if (!c || !me) return;
            try {
                const { data } = await c.rpc('get_user_orders', { p_user: me });
                rows.value = Array.isArray(data) ? data : [];
            } catch (e) { console.warn('get_user_orders failed', e); }
        }
        onMounted(async () => { await load(); loading.value = false; });
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
        const names = (o) => {
            const list = Array.isArray(o.course_position) ? o.course_position.map((p) => p && p.title).filter(Boolean) : [];
            return list.length ? list.join(', ') : 'Покупка';
        };
        const row = (o) => h('div', { key: o.id, class: 'mfs-row' }, [
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
        else this.rows.forEach((o) => children.push(row(o)));
        return h('div', { class: 'mfs' }, children);
    },
};

/* --------------------------------------- Вывод средств --------------------------------------- */
const TYPES = [
    { v: 'self_employed', l: 'Самозанятый' },
    { v: 'ip', l: 'ИП' },
    { v: 'ooo', l: 'ООО' },
];
const SAVE_ERRORS = {
    not_authenticated: 'Войдите в аккаунт.',
    bad_recipient_type: 'Выберите тип получателя.',
    name_required: 'Укажите ФИО / наименование.',
    bad_inn_fl: 'ИНН должен содержать 12 цифр.',
    bad_inn_ooo: 'ИНН организации — 10 цифр.',
    bad_kpp: 'КПП — 9 цифр.',
    bad_ogrn: 'ОГРН — 13 цифр.',
    bad_ogrnip: 'ОГРНИП — 15 цифр.',
    bad_bik: 'БИК — 9 цифр.',
    bad_account: 'Расчётный счёт — 20 цифр.',
    bad_corr_account: 'Корр. счёт — 20 цифр.',
};
const WD_ERRORS = {
    not_authenticated: 'Войдите в аккаунт.',
    bad_amount: 'Введите корректную сумму.',
    no_requisites: 'Сначала сохраните платёжные реквизиты.',
    insufficient_balance: 'Недостаточно средств на балансе.',
};
function mapErr(e, table) {
    const code = (e && (e.message || e.code || '')).toString();
    for (const k of Object.keys(table)) if (code.includes(k)) return table[k];
    return null;
}

export const WithdrawalTab = {
    setup() {
        const loading = ref(true);
        const f = reactive({ recipient_type: 'self_employed', name: '', inn: '', kpp: '', ogrn: '', bik: '', account: '', corr_account: '', bank_name: '' });
        const hadType = ref(null);
        const saving = ref(false), reqErr = ref(''), reqOk = ref('');
        const amount = ref(''); const requesting = ref(false), wdErr = ref(''), wdOk = ref('');
        const history = ref([]);

        const typeChanged = computed(() => hadType.value && hadType.value !== f.recipient_type);
        const needKpp = computed(() => f.recipient_type === 'ooo');
        const needOgrn = computed(() => f.recipient_type === 'ooo' || f.recipient_type === 'ip');
        const ogrnLabel = computed(() => (f.recipient_type === 'ip' ? 'ОГРНИП' : 'ОГРН'));
        const nameLabel = computed(() => (f.recipient_type === 'ooo' ? 'Наименование организации' : 'ФИО'));
        const balance = computed(() => financeState.balance);

        async function loadRequisites() {
            const c = supa(); if (!c) return;
            try {
                const { data } = await c.rpc('get_my_requisites');
                const r = Array.isArray(data) ? data[0] : data;
                if (r && r.recipient_type) {
                    f.recipient_type = r.recipient_type; hadType.value = r.recipient_type;
                    f.name = r.name || ''; f.inn = r.inn || ''; f.kpp = r.kpp || ''; f.ogrn = r.ogrn || '';
                    f.bik = r.bik || ''; f.account = r.account || ''; f.corr_account = r.corr_account || ''; f.bank_name = r.bank_name || '';
                }
            } catch (e) { console.warn('get_my_requisites failed', e); }
        }
        async function loadHistory() {
            const c = supa(); if (!c) return;
            try { const { data } = await c.rpc('get_my_withdrawals'); history.value = Array.isArray(data) ? data : []; }
            catch (e) { console.warn('get_my_withdrawals failed', e); }
        }

        async function saveRequisites() {
            if (saving.value) return;
            saving.value = true; reqErr.value = ''; reqOk.value = '';
            try {
                const { error } = await supa().rpc('save_my_requisites', {
                    p_recipient_type: f.recipient_type, p_name: f.name, p_inn: f.inn, p_bik: f.bik,
                    p_account: f.account, p_corr_account: f.corr_account || null,
                    p_kpp: needKpp.value ? f.kpp : null, p_ogrn: needOgrn.value ? f.ogrn : null, p_bank_name: f.bank_name || null,
                });
                if (error) throw error;
                hadType.value = f.recipient_type;
                reqOk.value = 'Реквизиты сохранены.';
            } catch (e) { reqErr.value = mapErr(e, SAVE_ERRORS) || 'Не удалось сохранить. Проверьте поля.'; }
            finally { saving.value = false; }
        }

        async function doWithdraw() {
            if (requesting.value) return;
            wdErr.value = ''; wdOk.value = '';
            const amt = Number(String(amount.value).replace(',', '.'));
            if (!(amt > 0)) { wdErr.value = 'Введите корректную сумму.'; return; }
            if (amt > financeState.balance) { wdErr.value = 'Недостаточно средств на балансе.'; return; }
            requesting.value = true;
            try {
                const { error } = await supa().rpc('request_withdrawal', { p_amount: amt });
                if (error) throw error;
                wdOk.value = 'Заявка создана. Выплата будет проведена вручную после проверки.';
                amount.value = '';
                financeState.balance = Math.max(0, financeState.balance - amt); // оптимистично (общий state)
                await loadHistory();
            } catch (e) { wdErr.value = mapErr(e, WD_ERRORS) || 'Не удалось создать заявку.'; }
            finally { requesting.value = false; }
        }

        // --- Подтяжка по ИНН/БИК (DaData/ФНС через edge-функцию requisites-lookup). Только удобство:
        //     всё остаётся редактируемым, серверные проверки save_my_requisites не ослабляются. ---
        const innBusy = ref(false), bikBusy = ref(false);
        const innMsg = ref(''), bikMsg = ref(''), npdHint = ref(''), typeWarn = ref('');

        function reasonMsg(reason) {
            if (reason === 'rate_limited') return 'Слишком часто. Попробуйте через минуту.';
            if (reason === 'not_found') return 'По этому номеру ничего не найдено.';
            return 'Не удалось подтянуть, заполните вручную.'; // unavailable / bad_query / прочее
        }
        async function invokeLookup(kind, query) {
            const c = supa(); if (!c) return { ok: false, reason: 'unavailable' };
            try {
                const { data, error } = await c.functions.invoke('requisites-lookup', { body: { kind, query } });
                if (error || !data) return { ok: false, reason: 'unavailable' };
                return data;
            } catch (_) { return { ok: false, reason: 'unavailable' }; }
        }
        // Заполнить набор полей: пустые — сразу; если НЕпустое поле изменится — один общий confirm.
        function applyFields(pairs) {
            const changesNonEmpty = pairs.some(([k, v]) => v && f[k] && f[k] !== v);
            let overwrite = true;
            if (changesNonEmpty) overwrite = window.confirm('Перезаписать уже заполненные поля данными из справочника?');
            for (const [k, v] of pairs) { if (v && (!f[k] || overwrite)) f[k] = v; }
        }
        async function lookupInn() {
            if (innBusy.value) return;
            innMsg.value = ''; typeWarn.value = ''; npdHint.value = '';
            const q = String(f.inn).replace(/\D/g, '');
            if (!(q.length === 10 || q.length === 12)) { innMsg.value = 'ИНН: 10 цифр (организация) или 12 (ИП/физлицо).'; return; }
            innBusy.value = true;
            try {
                if (f.recipient_type === 'self_employed') {
                    const r = await invokeLookup('npd', q);
                    npdHint.value = r.ok
                        ? (r.data.npd === 'yes' ? 'Статус самозанятого: подтверждён'
                            : r.data.npd === 'no' ? 'Статус самозанятого: не найден'
                                : 'Статус самозанятого: проверить не удалось')
                        : 'Статус самозанятого: проверить не удалось';
                    return;
                }
                const r = await invokeLookup('party', q);
                if (!r.ok) { innMsg.value = reasonMsg(r.reason); return; }
                const d = r.data || {};
                applyFields([['name', d.name], ['kpp', d.kpp], ['ogrn', d.ogrn]]);
                if (d.status && d.status !== 'действует') innMsg.value = `Внимание: по справочнику — «${d.status}».`;
                if (d.type === 'INDIVIDUAL' && f.recipient_type === 'ooo') typeWarn.value = 'По ИНН это ИП/физлицо, а выбран тип «ООО» — проверьте тип получателя.';
                if (d.type === 'LEGAL' && f.recipient_type === 'ip') typeWarn.value = 'По ИНН это организация, а выбран тип «ИП» — проверьте тип получателя.';
            } finally { innBusy.value = false; }
        }
        async function lookupBik() {
            if (bikBusy.value) return;
            bikMsg.value = '';
            const q = String(f.bik).replace(/\D/g, '');
            if (q.length !== 9) { bikMsg.value = 'БИК: 9 цифр.'; return; }
            bikBusy.value = true;
            try {
                const r = await invokeLookup('bank', q);
                if (!r.ok) { bikMsg.value = reasonMsg(r.reason); return; }
                const d = r.data || {};
                applyFields([['bank_name', d.bank_name], ['corr_account', d.corr_account]]);
            } finally { bikBusy.value = false; }
        }

        onMounted(async () => {
            await Promise.all([loadRequisites(), loadHistory()]);
            loading.value = false;
        });

        return { loading, f, typeChanged, needKpp, needOgrn, ogrnLabel, nameLabel, saving, reqErr, reqOk,
            amount, requesting, wdErr, wdOk, history, balance, saveRequisites, doWithdraw,
            innBusy, bikBusy, innMsg, bikMsg, npdHint, typeWarn, lookupInn, lookupBik };
    },
    render() {
        const field = (label, _model, key, attrs = {}) => h('label', { class: 'mfw-field' }, [
            h('span', { class: 'mfw-label' }, label),
            h('input', { class: 'mfw-input', value: this.f[key], onInput: (e) => { this.f[key] = e.target.value; }, ...attrs }),
        ]);
        // Поле с кнопкой подтяжки (ИНН/БИК) + строка сообщения + доп. узлы (предупреждение о типе / НПД).
        const fieldBtn = (label, key, btnLabel, onClick, busy, msg, attrs = {}, extra = []) => h('div', { class: 'mfw-field' }, [
            h('span', { class: 'mfw-label' }, label),
            h('div', { class: 'mfw-wrow' }, [
                h('input', { class: 'mfw-input mfw-grow', value: this.f[key], onInput: (e) => { this.f[key] = e.target.value; }, ...attrs }),
                h('button', { class: 'mfw-btn', type: 'button', disabled: busy, onClick }, busy ? '…' : btnLabel),
            ]),
            msg ? h('div', { class: 'mfw-hint' }, msg) : null,
            ...extra,
        ]);
        if (this.loading) return h('div', { class: 'mfw' }, h('div', { class: 'mfw-empty' }, 'Загрузка…'));

        const reqFields = [
            h('label', { class: 'mfw-field' }, [
                h('span', { class: 'mfw-label' }, 'Тип получателя'),
                h('select', { class: 'mfw-input', value: this.f.recipient_type, onChange: (e) => { this.f.recipient_type = e.target.value; } },
                    TYPES.map((t) => h('option', { value: t.v }, t.l))),
            ]),
            this.typeChanged ? h('div', { class: 'mfw-note' }, 'Смена типа получателя будет отмечена для администратора.') : null,
            fieldBtn(this.f.recipient_type === 'ooo' ? 'ИНН (10 цифр)' : 'ИНН (12 цифр)', 'inn',
                this.f.recipient_type === 'self_employed' ? 'Проверить статус' : 'Найти по ИНН',
                this.lookupInn, this.innBusy, this.innMsg, { inputmode: 'numeric' }, [
                    this.typeWarn ? h('div', { class: 'mfw-note' }, this.typeWarn) : null,
                    this.npdHint ? h('div', { class: 'mfw-hint' }, this.npdHint) : null,
                ]),
            field(this.nameLabel, this.f, 'name'),
            this.needKpp ? field('КПП (9 цифр)', this.f, 'kpp', { inputmode: 'numeric' }) : null,
            this.needOgrn ? field(`${this.ogrnLabel} (${this.f.recipient_type === 'ip' ? '15' : '13'} цифр)`, this.f, 'ogrn', { inputmode: 'numeric' }) : null,
            field('Банк', this.f, 'bank_name'),
            fieldBtn('БИК (9 цифр)', 'bik', 'Найти по БИК', this.lookupBik, this.bikBusy, this.bikMsg, { inputmode: 'numeric' }),
            field('Расчётный счёт (20 цифр)', this.f, 'account', { inputmode: 'numeric' }),
            field('Корр. счёт (20 цифр, необязательно)', this.f, 'corr_account', { inputmode: 'numeric' }),
            h('div', { class: 'mfw-actions' }, [
                h('button', { class: 'mfw-btn', type: 'button', disabled: this.saving, onClick: this.saveRequisites }, this.saving ? '…' : 'Сохранить реквизиты'),
                this.reqOk ? h('span', { class: 'mfw-ok' }, this.reqOk) : null,
                this.reqErr ? h('span', { class: 'mfw-err' }, this.reqErr) : null,
            ]),
        ];

        const wd = [
            h('div', { class: 'mfw-balance' }, `Доступно к выводу: ${fmtMoney(this.balance)} ₽`),
            h('div', { class: 'mfw-wrow' }, [
                h('input', { class: 'mfw-input mfw-amount', inputmode: 'numeric', placeholder: 'Сумма', value: this.amount, onInput: (e) => { this.amount = e.target.value; } }),
                h('button', { class: 'mfw-btn mfw-btn-primary', type: 'button', disabled: this.requesting, onClick: this.doWithdraw }, this.requesting ? '…' : 'Запросить вывод'),
            ]),
            this.wdOk ? h('div', { class: 'mfw-ok' }, this.wdOk) : null,
            this.wdErr ? h('div', { class: 'mfw-err' }, this.wdErr) : null,
        ];

        const statusCls = (s) => (s === 'Подтверждено' ? 'mfw-st-ok' : s === 'Отклонено' ? 'mfw-st-no' : 'mfw-st-wait');
        const hist = [h('div', { class: 'mfw-subhead' }, 'История заявок')];
        if (!this.history.length) hist.push(h('div', { class: 'mfw-empty' }, 'Заявок пока нет.'));
        else this.history.forEach((r) => hist.push(h('div', { class: 'mfw-hrow', key: r.id }, [
            h('span', { class: 'mfw-hdate' }, fmtDate(r.created_at)),
            h('span', { class: 'mfw-hsum' }, `${fmtMoney(r.amount)} ₽`),
            h('span', { class: ['mfw-hst', statusCls(r.status)] }, r.status),
            r.admin_comment ? h('span', { class: 'mfw-hcom' }, r.admin_comment) : null,
        ])));

        return h('div', { class: 'mfw' }, [
            h('div', { class: 'mfw-card' }, [h('div', { class: 'mfw-subhead' }, 'Платёжные реквизиты'), ...reqFields.filter(Boolean)]),
            h('div', { class: 'mfw-card' }, wd.filter(Boolean)),
            h('div', { class: 'mfw-card' }, hist),
        ]);
    },
};
