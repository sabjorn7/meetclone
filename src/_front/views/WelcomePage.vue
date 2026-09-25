<!--
  WelcomePage.vue — "/welcome" in the MeetGuru promo (pd-*) brand language. The post-registration
  landing (RegistrationPage → /welcome). Reimagined from the WeWeb Welcome page, KEEPING its four
  «Minime» illustrations (public/images/2023-10-14_09.16.50/53/56 + 09.17.00.jpg) as the value-prop
  cards. Content-only — gets the shared AppHeader/AppFooter (not in App.vue CHROME_EXCLUDE).
  Demo at /welcome-demo; /welcome is swapped via PAGE_OVERRIDES.
-->
<template>
    <main class="pd" :class="{ 'is-ready': ready }">
        <!-- ── HERO ─────────────────────────────────────────────── -->
        <header class="wl-hero">
            <span class="wl-blob wl-blob--1" aria-hidden="true"></span>
            <span class="wl-blob wl-blob--2" aria-hidden="true"></span>
            <div class="wl-wrap wl-hero__inner">
                <span class="wl-badge" data-reveal>🎉 Вы с нами</span>
                <h1 class="wl-hero__title" data-reveal>Спасибо за регистрацию на MeetGuru</h1>
                <p class="wl-hero__sub" data-reveal>Добро пожаловать в сообщество специалистов в сфере оздоровления. Вот с чего можно начать.</p>
                <div class="wl-hero__cta" data-reveal>
                    <a class="wl-btn wl-btn--primary" href="/">В личный кабинет</a>
                    <a class="wl-btn" href="/all_course">Каталог курсов</a>
                </div>
            </div>
        </header>

        <!-- ── VALUE PROPS (the 4 illustrations) ─────────────────── -->
        <section class="wl-section">
            <div class="wl-wrap">
                <h2 class="wl-h2" data-reveal>Что вас ждёт на платформе</h2>
                <div class="wl-cards">
                    <article v-for="(c, i) in cards" :key="c.title" class="wl-card" data-reveal :style="{ '--i': i }">
                        <div class="wl-card__art">
                            <img :src="c.img" :alt="c.title" loading="lazy" width="1280" height="1280" />
                        </div>
                        <h3 class="wl-card__t">{{ c.title }}</h3>
                        <p class="wl-card__p">{{ c.text }}</p>
                    </article>
                </div>
            </div>
        </section>

        <!-- ── CLOSING CTA ──────────────────────────────────────── -->
        <section class="wl-final">
            <div class="wl-wrap wl-final__inner" data-reveal>
                <h2 class="wl-final__t">Готовы начать?</h2>
                <p class="wl-final__p">Загляните в личный кабинет или выберите первый курс — остальное подскажем по пути.</p>
                <div class="wl-hero__cta">
                    <a class="wl-btn wl-btn--primary" href="/">В личный кабинет</a>
                    <a class="wl-btn" href="/articles">Читать статьи</a>
                </div>
            </div>
        </section>
    </main>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';

// The four WeWeb «Minime» illustrations, kept verbatim, mapped to the platform's value props.
const cards = [
    { img: '/images/2023-10-14_09.16.50.jpg', title: 'Загружайте обучающие программы', text: 'Публикуйте свои курсы и делайте образовательные продукты доступнее для тысяч учеников.' },
    { img: '/images/2023-10-14_09.16.53.jpg', title: 'Зарабатывайте на своих курсах', text: 'Продавайте программы и получайте доход — приём оплат платформа берёт на себя.' },
    { img: '/images/2023-10-14_09.16.56.jpg', title: 'Покупайте курсы и обучайтесь', text: 'Доступ к курсам практикующих специалистов — учитесь в удобном темпе, с любого устройства.' },
    { img: '/images/2023-10-14_09.17.00.jpg', title: 'Делайте публикации', text: 'Пишите статьи и делитесь опытом с профессиональным сообществом коллег.' },
];

const ready = ref(false);
onMounted(() => {
    ensureFonts();
    document.title = 'Добро пожаловать — МитГуру';
    nextTick(() => { ready.value = true; });
});

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
    --bg: #ffffff; --bg-tint: #f1f6fd; --surface: #ffffff;
    --ink: #091747; --ink-2: #5b6472; --ink-3: #98a0ad; --line: #e4e9f1;
    --blue: #2e70dd; --blue-soft: #5495f3; --blue-strong: #2360c6; --blue-ink: #1f5fc9; --blue-tint: #eaf1fe;
    --orange: #f09157;
    --r-lg: 26px; --r-md: 16px; --r-pill: 999px;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --shadow: 0 18px 50px -26px rgba(9, 23, 71, 0.28); --shadow-sm: 0 6px 20px -12px rgba(9, 23, 71, 0.2);
    --wrap: 1080px;
    background: var(--bg); color: var(--ink);
    font-family: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 17px; line-height: 1.55; -webkit-font-smoothing: antialiased;
}
.pd *, .pd *::before, .pd *::after { box-sizing: border-box; }
.wl-wrap { width: 100%; max-width: var(--wrap); margin-inline: auto; padding-inline: 32px; }

