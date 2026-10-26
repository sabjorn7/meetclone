// Хенд-компонент вкладки «Вывод средств» на /my_finanse (Вариант 2: вшиваем в существующий mount-in
// myFinanseSales.js, нативную WeWeb-форму прячем). Реквизиты и вывод — через закрытые RPC:
//   get_my_requisites / save_my_requisites / request_withdrawal / get_my_withdrawals.
// Баланс берём из коллекции текущего пользователя (своя строка users.Ammount — переживает own-row RLS).
// Монтируется и переунмаунчивается ЕДИНЫМ observer'ом из myFinanseSales.js (initMyFinanseSales).
import { h, ref, reactive, computed, onMounted } from 'vue';

const CURRENT_USER_COLLECTION_ID = 'ebe8a1ca-0b4e-494f-a496-5e281d06bd16';
// Якорь — заголовок таба «Вывод средств»; после него вставляем наш root. Нативную форму прячем по DOM.
export const WD_HEADER_UID = '6e036746-8b3a-4483-a356-171717834ed4';
export const WD_BUTTON_UID = '21e9a5a1-07ff-43bf-bb3b-957f122b6b8a';
export const WD_ANCHOR_UID = WD_HEADER_UID;
export const WD_ROOT_ID = 'my-finanse-withdrawal-root';

function supa() { return window.wwLib?.wwPlugins?.supabase?.instance || null; }
function curUser() {
    return window.wwLib?.$store?.getters?.['data/getCollections']?.[CURRENT_USER_COLLECTION_ID]?.data?.[0] || null;
}
function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso); const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}
function fmtMoney(n) { return Math.round(Number(n) || 0).toLocaleString('ru-RU'); }

// Нативную WeWeb-форму вывода прячем двумя путями (дополняют друг друга):
//   1) ВСЕГДА — CSS по 7 известным UID (6 инпутов + кнопка), см. WD_CSS ниже (fallback-база);
//   2) рантайм — вычисляем в ЖИВОМ DOM наименьшего общего предка (LCA) этих 7 элементов и прячем его
//      (закроет и «Сумму/Банк», и подписи), НО только если LCA прошёл жёсткие safety-гейты.
// hideNativeWithdrawalForm() зовётся из tryMount (myFinanseSales.js) и переустанавливается observer'ом.

// 6 инпутов (ИНН/КПП/БИК/Р-С/К-С/коммент) + кнопка — разрешены из page JSON по '<uid>-value' insert-экшена.
const WD_FIELD_UIDS = [
    'b69110dc-f6fa-4bec-8b80-da2aa7434b0a', '933d5e88-9381-481c-b452-4596ae8d47fb',
    'df2974d1-1dfc-4b7d-9f0c-045942ab992e', '4514faa7-72f8-4ce3-a92d-f203c4acb530',
    '0ccb0198-584c-47ba-8d50-510789d53e64', '1ea7576f-7ed9-4061-aaac-4ca7a2edd7e2',
    WD_BUTTON_UID,
];
// Для safety-гейтов LCA (хардкод, чтобы избежать циклического импорта из myFinanseSales.js).
const SALES_ANCHOR_UID = 'cefa599a-1993-4f1c-a0ef-a67a4045ad5d';
const ORDERS_ANCHOR_UID = '3d1fa149-99d2-4799-b8f0-887604dbf1f0';
const SALES_ROOT_ID = 'my-finanse-sales-root';
const ORDERS_ROOT_ID = 'my-finanse-orders-root';
const LCA_MAX_NODES = 60;

function lcaOf(elements) {
    if (!elements.length) return null;
    let anc = [];
    for (let n = elements[0]; n; n = n.parentElement) anc.push(n); // от элемента к корню (LCA будет anc[0])
    for (let i = 1; i < elements.length; i++) {
        const set = new Set();
        for (let n = elements[i]; n; n = n.parentElement) set.add(n);
        anc = anc.filter((a) => set.has(a));
        if (!anc.length) return null;
    }
    return anc[0] || null;
}

