<!--
  Hand-written /faq override (replaces the WeWeb FAQ page). Content-only: the shared
  AppHeader/AppFooter are rendered globally by App.vue. Same visual language as the legal pages
  (views/legal/LegalPage.vue). Bilingual RU/EN with a switch; content is a plain data object,
  accordion via native <details> (accessible, no deps).

  FAQ CMS (2026-10-30, PENDING — see relay outbox faq-04-cms-plan.md): on mount, probes
  public.faq (RLS-gated, published=true). Once ANY row has ever been seen for ANY audience/lang
  (via the probe or any later per-combo load) — `everSawRows` flips true FOR THE REST OF THE
  SESSION and stays true: tabs + search render from then on and never disappear again, even if a
  later combo/network hiccup returns 0 rows or errors (that renders the "Скоро здесь появятся
  ответы" / "Ничего не найдено" messages below, NOT a revert to the old static CONTENT — owner
  decision 2026-10-30, point 1). The old hardcoded CONTENT (no tabs, no search) is shown ONLY
  while `everSawRows` has never been true — i.e. the table is confirmed completely empty or
  unreachable. One accepted trade-off: on a cold load where the DEFAULT combo (students/ru) has
  zero rows but some OTHER combo has content, there's a brief instant where the old CONTENT
  paints before the unfiltered probe resolves and swaps to tabs — not worth a dedicated top-level
  loading gate for an internal FAQ page.
-->
<template>
    <div class="fq">
        <main class="fq-main">
            <div class="fq-titlerow">
                <h1 class="fq-title">{{ t.title }}</h1>
                <div class="fq-lang" role="group" aria-label="Language">
                    <button :class="{ active: lang === 'ru' }" @click="lang = 'ru'">РУС</button>
                    <button :class="{ active: lang === 'en' }" @click="lang = 'en'">ENG</button>
                </div>
            </div>
            <p class="fq-lead">{{ t.lead }}</p>

            <div v-if="everSawRows" class="fq-controls">
                <div class="fq-audience" role="group" aria-label="Аудитория">
                    <button :class="{ active: audience === 'students' }" @click="audience = 'students'">Ученикам</button>
                    <button :class="{ active: audience === 'experts' }" @click="audience = 'experts'">Экспертам</button>
                </div>
                <input v-model="search" type="search" class="fq-search" placeholder="Поиск по вопросам" />
            </div>

            <p v-if="dbLoadingCombo" class="fq-empty">Загрузка…</p>
            <p v-else-if="audienceEmpty" class="fq-empty">Скоро здесь появятся ответы.</p>
            <p v-else-if="searchEmpty" class="fq-empty">Ничего не найдено. Попробуйте другой запрос.</p>

            <section v-for="(sec, si) in sections" :key="si" class="fq-section">
                <h2 class="fq-section-title">{{ sec.title }}</h2>
                <details v-for="(item, ii) in sec.items" :key="ii" class="fq-item">
                    <summary class="fq-q">
                        <span>{{ item.q }}</span>
                        <span class="fq-chevron" aria-hidden="true">▾</span>
                    </summary>
                    <div class="fq-a" v-html="item.a"></div>
                </details>
            </section>

            <a href="/faq/guides" class="fq-guides-link">Подробные инструкции по разделам →</a>

            <section class="fq-support">
                <h2 class="fq-section-title">{{ t.support.title }}</h2>
                <p>{{ t.support.intro }}</p>
                <ul class="fq-contacts">
                    <li>{{ t.support.chat }}</li>
                    <li>{{ t.support.emailLabel }}: <a href="mailto:adv@meetgu.ru">adv@meetgu.ru</a></li>
                    <li>{{ t.support.phoneLabel }}: <a href="tel:+79824979556">+7 982 497 9556</a></li>
                    <li>{{ t.support.addressLabel }}: {{ t.support.address }}</li>
                </ul>
                <nav class="fq-links" :aria-label="t.support.docs">
                    <a href="/politica">{{ t.support.politica }}</a>
                    <a href="/oferta">{{ t.support.oferta }}</a>
                    <a href="/soglasie">{{ t.support.soglasie }}</a>
                </nav>
            </section>
        </main>
    </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue';

