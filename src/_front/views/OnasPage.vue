<!--
  OnasPage.vue — "О нас" marketing subpage (meetgu.ru/onas). Compact: an about-the-platform hero +
  the shared AudienceTabs block (Специалист/Спикер/Учебное заведение), same as the main landing.
  Content-only, router-optional (standalone landing build has no router → CTAs go to app.meetgu.ru).
-->
<template>
    <main class="pd" ref="rootEl">
        <!-- ── HERO ───────────────────────────────────────────────── -->
        <header class="pd-hero">
            <div class="pd-blobs" aria-hidden="true">
                <span class="pd-blob pd-blob--1"></span>
                <span class="pd-blob pd-blob--2"></span>
            </div>
            <div class="pd-wrap">
                <div class="pd-hero__lead">
                    <span class="pd-badge" data-reveal>
                        <span class="pd-badge__dot" aria-hidden="true"></span>
                        О платформе
                    </span>
                    <h1 class="pd-hero__title" data-reveal>
                        Сообщество экспертов
                        <span class="pd-hero__sub2">в сфере оздоровления</span>
                    </h1>
                    <p class="pd-hero__hook" data-reveal>
                        МитГуру объединяет специалистов оздоровления и тех, кто хочет учиться, —
                        кинезиологов, остеопатов, массажистов и других практиков. Мы собрали курсы
                        ведущих экспертов на одной площадке: специалист находит клиентов, ученик —
                        учителя, а эксперт может делиться знаниями и зарабатывать.
                    </p>
                    <div class="pd-hero__cta" data-reveal>
                        <button class="pd-btn pd-btn--lg" type="button" @click="go('/all_course')">
                            Смотреть курсы
                        </button>
                        <a class="pd-ghost" href="/registration" @click.prevent="go('/registration')">
                            Стать спикером
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                        </a>
                    </div>
                </div>
            </div>
        </header>

        <!-- ── AUDIENCE TABS (shared) ─────────────────────────────── -->
        <AudienceTabs heading="Кому подходит платформа" />

        <!-- ── FINAL CTA ──────────────────────────────────────────── -->
        <section class="pd-cta-wrap">
            <div class="pd-wrap">
                <div class="pd-cta" data-reveal>
                    <div class="pd-cta__text">
                        <h2 class="pd-cta__h">Присоединяйтесь к сообществу</h2>
                        <p class="pd-cta__sub">Учитесь у практиков, ведите свои курсы и растите вместе с профессиональным сообществом оздоровления.</p>
                    </div>
                    <button class="pd-btn pd-btn--lg" type="button" @click="go('/registration')">
                        Начать
                    </button>
                </div>
            </div>
        </section>
    </main>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import AudienceTabs from '@/_front/components/AudienceTabs.vue';

// Router-optional: present in the app build, absent in the standalone meetgu.ru landing build.
let router = null;
try { router = useRouter(); } catch (e) { router = null; }
const rootEl = ref(null);

function go(path) { if (router) router.push(path); else window.location.href = 'https://app.meetgu.ru' + path; }
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
.pd {
    --bg: #ffffff; --surface: #ffffff; --ink: #091747; --ink-2: #5b6472; --ink-3: #98a0ad; --line: #e4e9f1;
    --blue: #2e70dd; --blue-soft: #5495f3; --blue-strong: #2360c6; --blue-ink: #1f5fc9; --blue-tint: #eaf1fe;
    --orange: #f09157;
    --btn-ink: #ffffff; --r-lg: 26px; --r-md: 16px; --r-pill: 999px;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --shadow: 0 14px 40px -20px rgba(9, 23, 71, 0.24);
    --wrap: 1200px;
    background: var(--bg); color: var(--ink);
    font-family: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 17px; line-height: 1.55; -webkit-font-smoothing: antialiased; overflow-x: hidden;
}
.pd *, .pd *::before, .pd *::after { box-sizing: border-box; }
.pd-wrap { width: 100%; max-width: var(--wrap); margin-inline: auto; padding-inline: 40px; }
.pd-ic { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; display: block; }

[data-reveal] { opacity: 0; transform: translateY(20px); transition: opacity 0.6s var(--ease-out), transform 0.6s var(--ease-out); }
[data-reveal].is-in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { [data-reveal] { opacity: 1; transform: none; transition: none; } }

