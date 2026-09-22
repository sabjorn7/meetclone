<!--
  UchenikamPage.vue — public marketing subpage "Специалистам / Ученикам" (Phase 2 of the Tilda →
  self-host migration). Ports www.meetgu.ru/uchenikam into the platform pd-* design system.

  Content is the real Tilda copy (kinesiology profession intro, salary highlight, where kinesiology
  applies, who benefits from the training). "Студент/ученик" wording is shifted to "специалист" per
  the product direction. CONTENT-ONLY: AppHeader/AppFooter come from App.vue; #app already reserves
  the fixed-header space, so no own chrome / no top padding here.

  Rollout: lives at /uchenikam-demo for review first (demo-then-swap), like every other page here.
  Icons are inline Phosphor-style line SVGs (MIT), 1.6 stroke, attributes baked in so scoped CSS is
  not required to style v-html-injected SVGs.
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
                        Специалистам и тем, кто учится
                    </span>
                    <h1 class="pd-hero__title" data-reveal>
                        Все знания по оздоровлению
                        <span class="pd-hero__sub2">в одном месте</span>
                    </h1>
                    <p class="pd-hero__hook" data-reveal>
                        Мы создали все условия для комфортного обучения: лучшие курсы и семинары
                        ведущих экспертов России собраны на одной платформе. Самые новые и ценные
                        знания — всегда под рукой.
                    </p>
                    <div class="pd-hero__cta" data-reveal>
                        <button class="pd-btn pd-btn--lg" type="button" @click="go('/all_course')">
                            Начать учиться
                        </button>
                        <a class="pd-ghost" href="/registration" @click.prevent="go('/registration')">
                            Стать спикером
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                        </a>
                    </div>
                </div>

                <aside class="pd-hero__art" data-reveal>
                    <div class="pd-hero__art-panel">
                        <img class="pd-hero__img" src="/images/uchenikam-hero.png"
                             alt="Иллюстрация: ученики на обучении" width="4167" height="4167" />
                    </div>
                </aside>
            </div>
        </header>

        <!-- ── WHO IS A KINESIOLOGIST ─────────────────────────────── -->
        <section class="pd-section pd-explain">
            <div class="pd-wrap pd-explain__grid">
                <div class="pd-explain__art" data-reveal>
                    <img src="/images/d1c8bb20-3ab3-4373-a39b-cac71989beb2.png"
                         alt="Иллюстрация: тело и здоровье" width="700" height="990" loading="lazy" />
                </div>
                <div class="pd-explain__text" data-reveal>
                    <h2 class="pd-h2">Учитесь тому, что помогает людям</h2>
                    <p>
                        Мир всё больше ценит специалистов, которые помогают поддерживать здоровье
                        <b>целостно</b> — не просто снимать симптомы, а заботиться о теле,
                        самочувствии и качестве жизни. Это профессия, которая нужна всегда.
                    </p>
                    <p>
                        Начните с одного направления или соберите собственный набор методов — от
                        работы с телом до питания и восстановления. Учитесь у практиков, применяйте
                        знания к себе и близким, помогайте другим — и растите как специалист.
                    </p>
                    <p class="pd-explain__disclaimer">
                        <span><em>Специалист по оздоровлению — дополнение к наблюдению врача, а не
                        замена лечения; не ставит диагноз и не лечит заболевание.</em></span>
                    </p>
                </div>
            </div>
        </section>

        <!-- ── SALARY HIGHLIGHT ───────────────────────────────────── -->
        <section class="pd-salary-wrap">
            <div class="pd-wrap">
                <div class="pd-salary" data-reveal>
                    <div class="pd-salary__l">
                        <span class="pd-salary__label">Средняя зарплата специалиста</span>
                        <p class="pd-salary__amount">250 000&nbsp;<span class="cur">₽</span></p>
                        <p class="pd-salary__note">
                            У специалистов с опытом 3+ лет. У начинающих — от 50 000&nbsp;₽.
                        </p>
                    </div>
                    <p class="pd-salary__r">
                        Доход зависит от опыта и результатов: в частной практике он определяется
                        числом пациентов, которых ведёт специалист, — чем их больше, тем выше доход.
                    </p>
                </div>
            </div>
        </section>

        <!-- ── WHERE KINESIOLOGY APPLIES ──────────────────────────── -->
        <section class="pd-section">
            <div class="pd-wrap">
                <div class="pd-head" data-reveal>
                    <h2 class="pd-h2">Где пригодятся знания</h2>
                    <p class="pd-head__note">Подходы к оздоровлению применимы в самых разных сферах.</p>
                </div>
                <ul class="pd-apply">
                    <li v-for="(a, i) in applications" :key="i" class="pd-apply__item" data-reveal :style="{ '--i': i % 3 }">
                        <span class="pd-apply__ic" v-html="a.icon" aria-hidden="true"></span>
                        {{ a.title }}
                    </li>
                </ul>
            </div>
        </section>

        <!-- ── WHO BENEFITS ───────────────────────────────────────── -->
        <section class="pd-section pd-section--tint">
            <div class="pd-wrap">
                <div class="pd-head" data-reveal>
                    <h2 class="pd-h2">Кому будет полезно обучение</h2>
                    <p class="pd-head__note">
                        Хотите глубже понять, как устроен организм, помогать себе и близким или
                        применять это в практике — программа будет полезна.
                    </p>
                </div>
                <div class="pd-cards">
                    <article v-for="(c, i) in audience" :key="i" class="pd-card" data-reveal :style="{ '--i': i % 3 }">
                        <span class="pd-card__ic" v-html="c.icon" aria-hidden="true"></span>
                        <h3 class="pd-card__t">{{ c.title }}</h3>
                        <p class="pd-card__d">{{ c.text }}</p>
                    </article>
                </div>
            </div>
        </section>

        <!-- ── FINAL CTA ──────────────────────────────────────────── -->
        <section class="pd-cta-wrap">
            <div class="pd-wrap">
                <div class="pd-cta" data-reveal>
                    <div class="pd-cta__text">
                        <h2 class="pd-cta__h">Начните учиться уже сегодня</h2>
                        <p class="pd-cta__sub">Выбирайте курсы ведущих экспертов и растите как специалист оздоровления.</p>
                    </div>
                    <button class="pd-btn pd-btn--lg" type="button" @click="go('/all_course')">
                        Смотреть курсы
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

