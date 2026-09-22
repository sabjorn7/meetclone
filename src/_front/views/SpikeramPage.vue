<!--
  SpikeramPage.vue — public marketing subpage "Спикерам" (Phase 3 of the Tilda → self-host
  migration). Ports www.meetgu.ru/spikeram into the platform pd-* design system.

  Content is the real Tilda copy (become a speaker, earnings/withdrawal, free service, the 3-step
  quick start: register → fill profile → upload course). Framed toward general "оздоровление" rather
  than kinesiology, per the product direction. The Tilda step screenshots are not ported yet — the
  quick-start is a clean numbered stepper (screenshots can be dropped in later).

  CONTENT-ONLY: AppHeader/AppFooter come from App.vue; #app already reserves the fixed-header space.
  Rollout: /spikeram-demo first (demo-then-swap). Icons are inline Phosphor-style line SVGs (MIT),
  attributes baked in so v-html-injected SVGs render without relying on scoped CSS.
-->
<template>
    <main class="pd" ref="rootEl">
        <!-- ── HERO ───────────────────────────────────────────────── -->
        <header class="pd-hero">
            <div class="pd-blobs" aria-hidden="true">
                <span class="pd-blob pd-blob--1"></span>
                <span class="pd-blob pd-blob--2"></span>
            </div>
            <div class="pd-wrap pd-hero__grid">
                <div class="pd-hero__lead">
                    <span class="pd-badge" data-reveal>
                        <span class="pd-badge__dot" aria-hidden="true"></span>
                        Спикерам и учебным заведениям
                    </span>
                    <h1 class="pd-hero__title" data-reveal>
                        Делитесь знаниями —
                        <span class="pd-hero__sub2">и зарабатывайте на них</span>
                    </h1>
                    <p class="pd-hero__hook" data-reveal>
                        Станьте частью платформы для образования в сфере оздоровления. Публикуйте
                        свои курсы, находите учеников по всей России и получайте доход — без вложений
                        и абонентской платы.
                    </p>
                    <div class="pd-hero__cta" data-reveal>
                        <button class="pd-btn pd-btn--lg" type="button" @click="go('/registration')">
                            Стать спикером
                        </button>
                        <a class="pd-ghost" href="#start" @click.prevent="scrollTo('start')">
                            Быстрый старт
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>
                        </a>
                    </div>
                </div>

                <!-- Earnings dashboard mockup (echoes the seller finance page) -->
                <aside class="pd-hero__art" data-reveal>
                    <div class="pd-dash">
                        <div class="pd-dash__head">
                            <span class="pd-dash__title">Ваш кабинет</span>
                            <span class="pd-dash__live"><span class="pd-dash__dot" aria-hidden="true"></span> онлайн</span>
                        </div>
                        <div class="pd-dash__stats">
                            <div class="pd-dash__stat">
                                <span class="pd-dash__l">Продаж</span>
                                <span class="pd-dash__n">124</span>
                            </div>
                            <div class="pd-dash__stat pd-dash__stat--accent">
                                <span class="pd-dash__l">На вывод</span>
                                <span class="pd-dash__n">148&nbsp;500&nbsp;<span class="cur">₽</span></span>
                            </div>
                        </div>
                        <div class="pd-dash__chart" aria-hidden="true">
                            <span v-for="(h, i) in bars" :key="i" class="pd-dash__bar" :style="{ height: h + '%' }"></span>
                        </div>
                        <button class="pd-dash__btn" type="button" @click="go('/registration')">Вывести средства</button>
                    </div>
                </aside>
            </div>
        </header>

        <!-- ── BENEFITS ───────────────────────────────────────────── -->
        <section class="pd-section">
            <div class="pd-wrap">
                <div class="pd-cards pd-cards--3">
                    <article v-for="(b, i) in benefits" :key="i" class="pd-card" data-reveal :style="{ '--i': i }">
                        <span class="pd-card__ic" v-html="b.icon" aria-hidden="true"></span>
                        <h3 class="pd-card__t">{{ b.title }}</h3>
                        <p class="pd-card__d">{{ b.text }}</p>
                    </article>
                </div>
            </div>
        </section>

        <!-- ── QUICK START (3 steps) ──────────────────────────────── -->
        <section id="start" class="pd-section pd-section--tint">
            <div class="pd-wrap">
                <div class="pd-head" data-reveal>
                    <h2 class="pd-h2">Быстрый старт</h2>
                    <p class="pd-head__note">Три шага от регистрации до первого курса на платформе.</p>
                </div>
                <ol class="pd-steps">
                    <li v-for="(s, i) in steps" :key="i" class="pd-step" data-reveal>
                        <span class="pd-step__num" aria-hidden="true">{{ i + 1 }}</span>
                        <div class="pd-step__body">
                            <h3 class="pd-step__t">{{ s.title }}</h3>
                            <p class="pd-step__d">{{ s.text }}</p>
                            <ul v-if="s.points" class="pd-step__points">
                                <li v-for="(p, j) in s.points" :key="j">{{ p }}</li>
                            </ul>
                        </div>
                    </li>
                </ol>
            </div>
        </section>

        <!-- ── FINAL CTA ──────────────────────────────────────────── -->
        <section class="pd-cta-wrap">
            <div class="pd-wrap">
                <div class="pd-cta" data-reveal>
                    <div class="pd-cta__text">
                        <h2 class="pd-cta__h">Опубликуйте свой первый курс</h2>
                        <p class="pd-cta__sub">Регистрация бесплатна — вы не платите ничего, пока не начнёте зарабатывать.</p>
                    </div>
                    <button class="pd-btn pd-btn--lg" type="button" @click="go('/registration')">
                        Стать спикером
                    </button>
                </div>
            </div>
        </section>
    </main>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const rootEl = ref(null);

