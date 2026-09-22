<!--
  LandingPage.vue — public marketing landing (Phase 1 of the Tilda → self-host migration).

  Replaces the Tilda www.meetgu.ru home. Content is the real Tilda copy (hero "Стань спикером",
  Студент/Спикер/Учебное заведение tabs, stats, "Как это работает" Kinescope demo, 6 advantages,
  "Остались вопросы?" contact form) reimagined in the platform's pd-* design system for visual
  consistency with the rest of app.meetgu.ru (same tokens/blob/reveal vocabulary as PromoDemoPage).

  CONTENT-ONLY: AppHeader / AppFooter are rendered globally by App.vue, and #app already reserves
  62px for the fixed header (html.mg-newchrome), so this page adds NEITHER its own chrome NOR a
  top padding — doing so would double them.

  Rollout: lives at /landing-demo for review first (same demo-then-soft-swap pattern as every other
  page here). The guest "/" swap (App.vue redirect) and the contact-form n8n webhook are the ship
  step, done after design sign-off. On this demo route the form shows a local success state only —
  it does NOT yet send anywhere (flagged in submitForm()).

  Video "Как это работает" stays a Kinescope embed for now; migration to self-hosted PeerTube is
  Phase 5. Icons are inline Phosphor-style line SVGs (MIT), single 1.6 stroke.