// Prefer the browser language on first load; default to Russian.
const lang = ref(typeof navigator !== 'undefined' && /^en/i.test(navigator.language || '') ? 'en' : 'ru');

const CONTENT = {
    ru: {
        back: '← Назад',
        title: 'Справочный центр',
        lead: 'Ответы на частые вопросы о платформе МитГуру — для студентов и авторов.',
        sections: [
            {
                title: 'О платформе',
                items: [
                    {
                        q: 'Что такое МитГуру?',
                        a: 'Образовательная платформа для специалистов по кинезиологии, остеопатии, мануальной терапии и массажу. Здесь можно учиться на курсах, читать статьи, вступать в клубы, смотреть живые эфиры и общаться с профессиональным сообществом.',
                    },
                    {
                        q: 'Кому подходит платформа?',
                        a: 'Студентам, которые хотят освоить профессию или повысить квалификацию, и авторам — спикерам и учебным заведениям, которые публикуют и продают свои курсы и ведут аудиторию.',
                    },
                ],
            },
            {
                title: 'Курсы и обучение',
                items: [
                    {
                        q: 'Как купить курс?',
                        a: 'Откройте страницу курса и нажмите «Купить». Оплата откроется на сайте через платёжную систему Prodamus (СБП или банковская карта).',
                    },
                    {
                        q: 'Где найти купленные курсы?',
                        a: 'В разделе «Мои курсы» — там же сохраняется прогресс, и обучение можно продолжить с того места, где вы остановились.',
                    },
                    {
                        q: 'Доступ к курсу навсегда или на время?',
                        a: 'Зависит от курса: часть курсов даётся бессрочно, часть — на срок (например, 6 или 12 месяцев). Для курсов с ограниченным сроком доступна кнопка «Продлить».',
                    },
                    {
                        q: 'Можно ли смотреть уроки офлайн?',
                        a: 'Да, в мобильном приложении уроки можно скачать и смотреть без интернета.',
                    },
                    {
                        q: 'Как вернуть деньги за курс?',
                        a: 'Условия возврата описаны в <a href="/oferta">Оферте</a>. По вопросам возврата напишите в поддержку.',
                    },
                ],
            },
            {
                title: 'Оплата',
                items: [
                    {
                        q: 'Какие есть способы оплаты?',
                        a: 'Оплата проходит через платёжную систему Prodamus: СБП и банковские карты.',
                    },
                    {
                        q: 'Оплата проходит внутри приложения?',
                        a: 'Нет. Оплата открывается на сайте в браузере (Prodamus). Приложение показывает уже доступный вам контент.',
                    },
                ],
            },
            {
                title: 'Клубы',
                items: [
                    {
                        q: 'Что такое клубы?',
                        a: 'Закрытые сообщества по подписке — с эксклюзивными материалами и общением с коллегами. Оплата и управление подпиской — на сайте.',
                    },
                ],
            },
            {
                title: 'Живые эфиры',
                items: [
                    {
                        q: 'Что такое эфиры?',
                        a: 'Прямые онлайн-трансляции спикеров и школ. Смотрите на сайте или в приложении и задавайте вопросы в чате эфира.',
                    },
                    {
                        q: 'Кто может вести эфиры?',
                        a: 'Пользователи с ролью «Спикер» или «Учебное заведение» — прямо с камеры телефона в приложении.',
                    },
                ],
            },
            {
                title: 'Авторам и учебным заведениям',
                items: [
                    {
                        q: 'Как начать продавать курсы?',
                        a: 'Зарегистрируйтесь как «Спикер» или «Учебное заведение», загрузите курс и настройте продажу — это занимает считанные минуты.',
                    },
                    {
                        q: 'Какая комиссия платформы?',
                        a: 'Комиссия платформы составляет <strong>18%</strong> от суммы продажи.',
                    },
                    {
                        q: 'Как и когда выводить средства?',
                        a: 'Выплаты производятся два раза в неделю — по <strong>понедельникам и четвергам</strong>. Баланс и история продаж — в разделе «Финансы».',
                    },
                    {
                        q: 'Где смотреть статистику продаж?',
                        a: 'В разделе «Финансы»: баланс, продажи и полная история продаж ваших продуктов.',
                    },
                    {
                        q: 'Можно ли публиковать статьи и вести эфиры?',
                        a: 'Да, авторы могут публиковать статьи и проводить прямые трансляции для своей аудитории.',
                    },
                ],
            },
            {
                title: 'Аккаунт и общение',
                items: [
                    {
                        q: 'Какие роли можно выбрать при регистрации?',
                        a: 'Специалист (ученик), Спикер и Учебное заведение.',
                    },
                    {
                        q: 'Как общаться с другими участниками?',
                        a: 'Через личные и групповые чаты, а также публичные профили специалистов, на которые можно подписаться.',
                    },
                    {
                        q: 'Забыли пароль?',
                        a: 'Воспользуйтесь ссылкой «Забыли пароль?» на экране входа.',
                    },
                ],
            },
        ],
        support: {
            title: 'Поддержка',
            intro: 'Нам важен каждый вопрос или предложение. Мы отвечаем в течение рабочего дня.',
            chat: 'Чат поддержки — в правом нижнем углу сайта.',
            emailLabel: 'Почта',
            phoneLabel: 'Телефон',
            addressLabel: 'Адрес',
            address: 'Москва, ул. Гарибальди, 36',
            docs: 'Документы',
            politica: 'Политика конфиденциальности',
            oferta: 'Оферта',
            soglasie: 'Согласие на обработку ПД',
        },
    },
    en: {
        back: '← Back',
        title: 'Help Center',
        lead: 'Answers to common questions about MeetGuru — for students and authors.',
        sections: [
            {
                title: 'About the platform',
                items: [
                    {
                        q: 'What is MeetGuru?',
                        a: 'An educational platform for specialists in kinesiology, osteopathy, manual therapy and massage. Take courses, read articles, join clubs, watch live streams and connect with the professional community.',
                    },
                    {
                        q: 'Who is it for?',
                        a: 'For students who want to learn a profession or improve their skills, and for authors — speakers and educational institutions who publish and sell their courses and grow an audience.',
                    },
                ],
            },
            {
                title: 'Courses & learning',
                items: [
                    {
                        q: 'How do I buy a course?',
                        a: 'Open the course page and tap “Buy”. Checkout opens on the website via the Prodamus payment provider (SBP or bank card).',
                    },
                    {
                        q: 'Where are my purchased courses?',
                        a: 'In the “My Courses” section, which also keeps your progress so you can continue where you left off.',
                    },
                    {
                        q: 'Is course access lifetime or time-limited?',
                        a: 'It depends on the course: some are lifetime, some are time-limited (e.g. 6 or 12 months). Time-limited courses show a “Renew” button.',
                    },
                    {
                        q: 'Can I watch lessons offline?',
                        a: 'Yes — in the mobile app you can download lessons and watch them without internet.',
                    },
                    {
                        q: 'How do I get a refund?',
                        a: 'Refund terms are described in the <a href="/oferta">Offer Agreement</a>. For refund requests, contact support.',
                    },
                ],
            },
            {
                title: 'Payment',
                items: [
                    {
                        q: 'What payment methods are available?',
                        a: 'Payments go through the Prodamus provider: SBP and bank cards.',
                    },
                    {
                        q: 'Does payment happen inside the app?',
                        a: 'No. Checkout opens on the website in the browser (Prodamus). The app displays content you already have access to.',
                    },
                ],
            },
            {
                title: 'Clubs',
                items: [
                    {
                        q: 'What are clubs?',
                        a: 'Private subscription communities with exclusive materials and peer discussion. Payment and subscription management are on the website.',
                    },
                ],
            },
            {
                title: 'Live streams',
                items: [
                    {
                        q: 'What are live streams?',
                        a: 'Live online broadcasts from speakers and schools. Watch on the website or in the app and ask questions in the stream chat.',
                    },
                    {
                        q: 'Who can broadcast?',
                        a: 'Users with the “Speaker” or “Educational institution” role — straight from the phone camera in the app.',
                    },
                ],
            },
            {
                title: 'For authors & institutions',
                items: [
                    {
                        q: 'How do I start selling courses?',
                        a: 'Register as a “Speaker” or “Educational institution”, upload your course and set up sales — it takes just a few minutes.',
                    },
                    {
                        q: 'What is the platform commission?',
                        a: 'The platform commission is <strong>18%</strong> of the sale amount.',
                    },
                    {
                        q: 'How and when are payouts made?',
                        a: 'Payouts are made twice a week — on <strong>Mondays and Thursdays</strong>. Balance and sales history are in the “Finance” section.',
                    },
                    {
                        q: 'Where can I see sales statistics?',
                        a: 'In the “Finance” section: balance, sales and the full sales history of your products.',
                    },
                    {
                        q: 'Can I publish articles and go live?',
                        a: 'Yes — authors can publish articles and run live broadcasts for their audience.',
                    },
                ],
            },
            {
                title: 'Account & community',
                items: [
                    {
                        q: 'Which roles can I choose at sign-up?',
                        a: 'Specialist (student), Speaker and Educational institution.',
                    },
                    {
                        q: 'How do I talk to other members?',
                        a: 'Through private and group chats, and public specialist profiles you can follow.',
                    },
                    {
                        q: 'Forgot your password?',
                        a: 'Use the “Forgot password?” link on the sign-in screen.',
                    },
                ],
            },
        ],
        support: {
            title: 'Support',
            intro: 'Every question or suggestion matters to us. We reply within one business day.',
            chat: 'Support chat — in the bottom-right corner of the website.',
            emailLabel: 'Email',
            phoneLabel: 'Phone',
            addressLabel: 'Address',
            address: 'Moscow, Garibaldi St, 36',
            docs: 'Documents',
            politica: 'Privacy Policy',
            oferta: 'Offer Agreement',
            soglasie: 'Consent to Data Processing',
        },
    },
};