// Phosphor-style line icons (MIT), 1.6 stroke, attributes baked in (so v-html-injected SVGs render
// as line icons without relying on scoped CSS reaching them).
const I = (body) => `<svg viewBox="0 0 24 24" class="pd-ic" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const IC = {
    rehab: I('<path d="M3 12h4l2.5-7 4 15 2.5-8H21"/>'),
    pain: I('<path d="M12 20s-6-3.6-8.2-7.3C2.3 10.4 3 7.7 5.4 7c1.8-.5 3.4.5 4.1 1.9l.8 1.5.8-1.5C11.8 7.5 13.4 6.5 15.2 7c2.4.7 3.1 3.4 1.6 5.7C14.6 16.4 12 20 12 20z"/>'),
    shield: I('<path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>'),
    baby: I('<circle cx="12" cy="5.5" r="2"/><path d="M6 21c1-4 3.5-6 6-6s5 2 6 6M8.5 11.5c2 1.5 5 1.5 7 0"/>'),
    sport: I('<path d="M6.5 6.5l11 11M4 9l2-2M9 4l-2 2M15 20l2-2M20 15l-2 2M7.5 7.5L4.5 10.5M16.5 16.5l3-3"/>'),
    geriatrics: I('<circle cx="10" cy="4.5" r="2"/><path d="M10 7v8m0 0l-3 6m3-6l3 6M16 10v11M14 21h4"/>'),
    stethoscope: I('<path d="M6 3v5a5 5 0 0 0 10 0V3"/><path d="M6 3H4M16 3h2M11 18v-5"/><circle cx="18" cy="16" r="3"/><path d="M18 13v-2"/>'),
    cross: I('<rect x="4" y="7" width="16" height="12" rx="2"/><path d="M9 7V5h6v2M12 11v4M10 13h4"/>'),
    nutrition: I('<path d="M12 8c0-3 2-5 5-5 0 3-2 5-5 5zM12 8c-1.6 0-6 1-6 6 0 4 3 7 6 7s6-3 6-7c0-5-4.4-6-6-6z"/>'),
    tooth: I('<path d="M7 3c-2 0-3.5 1.6-3.5 4 0 2 .6 3 1 5.5.3 2 .3 6 1.8 6 1.3 0 1.2-3 2.2-3s.9 3 2.2 3c1.5 0 1.5-4 1.8-6 .4-2.5 1-3.5 1-5.5 0-2.4-1.5-4-3.5-4-1.4 0-1.8.8-3 .8S8.4 3 7 3z"/>'),
    hands: I('<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-1V4.5a1.5 1.5 0 0 1 3 0V11m0-.5V6a1.5 1.5 0 0 1 3 0v7a6 6 0 0 1-6 6h-1a5 5 0 0 1-4.3-2.5L4 13.5a1.6 1.6 0 0 1 2.6-1.8L8 13.5"/>'),
    dumbbell: I('<path d="M6.5 6.5v11M3.5 8.5v7M17.5 6.5v11M20.5 8.5v7M6.5 12h11"/>'),
};

const applications = [
    { icon: IC.rehab, title: 'Реабилитация и физиотерапия' },
    { icon: IC.pain, title: 'Работа с хронической болью' },
    { icon: IC.shield, title: 'Профилактика и общее оздоровление' },
    { icon: IC.baby, title: 'Педиатрия' },
    { icon: IC.sport, title: 'Спорт и фитнес' },
    { icon: IC.geriatrics, title: 'Гериатрия' },
];

const audience = [
    { icon: IC.stethoscope, title: 'Врачи', text: 'Начните смотреть на человека целостно — перейдите от симптоматического лечения к холистическому подходу.' },
    { icon: IC.cross, title: 'Фельдшеры и медсёстры', text: 'Расширьте компетенции и начните заниматься лечебной и докторской деятельностью.' },
    { icon: IC.nutrition, title: 'Нутрициологи и диетологи', text: 'Посмотрите на здоровье с новых сторон, помимо своей основной практики.' },
    { icon: IC.tooth, title: 'Стоматологи', text: 'Узнайте, как состояние полости рта связано с осанкой, эмоциями и нервной системой человека.' },
    { icon: IC.hands, title: 'Телесные практики', text: 'Проводите не только профилактические, но и лечебные мероприятия. Снизьте риск осложнений в работе с пациентом.' },
    { icon: IC.dumbbell, title: 'Спортивные тренеры', text: 'Стройте план тренировок с точки зрения здоровья и грамотно работайте с отстающими группами мышц.' },
];

function go(path) { router.push(path); }
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
.pd-head { margin-bottom: 34px; max-width: 720px; }
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
.pd-blob--2 { width: 320px; height: 320px; top: 120px; right: 220px; background: radial-gradient(circle at 40% 40%, rgba(240, 145, 87, 0.22), transparent 70%); border-radius: 58% 42% 45% 55% / 52% 55% 45% 48%; animation: pd-blob2 30s ease-in-out infinite; }
@keyframes pd-blob1 { 0%,100% { transform: translate(0,0) rotate(0deg) scale(1); border-radius: 42% 58% 63% 37% / 45% 42% 58% 55%; } 33% { transform: translate(-24px,20px) rotate(9deg) scale(1.05); border-radius: 60% 40% 42% 58% / 54% 58% 42% 46%; } 66% { transform: translate(16px,-14px) rotate(-6deg) scale(0.97); border-radius: 40% 60% 56% 44% / 46% 40% 60% 54%; } }
@keyframes pd-blob2 { 0%,100% { transform: translate(0,0) rotate(0deg) scale(1); } 50% { transform: translate(22px,16px) rotate(-10deg) scale(1.07); } }
@media (prefers-reduced-motion: reduce) { .pd-blob { animation: none; } }

.pd-hero__grid { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(0, 1.12fr) minmax(340px, 0.88fr); gap: 48px; align-items: center; }
.pd-hero__lead { position: relative; z-index: 1; }
.pd-badge { display: inline-flex; align-items: center; gap: 9px; padding: 8px 16px; border-radius: var(--r-pill); background: var(--blue-tint); color: var(--blue-ink); font-weight: 600; font-size: 14px; }
.pd-badge__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--orange); box-shadow: 0 0 0 4px rgba(240, 145, 87, 0.22); }
.pd-hero__title { margin: 22px 0 0; font-weight: 700; font-size: clamp(2.2rem, 5.4vw, 4rem); line-height: 1.02; letter-spacing: -0.025em; }
.pd-hero__sub2 { display: block; margin-top: 10px; font-weight: 500; font-size: clamp(1.1rem, 2.2vw, 1.7rem); color: var(--ink-2); }
.pd-hero__hook { margin: 24px 0 30px; max-width: 60ch; font-size: 1.14rem; color: var(--ink-2); }
.pd-hero__cta { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }
.pd-hero__art { display: flex; justify-content: center; }
.pd-hero__art-panel { position: relative; width: 100%; max-width: 500px; aspect-ratio: 1 / 1; display: grid; place-items: center; animation: pd-hero-float 7s ease-in-out infinite; }
.pd-hero__img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 14px 26px rgba(9, 23, 71, 0.14)); }
@keyframes pd-hero-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
@media (prefers-reduced-motion: reduce) { .pd-hero__art-panel { animation: none; } }

/* ── Explain ────────────────────────────────────────────────────────────── */
.pd-explain__grid { display: grid; grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr); gap: 56px; align-items: center; }
.pd-explain__art { display: flex; justify-content: center; }
.pd-explain__art img { width: 100%; max-width: 320px; height: auto; filter: drop-shadow(0 16px 30px rgba(9, 23, 71, 0.12)); }
.pd-explain__text p { margin: 0 0 16px; font-size: 1.1rem; color: var(--ink-2); max-width: 60ch; }
.pd-explain__text p b { color: var(--ink); font-weight: 700; }
.pd-explain__disclaimer span { color: rgba(85, 85, 85, 0.9); }
.pd-explain__disclaimer em { font-size: 0.98rem; }

/* ── Salary highlight ───────────────────────────────────────────────────── */
.pd-salary-wrap { padding: 20px 0; }
.pd-salary { display: grid; grid-template-columns: 0.9fr 1.1fr; gap: 40px; align-items: center; background: var(--ink); color: #fff; border-radius: var(--r-lg); padding: 48px 52px; box-shadow: var(--shadow); }
.pd-salary__label { font-weight: 500; font-size: 0.95rem; color: rgba(255, 255, 255, 0.7); }
.pd-salary__amount { margin: 8px 0 10px; font-weight: 700; font-size: clamp(2.8rem, 6vw, 4.4rem); line-height: 0.95; letter-spacing: -0.03em; }
.pd-salary__amount .cur { color: var(--orange); }
.pd-salary__note { margin: 0; color: rgba(255, 255, 255, 0.82); font-weight: 500; }
.pd-salary__r { margin: 0; color: rgba(255, 255, 255, 0.72); font-size: 1.05rem; }

/* ── Applications ───────────────────────────────────────────────────────── */
.pd-apply { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.pd-apply__item { display: flex; align-items: center; gap: 16px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); padding: 20px 22px; font-weight: 600; font-size: 1.06rem; letter-spacing: -0.01em; transition: transform 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .pd-apply__item:hover { transform: translateY(-3px); box-shadow: var(--shadow-sm); } }
.pd-apply__ic { display: grid; place-items: center; width: 46px; height: 46px; flex: none; border-radius: 12px; background: var(--blue-tint); color: var(--blue-ink); }
.pd-apply__ic :deep(.pd-ic) { width: 24px; height: 24px; }

/* ── Cards (who benefits) ───────────────────────────────────────────────── */
.pd-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
.pd-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 30px 26px 28px; transition: transform 0.24s var(--ease-out), box-shadow 0.24s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .pd-card:hover { transform: translateY(-5px); box-shadow: var(--shadow); } }
.pd-card__ic { display: grid; place-items: center; width: 54px; height: 54px; border-radius: var(--r-md); background: var(--blue-tint); color: var(--blue-ink); margin-bottom: 20px; }
.pd-card__ic :deep(.pd-ic) { width: 28px; height: 28px; }
.pd-card__t { margin: 0 0 10px; font-weight: 700; font-size: 1.16rem; line-height: 1.2; letter-spacing: -0.01em; }
.pd-card__d { margin: 0; color: var(--ink-2); font-size: 0.98rem; }

/* ── Final CTA ──────────────────────────────────────────────────────────── */
.pd-cta-wrap { padding: 20px 0 96px; }
.pd-cta { display: flex; align-items: center; justify-content: space-between; gap: 32px; flex-wrap: wrap; background: var(--blue); color: #fff; border-radius: var(--r-lg); padding: 44px 52px; box-shadow: var(--shadow); }
.pd-cta__h { margin: 0 0 8px; font-weight: 700; font-size: clamp(1.6rem, 3.2vw, 2.4rem); letter-spacing: -0.02em; }
.pd-cta__sub { margin: 0; color: rgba(255, 255, 255, 0.85); max-width: 52ch; }
.pd-cta .pd-btn { background: #fff; color: var(--blue); flex: none; }
@media (hover: hover) and (pointer: fine) { .pd-cta .pd-btn:hover { background: #eef4ff; } }

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 1080px) {
    .pd-apply { grid-template-columns: repeat(2, 1fr); }
    .pd-cards { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 900px) {
    .pd-wrap { padding-inline: 22px; }
    .pd-section { padding: 58px 0; }
    .pd-hero { padding: 52px 0 52px; }
    .pd-hero__grid { grid-template-columns: 1fr; gap: 28px; }
    .pd-hero__art { order: -1; }
    .pd-hero__art-panel { max-width: 360px; }
    .pd-explain__grid { grid-template-columns: 1fr; gap: 30px; }
    .pd-explain__art { max-width: 240px; margin-inline: auto; }
    .pd-salary { grid-template-columns: 1fr; gap: 20px; padding: 34px 28px; }
    .pd-cta { padding: 32px 28px; }
}
@media (max-width: 560px) {
    .pd-apply { grid-template-columns: 1fr; }
    .pd-cards { grid-template-columns: 1fr; }
    .pd-hero__cta .pd-btn { width: 100%; }
}
</style>