-->
<template>
    <main class="pd" ref="rootEl">
        <!-- ── HERO ───────────────────────────────────────────────── -->
        <header class="pd-hero">
            <!-- Ambient morphing shapes (brand palette). CSS-animated (off main thread);
                 static under prefers-reduced-motion. Purely decorative. -->
            <div class="pd-blobs" aria-hidden="true">
                <span class="pd-blob pd-blob--1"></span>
                <span class="pd-blob pd-blob--2"></span>
                <span class="pd-blob pd-blob--3"></span>
            </div>
            <div class="pd-wrap pd-hero__grid">
                <div class="pd-hero__lead">
                    <span class="pd-badge" data-reveal>
                        <span class="pd-badge__dot" aria-hidden="true"></span>
                        Учитесь · практикуйте · находите клиентов
                    </span>
                    <h1 class="pd-hero__title" data-reveal>
                        Сообщество экспертов
                        <span class="pd-hero__sub2">в сфере оздоровления</span>
                    </h1>
                    <p class="pd-hero__hook" data-reveal>
                        МитГуру объединяет специалистов оздоровления — кинезиологов, остеопатов,
                        массажистов. Учитесь у практиков, ведите собственные курсы и находите новых
                        клиентов через каталог сообщества.
                    </p>
                    <div class="pd-hero__cta" data-reveal>
                        <button class="pd-btn pd-btn--lg" type="button" @click="go('/registration')">
                            Стать спикером
                        </button>
                        <a class="pd-ghost" href="/all_course" @click.prevent="go('/all_course')">
                            Вступить в сообщество
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                        </a>
                    </div>
                </div>

                <aside class="pd-hero__art" data-reveal>
                    <div class="pd-hero__art-panel">
                        <img class="pd-hero__img" src="/images/landing-hero.png"
                             alt="Иллюстрация: эксперт оздоровления" width="2481" height="3509" />
                    </div>
                </aside>
            </div>
        </header>

        <!-- ── AUDIENCE TABS (Студент / Спикер / Учебное заведение) ── -->
        <section class="pd-section pd-audience">
            <div class="pd-wrap">
                <div class="pd-head" data-reveal>
                    <h2 class="pd-h2">Присоединяйся к сообществу</h2>
                    <p class="pd-head__note">Платформа работает для всех сторон обучения — выберите свою роль.</p>
                </div>
                <div class="pd-tabs" data-reveal>
                    <div class="pd-tabs__row" role="tablist" aria-label="Роли на платформе">
                        <button
                            v-for="(t, i) in tabs"
                            :key="t.key"
                            class="pd-tab"
                            :class="{ 'is-active': activeTab === i }"
                            type="button"
                            role="tab"
                            :aria-selected="activeTab === i ? 'true' : 'false'"
                            @click="activeTab = i"
                        >
                            <span class="pd-tab__ic" v-html="t.icon" aria-hidden="true"></span>
                            {{ t.label }}
                        </button>
                    </div>
                    <div class="pd-tabs__panel" role="tabpanel">
                        <p class="pd-tabs__text">{{ tabs[activeTab].text }}</p>
                        <a class="pd-ghost" :href="tabs[activeTab].href" @click.prevent="go(tabs[activeTab].href)">
                            {{ tabs[activeTab].cta }}
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                        </a>
                    </div>
                </div>
            </div>
        </section>

        <!-- ── HOW IT WORKS (Kinescope demo) ──────────────────────── -->
        <section class="pd-section pd-section--tint">
            <div class="pd-wrap">
                <div class="pd-head pd-head--center" data-reveal>
                    <h2 class="pd-h2">Как это работает?</h2>
                    <p class="pd-head__note">Посмотрите короткое видео, чтобы понять, как устроена платформа.</p>
                </div>
                <div class="pd-video" data-reveal>
                    <video
                        ref="videoEl"
                        class="pd-video__el"
                        src="/video/how-it-works.mp4"
                        poster="/images/community-network.jpg"
                        playsinline
                        preload="metadata"
                        :controls="videoStarted"
                    ></video>
                    <button
                        v-if="!videoStarted"
                        class="pd-video__cover"
                        type="button"
                        aria-label="Смотреть видео — как работает платформа"
                        @click="playVideo"
                    >
                        <span class="pd-video__play" aria-hidden="true">
                            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        </span>
                    </button>
                </div>
            </div>
        </section>

        <!-- ── ADVANTAGES (6 cards) ───────────────────────────────── -->
        <section class="pd-section">
            <div class="pd-wrap">
                <div class="pd-head" data-reveal>
                    <h2 class="pd-h2">Преимущества</h2>
                    <p class="pd-head__note">Почему специалисты выбирают МитГуру.</p>
                </div>
                <div class="pd-cards">
                    <article
                        v-for="(a, i) in advantages"
                        :key="i"
                        class="pd-card"
                        data-reveal
                        :style="{ '--i': i % 3 }"
                    >
                        <span class="pd-card__ic" v-html="a.icon" aria-hidden="true"></span>
                        <h3 class="pd-card__t">{{ a.title }}</h3>
                        <p class="pd-card__d">{{ a.text }}</p>
                    </article>
                </div>
            </div>
        </section>

        <!-- ── CONTACT FORM ("Остались вопросы?") ─────────────────── -->
        <section id="contact" class="pd-contact-wrap">
            <div class="pd-wrap">
                <div class="pd-contact" data-reveal>
                    <div class="pd-contact__l">
                        <h2 class="pd-contact__h">Остались вопросы?</h2>
                        <p class="pd-contact__sub">Оставьте свой контакт — и мы с вами свяжемся.</p>
                        <ul class="pd-contact__meta">
                            <li>
                                <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M4 5h16v14H4z"/><path d="M4 7l8 6 8-6"/></svg>
                                adv@meetgu.ru
                            </li>
                            <li>
                                <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L16 18l5 2v-4"/></svg>
                                +7 495 50 50 192
                            </li>
                        </ul>
                    </div>
                    <div class="pd-contact__card">
                        <form v-if="!sent" class="pd-form" @submit.prevent="submitForm" novalidate>
                            <label class="pd-field">
                                <span class="pd-field__l">Как вас зовут</span>
                                <input v-model.trim="form.name" type="text" name="name" autocomplete="name"
                                       placeholder="Имя" required />
                            </label>
                            <label class="pd-field">
                                <span class="pd-field__l">Телефон для связи</span>
                                <input v-model.trim="form.phone" type="tel" name="phone" autocomplete="tel"
                                       placeholder="+7 ___ ___ __ __" required />
                            </label>
                            <p v-if="error" class="pd-form__err">{{ error }}</p>
                            <button class="pd-btn pd-btn--lg pd-btn--block" type="submit" :disabled="busy">
                                {{ busy ? 'Отправляем…' : 'Отправить' }}
                            </button>
                            <p class="pd-form__note">Нажимая «Отправить», вы соглашаетесь с
                                <a href="/politica" @click.prevent="go('/politica')">политикой обработки данных</a>.
                            </p>
                        </form>
                        <div v-else class="pd-form__ok" role="status">
                            <span class="pd-form__ok-ic" aria-hidden="true">
                                <svg viewBox="0 0 24 24" class="pd-ic" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
                            </span>
                            <p class="pd-form__ok-t">Спасибо за ответ!</p>
                            <p class="pd-form__ok-d">Всё получилось — мы свяжемся с вами в ближайшее время.</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </main>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const rootEl = ref(null);