const bars = [38, 52, 46, 64, 58, 76, 70];

const I = (body) => `<svg viewBox="0 0 24 24" class="pd-ic" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const benefits = [
    { icon: I('<path d="M13 2L4.5 13H11l-1 9 8.5-11H12z"/>'), title: 'Быстрая регистрация', text: 'Не тратьте время на формальности — займитесь любимым делом. Регистрация занимает пару минут.' },
    { icon: I('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/>'), title: 'Вывод средств', text: 'Выводите деньги на любое юрлицо: самозанятый, ИП или ООО. Удобно и прозрачно.' },
    { icon: I('<path d="M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-7M2 7h20v5H2zM12 7v13M12 7S9.5 3 7.5 4.2 8 7 12 7zM12 7s2.5-4 4.5-2.8S16 7 12 7z"/>'), title: 'Сервис бесплатный', text: 'Без абонентской платы и скрытых платежей — вы не тратите ничего, пока не начнёте зарабатывать.' },
];

const steps = [
    {
        title: 'Зарегистрируйтесь на платформе',
        text: 'Удобнее всего сделать это с компьютера, но и с телефона тоже получится. Регистрация доступна по любой рабочей почте или через аккаунт «ВКонтакте».',
    },
    {
        title: 'Заполните профиль',
        text: 'На указанную почту будут приходить уведомления о продажах ваших материалов. Пара важных моментов при заполнении:',
        points: [
            'При регистрации выберите роль «Спикер».',
            'Укажите ваше имя или название учебного заведения.',
            'Заполните информацию о себе — она будет видна на странице вашего профиля.',
        ],
    },
    {
        title: 'Загрузите курс',
        text: 'Соберите курс по шагам — платформа проведёт по всем полям:',
        points: [
            'Название, описание, целевая аудитория и ожидаемые результаты обучения.',
            'Стоимость курса, срок доступа и цена продления.',
            'Видеотизер — он повышает интерес и конверсию (рекомендуем).',
            'Уроки: к каждому прикрепите материалы и загрузите видео.',
            'Отправьте курс на модерацию — и готово!',
        ],
    },
];

function go(path) { router.push(path); }
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function scrollTo(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'start' });
}

let io = null;
onMounted(() => {
    ensureFonts();
    const revealEls = rootEl.value?.querySelectorAll('[data-reveal]') || [];
    if (reduce() || !('IntersectionObserver' in window)) {
        revealEls.forEach((el) => el.classList.add('is-in'));
    } else {
        io = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
        revealEls.forEach((el) => io.observe(el));
    }
});
onBeforeUnmount(() => { io?.disconnect(); });

function ensureFonts() {
    if (document.getElementById('pd-fonts')) return;
    const l = document.createElement('link');
    l.id = 'pd-fonts';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
</script>

<style scoped>
/* ── Tokens: MeetGuru brand (shared pd-* foundation) ─────────────────────── */
.pd {
    --bg: #ffffff;
    --bg-tint: #f1f6fd;
    --surface: #ffffff;
    --ink: #091747;
    --ink-2: #5b6472;
    --ink-3: #98a0ad;
    --line: #e4e9f1;
    --blue: #2e70dd;
    --blue-soft: #5495f3;
    --blue-strong: #2360c6;
    --blue-ink: #1f5fc9;
    --blue-tint: #eaf1fe;
    --orange: #f09157;
    --orange-ink: #c2410c;
    --btn-ink: #ffffff;
    --r-lg: 26px;
    --r-md: 16px;
    --r-pill: 999px;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --shadow: 0 14px 40px -20px rgba(9, 23, 71, 0.24);
    --shadow-sm: 0 4px 16px -8px rgba(9, 23, 71, 0.18);
    --wrap: 1200px;
    background: var(--bg);
    color: var(--ink);
    font-family: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 17px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
    scroll-padding-top: 76px;
}
.pd *, .pd *::before, .pd *::after { box-sizing: border-box; }

.pd-wrap { width: 100%; max-width: var(--wrap); margin-inline: auto; padding-inline: 40px; }
.pd-section { padding: 84px 0; }
.pd-section--tint { background: var(--bg-tint); }
.pd-ic { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; display: block; }
.pd-h2 { margin: 0 0 12px; font-weight: 700; font-size: clamp(1.9rem, 4vw, 3rem); line-height: 1.06; letter-spacing: -0.02em; }
.pd-head { margin-bottom: 40px; max-width: 720px; }
.pd-head__note { margin: 0; color: var(--ink-2); }

[data-reveal] { opacity: 0; transform: translateY(20px); transition: opacity 0.6s var(--ease-out), transform 0.6s var(--ease-out); transition-delay: calc(var(--i, 0) * 60ms); }
[data-reveal].is-in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { [data-reveal] { opacity: 1; transform: none; transition: none; } }

.pd-btn { font-family: inherit; font-weight: 600; font-size: 16px; color: var(--btn-ink); background: var(--blue); border: none; border-radius: var(--r-pill); padding: 15px 28px; cursor: pointer; transition: transform 0.16s var(--ease-out), background 0.16s var(--ease-out), box-shadow 0.16s var(--ease-out); box-shadow: 0 10px 26px -12px rgba(46, 112, 221, 0.7); }
.pd-btn:active { transform: translateY(1px); }
.pd-btn:focus-visible { outline: 2px solid var(--blue-ink); outline-offset: 3px; }
@media (hover: hover) and (pointer: fine) { .pd-btn:hover { background: var(--blue-strong); transform: translateY(-2px); box-shadow: 0 16px 32px -14px rgba(46, 112, 221, 0.8); } }
.pd-btn--lg { padding: 18px 34px; font-size: 17px; }

.pd-ghost { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 16px; color: var(--ink); text-decoration: none; padding: 8px 4px; transition: gap 0.18s var(--ease-out), color 0.18s var(--ease-out); cursor: pointer; }
.pd-ghost .pd-ic { width: 20px; height: 20px; }
@media (hover: hover) and (pointer: fine) { .pd-ghost:hover { color: var(--blue-ink); gap: 12px; } }

/* ── Hero ───────────────────────────────────────────────────────────────── */
.pd-hero { position: relative; padding: 76px 0 72px; overflow: hidden; }
.pd-blobs { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
.pd-blob { position: absolute; filter: blur(6px); will-change: transform; }
.pd-blob--1 { width: 520px; height: 520px; top: -160px; right: -120px; background: radial-gradient(circle at 36% 34%, rgba(84, 149, 243, 0.36), transparent 70%); border-radius: 42% 58% 63% 37% / 45% 42% 58% 55%; animation: pd-blob1 24s ease-in-out infinite; }
.pd-blob--2 { width: 320px; height: 320px; top: 140px; right: 240px; background: radial-gradient(circle at 40% 40%, rgba(240, 145, 87, 0.2), transparent 70%); border-radius: 58% 42% 45% 55% / 52% 55% 45% 48%; animation: pd-blob2 30s ease-in-out infinite; }
@keyframes pd-blob1 { 0%,100% { transform: translate(0,0) rotate(0deg) scale(1); border-radius: 42% 58% 63% 37% / 45% 42% 58% 55%; } 33% { transform: translate(-24px,20px) rotate(9deg) scale(1.05); border-radius: 60% 40% 42% 58% / 54% 58% 42% 46%; } 66% { transform: translate(16px,-14px) rotate(-6deg) scale(0.97); border-radius: 40% 60% 56% 44% / 46% 40% 60% 54%; } }
@keyframes pd-blob2 { 0%,100% { transform: translate(0,0) rotate(0deg) scale(1); } 50% { transform: translate(22px,16px) rotate(-10deg) scale(1.07); } }
@media (prefers-reduced-motion: reduce) { .pd-blob { animation: none; } }

.pd-hero__grid { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(340px, 0.9fr); gap: 52px; align-items: center; }
.pd-hero__lead { position: relative; z-index: 1; }
.pd-badge { display: inline-flex; align-items: center; gap: 9px; padding: 8px 16px; border-radius: var(--r-pill); background: var(--blue-tint); color: var(--blue-ink); font-weight: 600; font-size: 14px; }
.pd-badge__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--orange); box-shadow: 0 0 0 4px rgba(240, 145, 87, 0.22); }
.pd-hero__title { margin: 22px 0 0; font-weight: 700; font-size: clamp(2.2rem, 5.4vw, 4rem); line-height: 1.02; letter-spacing: -0.025em; }
.pd-hero__sub2 { display: block; margin-top: 10px; font-weight: 500; font-size: clamp(1.1rem, 2.2vw, 1.7rem); color: var(--ink-2); }
.pd-hero__hook { margin: 24px 0 30px; max-width: 52ch; font-size: 1.14rem; color: var(--ink-2); }
.pd-hero__cta { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }
.pd-hero__art { display: flex; justify-content: center; }

/* ── Earnings dashboard mockup ──────────────────────────────────────────── */
.pd-dash { width: 100%; max-width: 420px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 26px 26px 24px; box-shadow: var(--shadow); animation: pd-hero-float 7s ease-in-out infinite; }
@keyframes pd-hero-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
@media (prefers-reduced-motion: reduce) { .pd-dash { animation: none; } }
.pd-dash__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.pd-dash__title { font-weight: 700; font-size: 1.05rem; }
.pd-dash__live { display: inline-flex; align-items: center; gap: 7px; font-size: 0.82rem; font-weight: 600; color: var(--ink-3); }
.pd-dash__dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.16); }
.pd-dash__stats { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }
.pd-dash__stat { background: var(--blue-tint); border-radius: var(--r-md); padding: 16px 18px; }
.pd-dash__stat--accent { background: var(--ink); }
.pd-dash__l { display: block; font-size: 0.82rem; font-weight: 500; color: var(--ink-3); margin-bottom: 6px; }
.pd-dash__stat--accent .pd-dash__l { color: rgba(255, 255, 255, 0.6); }
.pd-dash__n { display: block; font-weight: 700; font-size: 1.7rem; letter-spacing: -0.02em; color: var(--ink); font-variant-numeric: tabular-nums; }
.pd-dash__stat--accent .pd-dash__n { color: #fff; }
.pd-dash__stat--accent .cur { color: var(--orange); }
.pd-dash__chart { display: flex; align-items: flex-end; gap: 8px; height: 68px; margin-bottom: 20px; padding: 0 2px; }
.pd-dash__bar { flex: 1; border-radius: 5px 5px 0 0; background: linear-gradient(var(--blue-soft), var(--blue)); }
.pd-dash__btn { width: 100%; font-family: inherit; font-weight: 600; font-size: 15px; color: #fff; background: var(--blue); border: none; border-radius: var(--r-pill); padding: 13px; cursor: pointer; transition: background 0.16s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .pd-dash__btn:hover { background: var(--blue-strong); } }

/* ── Cards (benefits) ───────────────────────────────────────────────────── */
.pd-cards { display: grid; gap: 22px; }
.pd-cards--3 { grid-template-columns: repeat(3, 1fr); }
.pd-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 32px 28px 30px; transition: transform 0.24s var(--ease-out), box-shadow 0.24s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .pd-card:hover { transform: translateY(-5px); box-shadow: var(--shadow); } }
.pd-card__ic { display: grid; place-items: center; width: 56px; height: 56px; border-radius: var(--r-md); background: var(--blue-tint); color: var(--blue-ink); margin-bottom: 22px; }
.pd-card__ic :deep(.pd-ic) { width: 30px; height: 30px; }
.pd-card__t { margin: 0 0 10px; font-weight: 700; font-size: 1.2rem; line-height: 1.2; letter-spacing: -0.01em; }
.pd-card__d { margin: 0; color: var(--ink-2); font-size: 1rem; }

/* ── Quick-start steps ──────────────────────────────────────────────────── */
.pd-steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 18px; counter-reset: step; }
.pd-step { display: grid; grid-template-columns: 64px 1fr; gap: 24px; align-items: start; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 30px 32px; }
.pd-step__num { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 50%; background: var(--blue); color: #fff; font-weight: 700; font-size: 1.5rem; letter-spacing: -0.02em; }
.pd-step__t { margin: 4px 0 8px; font-weight: 700; font-size: 1.3rem; letter-spacing: -0.01em; }
.pd-step__d { margin: 0; color: var(--ink-2); max-width: 68ch; }
.pd-step__points { margin: 14px 0 0; padding: 0; list-style: none; display: grid; gap: 10px; }
.pd-step__points li { position: relative; padding-left: 26px; color: var(--ink-2); }
.pd-step__points li::before { content: ''; position: absolute; left: 0; top: 0.55em; width: 12px; height: 2px; border-radius: 2px; background: var(--blue-soft); }

/* ── Final CTA ──────────────────────────────────────────────────────────── */
.pd-cta-wrap { padding: 84px 0 96px; }
.pd-cta { display: flex; align-items: center; justify-content: space-between; gap: 32px; flex-wrap: wrap; background: var(--blue); color: #fff; border-radius: var(--r-lg); padding: 44px 52px; box-shadow: var(--shadow); }
.pd-cta__h { margin: 0 0 8px; font-weight: 700; font-size: clamp(1.6rem, 3.2vw, 2.4rem); letter-spacing: -0.02em; }
.pd-cta__sub { margin: 0; color: rgba(255, 255, 255, 0.85); max-width: 52ch; }
.pd-cta .pd-btn { background: #fff; color: var(--blue); flex: none; }
@media (hover: hover) and (pointer: fine) { .pd-cta .pd-btn:hover { background: #eef4ff; } }

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 1080px) {
    .pd-cards--3 { grid-template-columns: 1fr; }
}
@media (max-width: 900px) {
    .pd-wrap { padding-inline: 22px; }
    .pd-section { padding: 58px 0; }
    .pd-hero { padding: 52px 0 52px; }
    .pd-hero__grid { grid-template-columns: 1fr; gap: 34px; }
    .pd-cta-wrap { padding: 58px 0 72px; }
    .pd-cta { padding: 32px 28px; }
    .pd-step { grid-template-columns: 1fr; gap: 14px; padding: 26px 24px; }
    .pd-step__num { width: 48px; height: 48px; font-size: 1.3rem; }
}
@media (max-width: 560px) {
    .pd-hero__cta .pd-btn { width: 100%; }
    .pd-dash { max-width: 100%; }
}
</style>