const t = computed(() => CONTENT[lang.value]);

// ---------------------------------------------------------------------------
// FAQ CMS read path (public.faq) — see 2026-10-30_pending_faq_table.sql /
// faq-04-cms-plan.md in relay outbox. PENDING: migration not applied yet, table may not exist.
// ---------------------------------------------------------------------------

// Category display order per lang + audience (faq-02-edit-and-structure.md §3, "О платформе"
// added as the lead-in category per the 82-row live dataset). Categories from the DB that
// aren't in this list sort after it, alphabetically — keeps new categories from silently
// vanishing if someone adds one via Studio before this list is updated.
const CATEGORY_ORDER = {
    ru: {
        students: ['О платформе', 'Оплата и доступ', 'Курсы и обучение', 'Возврат денег', 'Эфиры', 'Клубы (подписки)', 'Бонусы и промокоды', 'Профиль и пароль'],
        experts: ['Создание курса', 'Цены и скидки', 'Выплаты и комиссия', 'Эфиры', 'Клуб', 'Мероприятия'],
    },
    en: {
        students: ['About', 'Payment and access', 'Courses and learning', 'Refunds', 'Live streams', 'Clubs (subscriptions)', 'Promo codes', 'Profile and password'],
        experts: ['Creating a course', 'Prices and discounts', 'Payouts and commission', 'Live streams', 'Club', 'Events'],
    },
};