// "Как это работает" video: custom cover (community-network.jpg) + play button that starts the
// self-hosted clip and reveals native controls.
const videoEl = ref(null);
const videoStarted = ref(false);
function playVideo() {
    videoStarted.value = true;
    const v = videoEl.value;
    if (v) { v.play?.().catch(() => {}); }
}

// Phosphor-style line icons (MIT), single 1.6 stroke, sized via CSS.
const IC = {
    mic: '<svg viewBox="0 0 24 24" class="pd-ic" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"/></svg>',
    school: '<svg viewBox="0 0 24 24" class="pd-ic" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V9l8-5 8 5v12M9 21v-6h6v6"/></svg>',
    clock: '<svg viewBox="0 0 24 24" class="pd-ic" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
    video: '<svg viewBox="0 0 24 24" class="pd-ic" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></svg>',
    chat: '<svg viewBox="0 0 24 24" class="pd-ic" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5.3A8 8 0 1 1 21 12z"/></svg>',
    stethoscope: '<svg viewBox="0 0 24 24" class="pd-ic" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v5a5 5 0 0 0 10 0V3"/><path d="M6 3H4M16 3h2M11 18v-5"/><circle cx="18" cy="16" r="3"/><path d="M18 13v-2"/></svg>',
    teacher: '<svg viewBox="0 0 24 24" class="pd-ic" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.6a3 3 0 0 1 0 5.5M20.5 19a5 5 0 0 0-3.4-4.7"/></svg>',
    community: '<svg viewBox="0 0 24 24" class="pd-ic" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.7 2.6 15.3 0 18M12 3c-2.6 2.7-2.6 15.3 0 18"/></svg>',
};

const tabs = [
    {
        key: 'specialist', label: 'Специалист', icon: IC.stethoscope, href: '/all_course', cta: 'Смотреть курсы',
        text: 'Проходите курсы у ведущих практиков и заполняйте профиль специалиста — вас увидят пациенты в каталоге сообщества и смогут к вам записаться.',
    },
    {
        key: 'speaker', label: 'Спикер', icon: IC.mic, href: '/registration', cta: 'Стать спикером',
        text: 'Хотите делиться своими знаниями и зарабатывать на этом? У нас вы найдёте идеальные условия для создания и продажи ваших курсов.',
    },
    {
        key: 'school', label: 'Учебное заведение', icon: IC.school, href: '/registration', cta: 'Оставить заявку',
        text: 'Расширьте доступ к вашим образовательным продуктам и привлекайте больше специалистов с помощью нашей платформы.',
    },
];
const activeTab = ref(0);