.pd-btn { font-family: inherit; font-weight: 600; font-size: 16px; color: var(--btn-ink); background: var(--blue); border: none; border-radius: var(--r-pill); padding: 15px 28px; cursor: pointer; transition: transform 0.16s var(--ease-out), background 0.16s var(--ease-out), box-shadow 0.16s var(--ease-out); box-shadow: 0 10px 26px -12px rgba(46, 112, 221, 0.7); }
.pd-btn:active { transform: translateY(1px); }
@media (hover: hover) and (pointer: fine) { .pd-btn:hover { background: var(--blue-strong); transform: translateY(-2px); } }
.pd-btn--lg { padding: 18px 34px; font-size: 17px; }
.pd-ghost { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 16px; color: var(--ink); text-decoration: none; padding: 8px 4px; cursor: pointer; transition: gap 0.18s var(--ease-out), color 0.18s var(--ease-out); }
.pd-ghost .pd-ic { width: 20px; height: 20px; }
@media (hover: hover) and (pointer: fine) { .pd-ghost:hover { color: var(--blue-ink); gap: 12px; } }

.pd-hero { position: relative; padding: 80px 0 40px; overflow: hidden; }
.pd-blobs { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
.pd-blob { position: absolute; filter: blur(6px); will-change: transform; }
.pd-blob--1 { width: 520px; height: 520px; top: -170px; right: -120px; background: radial-gradient(circle at 36% 34%, rgba(84, 149, 243, 0.34), transparent 70%); border-radius: 42% 58% 63% 37% / 45% 42% 58% 55%; animation: pd-blob1 24s ease-in-out infinite; }
.pd-blob--2 { width: 300px; height: 300px; top: 70px; right: 240px; background: radial-gradient(circle at 40% 40%, rgba(240, 145, 87, 0.2), transparent 70%); border-radius: 58% 42% 45% 55% / 52% 55% 45% 48%; animation: pd-blob2 30s ease-in-out infinite; }
@keyframes pd-blob1 { 0%,100% { transform: translate(0,0) rotate(0deg) scale(1); border-radius: 42% 58% 63% 37% / 45% 42% 58% 55%; } 33% { transform: translate(-24px,20px) rotate(9deg) scale(1.05); border-radius: 60% 40% 42% 58% / 54% 58% 42% 46%; } 66% { transform: translate(16px,-14px) rotate(-6deg) scale(0.97); border-radius: 40% 60% 56% 44% / 46% 40% 60% 54%; } }
@keyframes pd-blob2 { 0%,100% { transform: translate(0,0) rotate(0deg) scale(1); } 50% { transform: translate(22px,16px) rotate(-10deg) scale(1.07); } }
@media (prefers-reduced-motion: reduce) { .pd-blob { animation: none; } }

.pd-hero__lead { position: relative; z-index: 1; max-width: 760px; }
.pd-badge { display: inline-flex; align-items: center; gap: 9px; padding: 8px 16px; border-radius: var(--r-pill); background: var(--blue-tint); color: var(--blue-ink); font-weight: 600; font-size: 14px; }
.pd-badge__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--orange); box-shadow: 0 0 0 4px rgba(240, 145, 87, 0.22); }
.pd-hero__title { margin: 22px 0 0; font-weight: 700; font-size: clamp(2.2rem, 5.4vw, 4rem); line-height: 1.02; letter-spacing: -0.025em; }
.pd-hero__sub2 { display: block; margin-top: 10px; font-weight: 500; font-size: clamp(1.1rem, 2.2vw, 1.7rem); color: var(--ink-2); }
.pd-hero__hook { margin: 24px 0 30px; max-width: 64ch; font-size: 1.14rem; color: var(--ink-2); }
.pd-hero__cta { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }

.pd-cta-wrap { padding: 40px 0 96px; }
.pd-cta { display: flex; align-items: center; justify-content: space-between; gap: 32px; flex-wrap: wrap; background: var(--blue); color: #fff; border-radius: var(--r-lg); padding: 44px 52px; box-shadow: var(--shadow); }
.pd-cta__h { margin: 0 0 8px; font-weight: 700; font-size: clamp(1.6rem, 3.2vw, 2.4rem); letter-spacing: -0.02em; }
.pd-cta__sub { margin: 0; color: rgba(255, 255, 255, 0.85); max-width: 56ch; }
.pd-cta .pd-btn { background: #fff; color: var(--blue); flex: none; }
@media (hover: hover) and (pointer: fine) { .pd-cta .pd-btn:hover { background: #eef4ff; } }

@media (max-width: 900px) {
    .pd-wrap { padding-inline: 22px; }
    .pd-hero { padding: 54px 0 30px; }
    .pd-cta-wrap { padding: 30px 0 72px; }
    .pd-cta { padding: 32px 28px; }
}
@media (max-width: 560px) { .pd-hero__cta .pd-btn { width: 100%; } }
</style>