[data-reveal] { opacity: 0; transform: translateY(18px); transition: opacity 0.6s var(--ease-out), transform 0.6s var(--ease-out); transition-delay: calc(var(--i, 0) * 70ms); }
.pd.is-ready [data-reveal] { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { [data-reveal] { opacity: 1; transform: none; transition: none; } }

/* ── Hero ─────────────────────────────────────────────────────── */
.wl-hero { position: relative; overflow: hidden; text-align: center; padding: 72px 0 44px; }
.wl-blob { position: absolute; border-radius: 50%; filter: blur(50px); opacity: 0.5; z-index: 0; pointer-events: none; }
.wl-blob--1 { width: 360px; height: 360px; left: -90px; top: -60px; background: #dbe8ff; }
.wl-blob--2 { width: 320px; height: 320px; right: -80px; top: 20px; background: #ffe6d4; }
.wl-hero__inner { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; }
.wl-badge { display: inline-block; font-size: 0.9rem; font-weight: 700; color: var(--blue-ink); background: var(--blue-tint); border-radius: var(--r-pill); padding: 7px 16px; }
.wl-hero__title { margin: 18px 0 0; font-weight: 800; font-size: clamp(1.9rem, 4.4vw, 3rem); letter-spacing: -0.025em; line-height: 1.08; text-wrap: balance; max-width: 18ch; }
.wl-hero__sub { margin: 16px 0 0; color: var(--ink-2); font-size: 1.1rem; max-width: 52ch; }
.wl-hero__cta { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 28px; }

.wl-btn { font-weight: 700; font-size: 15px; color: var(--ink); background: #fff; border: 1px solid var(--line); border-radius: var(--r-pill); padding: 14px 26px; text-decoration: none; transition: border-color 0.16s var(--ease-out), background 0.16s var(--ease-out), transform 0.14s var(--ease-out); }
.wl-btn--primary { background: var(--blue); color: #fff; border-color: transparent; }
.wl-btn:active { transform: translateY(1px); }
@media (hover: hover) and (pointer: fine) {
    .wl-btn:hover { border-color: var(--blue-soft); transform: translateY(-1px); }
    .wl-btn--primary:hover { background: var(--blue-strong); border-color: transparent; }
}

/* ── Value cards (the 4 illustrations) ────────────────────────── */
.wl-section { padding: 24px 0 40px; }
.wl-h2 { text-align: center; margin: 0 0 34px; font-weight: 700; font-size: clamp(1.5rem, 3vw, 2rem); letter-spacing: -0.02em; }
.wl-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 22px; }
.wl-card { background: #fff; border: 1px solid var(--line); border-radius: var(--r-lg); padding: 20px 20px 24px; text-align: center; display: flex; flex-direction: column; align-items: center; transition: box-shadow 0.2s var(--ease-out), transform 0.2s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .wl-card:hover { box-shadow: var(--shadow); transform: translateY(-4px); } }
.wl-card__art { width: 100%; aspect-ratio: 1; background: var(--bg-tint); border-radius: var(--r-md); display: grid; place-items: center; overflow: hidden; margin-bottom: 16px; }
.wl-card__art img { width: 82%; height: 82%; object-fit: contain; }
.wl-card__t { margin: 0; font-weight: 700; font-size: 1.06rem; line-height: 1.25; }
.wl-card__p { margin: 8px 0 0; color: var(--ink-2); font-size: 0.95rem; line-height: 1.5; }

/* ── Closing ──────────────────────────────────────────────────── */
.wl-final { padding: 20px 0 80px; }
.wl-final__inner { background: linear-gradient(150deg, #eaf1fe 0%, #f6f0ff 100%); border-radius: var(--r-lg); padding: 48px 32px; text-align: center; display: flex; flex-direction: column; align-items: center; }
.wl-final__t { margin: 0; font-weight: 800; font-size: clamp(1.5rem, 3vw, 2rem); letter-spacing: -0.02em; }
.wl-final__p { margin: 12px 0 0; color: var(--ink-2); max-width: 46ch; }

/* ── Responsive ───────────────────────────────────────────────── */
@media (max-width: 900px) {
    .wl-cards { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 520px) {
    .wl-wrap { padding-inline: 20px; }
    .wl-cards { grid-template-columns: 1fr; }
    .wl-hero { padding: 48px 0 32px; }
}
</style>