const advantages = [
    { icon: IC.clock, title: 'Учитесь в своём темпе', text: 'Обучение дома без строгого расписания. Вы сами задаёте ритм — удобное время и скорость прохождения курсов.' },
    { icon: IC.video, title: 'Места в первом ряду', text: 'Высококачественные видео обеспечат детальное обучение. Пересматривайте материалы столько раз, сколько нужно.' },
    { icon: IC.chat, title: 'Делитесь знаниями и идеями', text: 'Задавайте вопросы, запрашивайте отзывы и предлагайте решения. Общайтесь с другими специалистами в активном сообществе.' },
    { icon: IC.stethoscope, title: 'Учитесь у профессионалов', text: 'Осваивайте методы и техники, объяснённые ведущими медицинскими экспертами и практикующими специалистами.' },
    { icon: IC.teacher, title: 'Опытные преподаватели', text: 'Наши эксперты делятся лучшими практиками с чёткими инструкциями и профессиональным пониманием каждой темы.' },
    { icon: IC.community, title: 'Кинезио-сообщество', text: 'Сообщество объединяет специалистов, увлечённых новыми знаниями. Взаимодействуйте и развивайтесь с единомышленниками.' },
];

// Contact form → notifies adv@meetgu.ru via the meetguru-lead n8n webhook (Unisender email). Same
// pattern as LoginPage's password reset: fire-and-confirm — a network error still shows success so
// the visitor is never blocked (the lead may just need a retry).
const form = reactive({ name: '', phone: '' });
const sent = ref(false);
const busy = ref(false);
const error = ref('');
const N8N_LEAD = 'https://n8n.meetgu.ru/webhook/meetguru-lead';
async function submitForm() {
    error.value = '';
    if (!form.name || form.phone.replace(/\D/g, '').length < 10) {
        error.value = 'Укажите имя и корректный телефон.';
        return;
    }
    busy.value = true;
    try {
        await fetch(N8N_LEAD, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: 'Главная', name: form.name, phone: form.phone }),
        });
    } catch (e) { /* keep parity with the reset flow: always confirm */ }
    finally { busy.value = false; sent.value = true; }
}

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
/* ── Tokens: MeetGuru brand — blue (action) + orange (spark) on light ───── */
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
    --orange-bright: #ff7a1a;
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
.pd-section { padding: 88px 0; }
.pd-section--tint { background: var(--bg-tint); }

.pd-ic { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; display: block; }

.pd-h2 { margin: 0 0 12px; font-weight: 700; font-size: clamp(1.9rem, 4vw, 3rem); line-height: 1.06; letter-spacing: -0.02em; }
.pd-head { margin-bottom: 34px; }
.pd-head--center { text-align: center; max-width: 640px; margin-inline: auto; }
.pd-head__note { margin: 0; color: var(--ink-2); }

/* ── Reveal motion ──────────────────────────────────────────────────────── */
[data-reveal] { opacity: 0; transform: translateY(20px); transition: opacity 0.6s var(--ease-out), transform 0.6s var(--ease-out); transition-delay: calc(var(--i, 0) * 60ms); }
[data-reveal].is-in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { [data-reveal] { opacity: 1; transform: none; transition: none; } }

/* ── Buttons ────────────────────────────────────────────────────────────── */
.pd-btn {
    font-family: inherit; font-weight: 600; font-size: 16px;
    color: var(--btn-ink); background: var(--blue);
    border: none; border-radius: var(--r-pill); padding: 15px 28px; cursor: pointer;
    transition: transform 0.16s var(--ease-out), background 0.16s var(--ease-out), box-shadow 0.16s var(--ease-out);
    box-shadow: 0 10px 26px -12px rgba(46, 112, 221, 0.7);
}
.pd-btn:active { transform: translateY(1px); }
.pd-btn:focus-visible { outline: 2px solid var(--blue-ink); outline-offset: 3px; }
.pd-btn:disabled { opacity: 0.6; cursor: default; }
@media (hover: hover) and (pointer: fine) {
    .pd-btn:not(:disabled):hover { background: var(--blue-strong); transform: translateY(-2px); box-shadow: 0 16px 32px -14px rgba(46, 112, 221, 0.8); }
}
.pd-btn--lg { padding: 18px 34px; font-size: 17px; }
.pd-btn--block { width: 100%; }