function supa() {
    const inst = window.wwLib?.wwPlugins?.supabase?.instance;
    if (!inst) throw new Error('Supabase недоступен на этой странице.');
    return inst;
}

// DOMPurify loaded lazily (only once DB rows actually exist) and kept as a module-level
// singleton so the noopener/noreferrer hook below is registered exactly once.
let purify = null;
async function sanitizeAnswer(html) {
    if (!purify) {
        const mod = await import('dompurify');
        purify = mod.default || mod;
        // Force rel="noopener noreferrer" on every link regardless of what the admin typed in
        // Supabase Studio — this content is admin-authored, not attacker-controlled, but a
        // forgotten rel on a target="_blank" link is a real (if minor) tab-nabbing footgun.
        purify.addHook('afterSanitizeAttributes', (node) => {
            if (node.tagName === 'A') node.setAttribute('rel', 'noopener noreferrer');
        });
    }
    return purify.sanitize(html, {
        ALLOWED_TAGS: ['a', 'strong', 'em', 'b', 'i', 'br', 'p', 'ul', 'ol', 'li'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
}

const audience = ref('students');
const search = ref('');

// Sticky "the table is alive" flag (owner decision 2026-10-30, point 1): once true, NEVER goes
// back to false for the rest of this page visit — tabs/search stay visible even if a later
// combo or a transient error returns nothing. Only a page reload re-evaluates it.
const everSawRows = ref(false);
function markRowsSeen() { everSawRows.value = true; }

// Unfiltered existence probe (any published row, any audience/lang) — fired once on mount so
// tabs can appear even if the DEFAULT combo (students/ru) happens to have zero rows while some
// other combo has content. Independent of loadFaq(); failure here just means we learn nothing
// from it (loadFaq's own success can still flip everSawRows).
async function probeAnyRows() {
    try {
        const { data } = await supa().from('faq').select('id').limit(1);
        if (data && data.length) markRowsSeen();
    } catch (e) { /* stay as-is — not the only source of truth */ }
}

// Rows for the CURRENT audience+lang. null = loading (or not yet attempted); [] = loaded,
// genuinely zero rows for this combo; array = content.
const dbSections = ref(null);

let loadSeq = 0; // guards against an older in-flight request overwriting a newer one's result
async function loadFaq() {
    const mySeq = ++loadSeq;
    dbSections.value = null; // mark "loading" for this combo
    try {
        const { data, error } = await supa()
            .from('faq')
            .select('category, question, answer, sort')
            .eq('audience', audience.value)
            .eq('lang', lang.value)
            .order('sort', { ascending: true });
        if (mySeq !== loadSeq) return; // a newer call already landed — drop this stale one
        if (error || !data || !data.length) {
            // Empty/error for THIS combo. If we already know the table has content elsewhere
            // (everSawRows), this is "nothing published yet for this audience/lang" — show the
            // "coming soon" message, never the old CONTENT (see template-side note on why).
            dbSections.value = [];
            return;
        }
        markRowsSeen();
        const byCategory = new Map();
        for (const row of data) {
            if (!byCategory.has(row.category)) byCategory.set(row.category, []);
            byCategory.get(row.category).push(row);
        }
        const order = CATEGORY_ORDER[lang.value]?.[audience.value] || [];
        const titles = [...byCategory.keys()].sort((a, b) => {
            const ia = order.indexOf(a);
            const ib = order.indexOf(b);
            if (ia === -1 && ib === -1) return a.localeCompare(b, 'ru');
            if (ia === -1) return 1;
            if (ib === -1) return -1;
            return ia - ib;
        });
        const sectionsOut = [];
        for (const title of titles) {
            const items = [];
            for (const row of byCategory.get(title)) {
                items.push({ q: row.question, a: await sanitizeAnswer(row.answer) });
            }
            sectionsOut.push({ title, items });
        }
        if (mySeq === loadSeq) dbSections.value = sectionsOut;
    } catch (e) {
        // Any failure (network, RLS, "relation public.faq does not exist" after a rollback) —
        // treat as empty-for-this-combo. Does NOT clear everSawRows once it's true.
        if (mySeq === loadSeq) dbSections.value = [];
    }
}

onMounted(() => {
    probeAnyRows();
    loadFaq();
});
watch([audience, lang], loadFaq);

// What actually renders: DB sections for the current audience/lang once the table is known to be
// alive, else the untouched hardcoded CONTENT. Search filters client-side over the already-
// loaded rows — dataset is small, no extra round-trip.
const sections = computed(() => {
    if (!everSawRows.value) return t.value.sections;
    const base = dbSections.value || [];
    const needle = search.value.trim().toLowerCase();
    if (!needle) return base;
    return base
        .map((sec) => ({ ...sec, items: sec.items.filter((i) => `${i.q} ${i.a}`.toLowerCase().includes(needle)) }))
        .filter((sec) => sec.items.length);
});

// Three mutually exclusive states once tabs are showing: still loading the current combo,
// genuinely zero rows for it (pre-search), or the search itself filtered everything out.
const dbLoadingCombo = computed(() => everSawRows.value && dbSections.value === null);
const audienceEmpty = computed(() => everSawRows.value && dbSections.value !== null && dbSections.value.length === 0);
const searchEmpty = computed(() => everSawRows.value && !!dbSections.value?.length && sections.value.length === 0);
</script>

<style scoped>
.fq {
    min-height: calc(100vh - 62px); /* #app already reserves 62px for the fixed AppHeader */
    background: #f6f7f9;
    color: #1f2733;
    font-family: 'Raleway', system-ui, -apple-system, sans-serif;
}
.fq-titlerow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
}
.fq-lang {
    display: inline-flex;
    border: 1px solid #d6dbe3;
    border-radius: 999px;
    overflow: hidden;
}
.fq-lang button {
    appearance: none;
    border: none;
    background: transparent;
    padding: 5px 12px;
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    color: #5b6472;
    cursor: pointer;
}
.fq-lang button.active {
    background: #2e6fd6;
    color: #fff;
}
.fq-back {
    color: #5b6472;
    text-decoration: none;
    font-size: 14px;
    white-space: nowrap;
}
.fq-back:hover { color: #2e6fd6; }
.fq-main {
    max-width: 900px;
    margin: 0 auto;
    padding: 8px 20px 64px;
}
.fq-title {
    font-size: 28px;
    line-height: 1.2;
    margin: 8px 0 8px;
}
.fq-lead {
    color: #5b6472;
    margin: 0 0 24px;
    font-size: 15px;
}
.fq-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin: 0 0 24px;
}
.fq-audience {
    display: inline-flex;
    border: 1px solid #d6dbe3;
    border-radius: 999px;
    overflow: hidden;
    flex-shrink: 0;
}
.fq-audience button {
    appearance: none;
    border: none;
    background: transparent;
    padding: 7px 16px;
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    color: #5b6472;
    cursor: pointer;
}
.fq-audience button.active {
    background: #2e6fd6;
    color: #fff;
}
.fq-search {
    flex: 1 1 220px;
    max-width: 320px;
    padding: 8px 14px;
    border: 1px solid #d6dbe3;
    border-radius: 999px;
    font: inherit;
    font-size: 14px;
    color: #1f2733;
}
.fq-search:focus { outline: none; border-color: #2e6fd6; }
.fq-empty {
    background: #fff;
    border: 1px solid #e9edf2;
    border-radius: 12px;
    padding: 24px 20px;
    margin: 0 0 24px;
    text-align: center;
    color: #5b6472;
    font-size: 15px;
}
.fq-guides-link {
    display: inline-block;
    margin: 0 0 28px;
    color: #2e6fd6;
    font-weight: 600;
    font-size: 14px;
    text-decoration: none;
}
.fq-guides-link:hover { text-decoration: underline; }
.fq-section { margin-bottom: 28px; }
.fq-section-title {
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 12px;
}
.fq-item {
    background: #fff;
    border: 1px solid #e9edf2;
    border-radius: 12px;
    margin-bottom: 10px;
    overflow: hidden;
}
.fq-q {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 20px;
    font-weight: 600;
    font-size: 15px;
    cursor: pointer;
    list-style: none;
}
.fq-q::-webkit-details-marker { display: none; }
.fq-q:hover { color: #2e6fd6; }
.fq-chevron {
    color: #98a2b3;
    transition: transform 0.2s ease;
    flex-shrink: 0;
}
.fq-item[open] .fq-chevron { transform: rotate(180deg); }
.fq-a {
    padding: 0 20px 18px;
    line-height: 1.6;
    font-size: 15px;
    color: #3a4453;
}
.fq-a :deep(a) { color: #2e6fd6; }
.fq-a :deep(strong) { font-weight: 700; }

.fq-support {
    background: #fff;
    border: 1px solid #e9edf2;
    border-radius: 12px;
    padding: 24px 28px;
    margin-top: 8px;
}
.fq-support > p { color: #5b6472; margin: 0 0 12px; }
.fq-contacts {
    list-style: none;
    padding: 0;
    margin: 0 0 16px;
    line-height: 1.9;
    font-size: 15px;
}
.fq-contacts a { color: #2e6fd6; text-decoration: none; }
.fq-contacts a:hover { text-decoration: underline; }
.fq-links {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
    font-size: 14px;
    border-top: 1px solid #eef1f5;
    padding-top: 16px;
}
.fq-links a { color: #5b6472; text-decoration: none; }
.fq-links a:hover { color: #2e6fd6; text-decoration: underline; }

@media (max-width: 600px) {
    .fq-title { font-size: 24px; }
    .fq-support { padding: 20px 16px; }
    .fq-q { padding: 14px 16px; }
}
</style>