export function hideNativeWithdrawalForm() {
    try {
        const sel = WD_FIELD_UIDS.map((u) => `[class*="ww-element-${u}"]`).join(',');
        const els = Array.from(document.querySelectorAll(sel)).filter((e) => !e.closest(`#${WD_ROOT_ID}`));
        if (els.length < WD_FIELD_UIDS.length) return;           // не все поля отрисованы — CSS пока держит 7
        const lca = lcaOf(els);
        if (lca && lca.getAttribute && lca.getAttribute('data-mfw-hidden')) return; // уже спрятан — тихо выходим

        let ok = !!lca;
        const tag = ok && lca.tagName ? lca.tagName.toLowerCase() : '';
        if (ok && (tag === 'body' || tag === 'html' || tag === 'main' || lca === document.body || lca === document.documentElement || lca.id === 'app')) ok = false; // (г)
        if (ok) {
            const forbidden = [
                `[class*="ww-element-${WD_HEADER_UID}"]`,      // (а) заголовок-якорь
                `#${WD_ROOT_ID}`,                               // (б) наш mount-in
                `[class*="ww-element-${SALES_ANCHOR_UID}"]`,    // (в) продажи/заказы
                `[class*="ww-element-${ORDERS_ANCHOR_UID}"]`,
                `#${SALES_ROOT_ID}`, `#${ORDERS_ROOT_ID}`,
            ];
            if (forbidden.some((f) => lca.querySelector(f))) ok = false;
        }
        let nodes = 0;
        if (ok) { nodes = lca.querySelectorAll('*').length; if (nodes > LCA_MAX_NODES) ok = false; } // (г) не слишком большой

        if (ok) {
            lca.style.display = 'none';
            lca.setAttribute('data-mfw-hidden', '1');
            console.log(`[mfw] native withdrawal form hidden: lca (nodes=${nodes})`);
        } else {
            console.log('[mfw] native withdrawal form: fallback (CSS 7 UID), lca unsafe/absent');
        }
    } catch (_) { console.log('[mfw] native withdrawal form: fallback (CSS 7 UID), error'); }
}

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
        const hadType = ref(null);               // сохранённый ранее тип (для предупреждения о смене)
        const saving = ref(false), reqErr = ref(''), reqOk = ref('');
        const amount = ref(''); const requesting = ref(false), wdErr = ref(''), wdOk = ref('');
        const history = ref([]);
        const balance = ref(0);

        const typeChanged = computed(() => hadType.value && hadType.value !== f.recipient_type);
        const needKpp = computed(() => f.recipient_type === 'ooo');
        const needOgrn = computed(() => f.recipient_type === 'ooo' || f.recipient_type === 'ip');
        const ogrnLabel = computed(() => (f.recipient_type === 'ip' ? 'ОГРНИП' : 'ОГРН'));
        const nameLabel = computed(() => (f.recipient_type === 'ooo' ? 'Наименование организации' : 'ФИО'));

        function readBalance() { const u = curUser(); balance.value = u ? Number(u.Ammount || 0) : 0; }

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
            if (amt > balance.value) { wdErr.value = 'Недостаточно средств на балансе.'; return; }
            requesting.value = true;
            try {
                const { error } = await supa().rpc('request_withdrawal', { p_amount: amt });
                if (error) throw error;
                wdOk.value = 'Заявка создана. Выплата будет проведена вручную после проверки.';
                amount.value = '';
                balance.value = Math.max(0, balance.value - amt);  // оптимистично (коллекция users обновится при перезагрузке)
                await loadHistory();
            } catch (e) { wdErr.value = mapErr(e, WD_ERRORS) || 'Не удалось создать заявку.'; }
            finally { requesting.value = false; }
        }

        onMounted(async () => {
            readBalance();
            await Promise.all([loadRequisites(), loadHistory()]);
            loading.value = false;
        });

        return { loading, f, typeChanged, needKpp, needOgrn, ogrnLabel, nameLabel, saving, reqErr, reqOk,
            amount, requesting, wdErr, wdOk, history, balance, saveRequisites, doWithdraw };
    },
    render() {
        const field = (label, model, key, attrs = {}) => h('label', { class: 'mfw-field' }, [
            h('span', { class: 'mfw-label' }, label),
            h('input', { class: 'mfw-input', value: this.f[key], onInput: (e) => { this.f[key] = e.target.value; }, ...attrs }),
        ]);
        if (this.loading) return h('div', { class: 'mfw' }, h('div', { class: 'mfw-empty' }, 'Загрузка…'));

        // 1) Реквизиты
        const reqFields = [
            h('label', { class: 'mfw-field' }, [
                h('span', { class: 'mfw-label' }, 'Тип получателя'),
                h('select', { class: 'mfw-input', value: this.f.recipient_type, onChange: (e) => { this.f.recipient_type = e.target.value; } },
                    TYPES.map((t) => h('option', { value: t.v }, t.l))),
            ]),
            this.typeChanged ? h('div', { class: 'mfw-note' }, 'Смена типа получателя будет отмечена для администратора.') : null,
            field(this.nameLabel, this.f, 'name'),
            field(this.f.recipient_type === 'ooo' ? 'ИНН (10 цифр)' : 'ИНН (12 цифр)', this.f, 'inn', { inputmode: 'numeric' }),
            this.needKpp ? field('КПП (9 цифр)', this.f, 'kpp', { inputmode: 'numeric' }) : null,
            this.needOgrn ? field(`${this.ogrnLabel} (${this.f.recipient_type === 'ip' ? '15' : '13'} цифр)`, this.f, 'ogrn', { inputmode: 'numeric' }) : null,
            field('Банк', this.f, 'bank_name'),
            field('БИК (9 цифр)', this.f, 'bik', { inputmode: 'numeric' }),
            field('Расчётный счёт (20 цифр)', this.f, 'account', { inputmode: 'numeric' }),
            field('Корр. счёт (20 цифр, необязательно)', this.f, 'corr_account', { inputmode: 'numeric' }),
            h('div', { class: 'mfw-actions' }, [
                h('button', { class: 'mfw-btn', type: 'button', disabled: this.saving, onClick: this.saveRequisites }, this.saving ? '…' : 'Сохранить реквизиты'),
                this.reqOk ? h('span', { class: 'mfw-ok' }, this.reqOk) : null,
                this.reqErr ? h('span', { class: 'mfw-err' }, this.reqErr) : null,
            ]),
        ];

        // 2) Вывод
        const wd = [
            h('div', { class: 'mfw-balance' }, `Доступно к выводу: ${fmtMoney(this.balance)} ₽`),
            h('div', { class: 'mfw-wrow' }, [
                h('input', { class: 'mfw-input mfw-amount', inputmode: 'numeric', placeholder: 'Сумма', value: this.amount, onInput: (e) => { this.amount = e.target.value; } }),
                h('button', { class: 'mfw-btn mfw-btn-primary', type: 'button', disabled: this.requesting, onClick: this.doWithdraw }, this.requesting ? '…' : 'Запросить вывод'),
            ]),
            this.wdOk ? h('div', { class: 'mfw-ok' }, this.wdOk) : null,
            this.wdErr ? h('div', { class: 'mfw-err' }, this.wdErr) : null,
        ];

        // 3) История
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

export const WD_CSS = `
/* Прячем нативную WeWeb-форму вывода ТОЧЕЧНО по UID элементов (НЕ трогаем вкладки/фильтры).
   UID взяты из dist/data/8df505c3-….json по маппингу переменных '<uid>-value' insert-экшена в sales:
     ИНН=b69110dc · КПП=933d5e88 · БИК=df2974d1 · Р/С(pc)=4514faa7 · К/С(kc)=0ccb0198 ·
     Комментарий(user_comment)=1ea7576f · кнопка отправки(WD_BUTTON)=21e9a5a1.
   TODO (подтвердить в WeWeb-редакторе — ровно 2 из кандидатов 7a8e6bc4 / 8f662061 / d3e5284d / ebaf5ae9):
     поля «Сумма» и «Банк/Наименование» — добавить их UID в селектор ниже, иначе они останутся видимы. */
[class*="ww-element-b69110dc-f6fa-4bec-8b80-da2aa7434b0a"],
[class*="ww-element-933d5e88-9381-481c-b452-4596ae8d47fb"],
[class*="ww-element-df2974d1-1dfc-4b7d-9f0c-045942ab992e"],
[class*="ww-element-4514faa7-72f8-4ce3-a92d-f203c4acb530"],
[class*="ww-element-0ccb0198-584c-47ba-8d50-510789d53e64"],
[class*="ww-element-1ea7576f-7ed9-4061-aaac-4ca7a2edd7e2"],
button[class*="ww-element-21e9a5a1-07ff-43bf-bb3b-957f122b6b8a"]{display:none !important;}
#${WD_ROOT_ID}{width:100%;}
.mfw{display:flex;flex-direction:column;gap:16px;width:100%;box-sizing:border-box;}
.mfw *{box-sizing:border-box;}
.mfw-card{border:1px solid #ECEEF2;border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:12px;}
.mfw-subhead{font-size:16px;font-weight:600;color:#1B1F27;}
.mfw-field{display:flex;flex-direction:column;gap:4px;}
.mfw-label{font-size:13px;color:#8A94A6;}
.mfw-input{height:42px;border:1px solid #E1E5EA;border-radius:8px;padding:0 12px;font-size:15px;color:#1B1F27;background:#fff;width:100%;}
.mfw-note{font-size:13px;color:#92400e;background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:8px 10px;}
.mfw-actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:4px;}
.mfw-balance{font-size:17px;font-weight:600;color:#1B1F27;}
.mfw-wrow{display:flex;gap:10px;flex-wrap:wrap;}
.mfw-amount{max-width:200px;}
.mfw-btn{height:42px;padding:0 18px;border-radius:8px;border:1px solid #5495F3;background:#fff;color:#5495F3;font-size:14px;font-weight:600;cursor:pointer;}
.mfw-btn:disabled{opacity:.6;cursor:default;}
.mfw-btn-primary{background:#5495F3;color:#fff;}
.mfw-ok{color:#3BA55D;font-size:14px;font-weight:500;}
.mfw-err{color:#E6052E;font-size:14px;font-weight:500;}
.mfw-hrow{display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #ECEEF2;font-size:14px;flex-wrap:wrap;}
.mfw-hdate{color:#8A94A6;width:92px;flex:none;}
.mfw-hsum{font-weight:600;width:110px;flex:none;}
.mfw-hst{font-weight:600;}
.mfw-st-ok{color:#3BA55D;}.mfw-st-no{color:#E6052E;}.mfw-st-wait{color:#C79100;}
.mfw-hcom{color:#8A94A6;flex:1 1 100%;}
.mfw-empty{color:#8A94A6;padding:12px 0;}
`;