.pd-ghost {
    display: inline-flex; align-items: center; gap: 8px;
    font-weight: 600; font-size: 16px; color: var(--ink); text-decoration: none;
    padding: 8px 4px; transition: gap 0.18s var(--ease-out), color 0.18s var(--ease-out); cursor: pointer;
}
.pd-ghost .pd-ic { width: 20px; height: 20px; }
@media (hover: hover) and (pointer: fine) { .pd-ghost:hover { color: var(--blue-ink); gap: 12px; } }

/* ── Hero ───────────────────────────────────────────────────────────────── */
.pd-hero { position: relative; padding: 72px 0 92px; overflow: hidden; }

/* ── Ambient morphing shapes ─────────────────────────────────────────────── */
.pd-blobs { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
.pd-blob { position: absolute; filter: blur(6px); will-change: transform; transform-origin: center; }
.pd-blob--1 { width: 560px; height: 560px; top: -170px; right: -130px; background: radial-gradient(circle at 36% 34%, rgba(84, 149, 243, 0.42), rgba(84, 149, 243, 0.06) 68%, transparent 74%); border-radius: 42% 58% 63% 37% / 45% 42% 58% 55%; animation: pd-blob1 24s ease-in-out infinite; }
.pd-blob--2 { width: 360px; height: 360px; top: 30px; right: 170px; background: radial-gradient(circle at 42% 40%, rgba(46, 112, 221, 0.30), transparent 70%); border-radius: 58% 42% 45% 55% / 52% 55% 45% 48%; animation: pd-blob2 30s ease-in-out infinite; }
.pd-blob--3 { width: 300px; height: 300px; top: 300px; right: -50px; background: radial-gradient(circle at 40% 40%, rgba(240, 145, 87, 0.26), transparent 70%); border-radius: 50% 50% 40% 60% / 55% 45% 55% 45%; animation: pd-blob3 27s ease-in-out infinite; }
@keyframes pd-blob1 {
    0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); border-radius: 42% 58% 63% 37% / 45% 42% 58% 55%; }
    33% { transform: translate(-26px, 22px) rotate(9deg) scale(1.06); border-radius: 60% 40% 42% 58% / 54% 58% 42% 46%; }
    66% { transform: translate(18px, -16px) rotate(-6deg) scale(0.96); border-radius: 40% 60% 56% 44% / 46% 40% 60% 54%; }
}
@keyframes pd-blob2 {
    0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); border-radius: 58% 42% 45% 55% / 52% 55% 45% 48%; }
    50% { transform: translate(24px, 18px) rotate(-10deg) scale(1.08); border-radius: 44% 56% 60% 40% / 42% 46% 54% 58%; }
}
@keyframes pd-blob3 {
    0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); border-radius: 50% 50% 40% 60% / 55% 45% 55% 45%; }
    50% { transform: translate(-20px, -22px) rotate(12deg) scale(1.05); border-radius: 62% 38% 55% 45% / 45% 58% 42% 55%; }
}
@media (prefers-reduced-motion: reduce) { .pd-blob { animation: none; } }

.pd-hero__grid { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(360px, 1fr); gap: 48px; align-items: center; }

.pd-badge { display: inline-flex; align-items: center; gap: 9px; padding: 8px 16px; border-radius: var(--r-pill); background: var(--blue-tint); color: var(--blue-ink); font-weight: 600; font-size: 14px; }
.pd-badge__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--orange); box-shadow: 0 0 0 4px rgba(240, 145, 87, 0.22); }

.pd-hero__title { margin: 22px 0 0; font-weight: 700; font-size: clamp(2.4rem, 6.2vw, 4.8rem); line-height: 1.0; letter-spacing: -0.025em; }
.pd-hero__sub2 { display: block; margin-top: 16px; font-weight: 500; font-size: clamp(1.05rem, 2vw, 1.5rem); line-height: 1.25; letter-spacing: -0.01em; color: var(--ink-2); }
.pd-hero__hook { margin: 26px 0 32px; max-width: 48ch; font-size: 1.14rem; color: var(--ink-2); }
.pd-hero__cta { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }

.pd-hero__art { display: flex; justify-content: center; }
.pd-hero__art-panel { position: relative; width: 100%; max-width: 560px; aspect-ratio: 4 / 5; display: grid; place-items: center; animation: pd-hero-float 7s ease-in-out infinite; }
@keyframes pd-hero-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
@media (prefers-reduced-motion: reduce) { .pd-hero__art-panel { animation: none; } }
.pd-hero__img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 14px 26px rgba(9, 23, 71, 0.14)); }

/* ── Audience tabs ──────────────────────────────────────────────────────── */
.pd-tabs__row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 22px; }
.pd-tab { display: inline-flex; align-items: center; gap: 10px; font-family: inherit; font-weight: 600; font-size: 1rem; color: var(--ink-2); background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-pill); padding: 12px 22px; cursor: pointer; transition: color 0.18s var(--ease-out), border-color 0.18s var(--ease-out), background 0.18s var(--ease-out); }
.pd-tab__ic { display: grid; place-items: center; color: var(--blue-ink); }
.pd-tab__ic :deep(.pd-ic) { width: 20px; height: 20px; }
.pd-tab.is-active { color: #fff; background: var(--blue); border-color: var(--blue); }
.pd-tab.is-active .pd-tab__ic { color: #fff; }
@media (hover: hover) and (pointer: fine) { .pd-tab:not(.is-active):hover { border-color: var(--blue-soft); color: var(--ink); } }
.pd-tabs__panel { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 34px 36px; box-shadow: var(--shadow-sm); }
.pd-tabs__text { margin: 0 0 18px; font-size: 1.16rem; color: var(--ink-2); max-width: 68ch; }

/* ── How it works (video) ───────────────────────────────────────────────── */
.pd-video { position: relative; width: 100%; max-width: 960px; margin: 0 auto; aspect-ratio: 16 / 9; border-radius: var(--r-lg); overflow: hidden; box-shadow: var(--shadow); border: 1px solid var(--line); background: #000; }
.pd-video__el { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; object-fit: cover; background: #000; }
.pd-video__cover { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; padding: 0; cursor: pointer; display: grid; place-items: center; background-image: linear-gradient(rgba(9, 23, 71, 0.06), rgba(9, 23, 71, 0.16)), url('/images/community-network.jpg'); background-size: cover; background-position: center; }
.pd-video__play { display: grid; place-items: center; width: 84px; height: 84px; border-radius: 50%; background: var(--blue); box-shadow: 0 14px 34px -10px rgba(46, 112, 221, 0.75); transition: transform 0.18s var(--ease-out), background 0.18s var(--ease-out); }
.pd-video__play svg { width: 34px; height: 34px; margin-left: 4px; fill: #fff; }
@media (hover: hover) and (pointer: fine) {
    .pd-video__cover:hover .pd-video__play { transform: scale(1.08); background: var(--blue-strong); }
}
.pd-video__cover:focus-visible { outline: 3px solid var(--blue-ink); outline-offset: -3px; }
@media (prefers-reduced-motion: reduce) { .pd-video__play { transition: none; } }

/* ── Advantages cards ───────────────────────────────────────────────────── */
.pd-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
.pd-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 30px 26px 28px; transition: transform 0.24s var(--ease-out), box-shadow 0.24s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .pd-card:hover { transform: translateY(-5px); box-shadow: var(--shadow); } }
.pd-card__ic { display: grid; place-items: center; width: 54px; height: 54px; border-radius: var(--r-md); background: var(--blue-tint); color: var(--blue-ink); margin-bottom: 20px; }
.pd-card__ic :deep(.pd-ic) { width: 28px; height: 28px; }
.pd-card__t { margin: 0 0 10px; font-weight: 700; font-size: 1.16rem; line-height: 1.2; letter-spacing: -0.01em; }
.pd-card__d { margin: 0; color: var(--ink-2); font-size: 0.98rem; }

/* ── Contact form ───────────────────────────────────────────────────────── */
.pd-contact-wrap { padding: 20px 0 96px; }
.pd-contact { display: grid; grid-template-columns: 1fr 0.9fr; gap: 0; border-radius: var(--r-lg); overflow: hidden; box-shadow: var(--shadow); }
.pd-contact__l { background: var(--blue); color: #fff; padding: 48px 46px; display: flex; flex-direction: column; justify-content: center; }
.pd-contact__h { margin: 0 0 10px; font-weight: 700; font-size: clamp(1.7rem, 3.4vw, 2.5rem); letter-spacing: -0.02em; line-height: 1.08; }
.pd-contact__sub { margin: 0 0 26px; font-weight: 500; color: rgba(255, 255, 255, 0.85); }
.pd-contact__meta { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
.pd-contact__meta li { display: flex; align-items: center; gap: 12px; font-weight: 500; }
.pd-contact__meta .pd-ic { flex: none; width: 22px; height: 22px; color: rgba(255, 255, 255, 0.85); }
.pd-contact__card { background: var(--surface); padding: 40px; display: flex; flex-direction: column; justify-content: center; }

.pd-form { display: grid; gap: 18px; }
.pd-field { display: grid; gap: 7px; }
.pd-field__l { font-weight: 600; font-size: 0.9rem; color: var(--ink-2); }
.pd-field input { font-family: inherit; font-size: 1rem; color: var(--ink); background: #fff; border: 1px solid var(--line); border-radius: var(--r-md); padding: 14px 16px; transition: border-color 0.16s var(--ease-out), box-shadow 0.16s var(--ease-out); }
.pd-field input::placeholder { color: var(--ink-3); }
.pd-field input:focus { outline: none; border-color: var(--blue-soft); box-shadow: 0 0 0 3px rgba(84, 149, 243, 0.18); }
.pd-form__err { margin: -4px 0 0; color: var(--orange-ink); font-size: 0.9rem; font-weight: 500; }
.pd-form__note { margin: 4px 0 0; font-size: 0.82rem; color: var(--ink-3); line-height: 1.4; }
.pd-form__note a { color: var(--blue-ink); }

.pd-form__ok { text-align: center; padding: 20px 8px; }
.pd-form__ok-ic { display: grid; place-items: center; width: 58px; height: 58px; margin: 0 auto 16px; border-radius: 50%; background: var(--blue-tint); color: var(--blue-ink); }
.pd-form__ok-ic .pd-ic { width: 30px; height: 30px; stroke-width: 2.4; }
.pd-form__ok-t { margin: 0 0 6px; font-weight: 700; font-size: 1.25rem; }
.pd-form__ok-d { margin: 0; color: var(--ink-2); }

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 1080px) {
    .pd-hero__grid { grid-template-columns: 1fr; gap: 40px; }
    .pd-hero__art-panel { max-width: 380px; }
    .pd-cards { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 900px) {
    .pd-wrap { padding-inline: 22px; }
    .pd-section { padding: 60px 0; }
    .pd-hero { padding: 52px 0 68px; }
    .pd-contact { grid-template-columns: 1fr; }
    .pd-contact__l { padding: 34px 28px; }
    .pd-contact__card { padding: 30px 28px; }
    .pd-tabs__panel { padding: 26px 24px; }
}
@media (max-width: 560px) {
    .pd-cards { grid-template-columns: 1fr; }
    .pd-hero__cta { gap: 14px; }
    .pd-hero__cta .pd-btn { width: 100%; }
    .pd-tab { flex: 1 1 auto; justify-content: center; }
}
</style>
