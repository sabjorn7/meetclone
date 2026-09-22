<!--
  UchzPage.vue — public marketing subpage "Учебным заведениям" (Phase 4 of the Tilda → self-host
  migration). Ports www.meetgu.ru/uchz into the platform pd-* design system.

  Content is the real Tilda copy (bring your school's products to the platform, get student traffic,
  publish courses/articles, sell without costs) + a "свяжемся с вами" contact form. CONTENT-ONLY:
  AppHeader/AppFooter come from App.vue.

  Rollout: /uchz-demo first (demo-then-swap). The contact form shows a LOCAL success state only on
  the demo — real delivery (n8n leads webhook, same as LoginPage's flow) is wired at ship time.
  Icons are inline Phosphor-style line SVGs (MIT), attributes baked in.
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
                        Школам и учебным центрам
                    </span>
                    <h1 class="pd-hero__title" data-reveal>
                        Учебным заведениям
                        <span class="pd-hero__sub2">масштабируйте продажи своих программ</span>
                    </h1>
                    <p class="pd-hero__hook" data-reveal>
                        Расширьте доступ к своим образовательным продуктам и привлекайте больше
                        учеников. Мы создадим трафик в сообщество, а вы публикуете курсы, пишете
                        статьи и продаёте все свои цифровые продукты на одной платформе.
                    </p>
                    <div class="pd-hero__cta" data-reveal>
                        <button class="pd-btn pd-btn--lg" type="button" @click="scrollTo('contact')">
                            Оставить заявку
                        </button>
                        <a class="pd-ghost" href="/all_course" @click.prevent="go('/all_course')">
                            Посмотреть платформу
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                        </a>
                    </div>
                </div>
            </div>
        </header>

        <!-- ── VALUE POINTS ───────────────────────────────────────── -->
        <section class="pd-section">
            <div class="pd-wrap">
                <div class="pd-cards">
                    <article v-for="(v, i) in values" :key="i" class="pd-card" data-reveal :style="{ '--i': i }">
                        <span class="pd-card__ic" v-html="v.icon" aria-hidden="true"></span>
                        <h3 class="pd-card__t">{{ v.title }}</h3>
                        <p class="pd-card__d">{{ v.text }}</p>
                    </article>
                </div>
            </div>
        </section>

        <!-- ── CONTACT FORM ───────────────────────────────────────── -->
        <section id="contact" class="pd-contact-wrap">
            <div class="pd-wrap">
                <div class="pd-contact" data-reveal>
                    <div class="pd-contact__l">
                        <h2 class="pd-contact__h">Заполните форму — и мы свяжемся</h2>
                        <p class="pd-contact__sub">Расскажем об условиях размещения и поможем перенести ваши программы на платформу.</p>
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
                                <span class="pd-field__l">Название заведения</span>
                                <input v-model.trim="form.org" type="text" name="org" autocomplete="organization"
                                       placeholder="Школа, центр, ИП…" required />
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
                                <svg viewBox="0 0 24 24" class="pd-ic"><path d="M5 13l4 4L19 7"/></svg>
                            </span>
                            <p class="pd-form__ok-t">Спасибо за заявку!</p>
                            <p class="pd-form__ok-d">Мы свяжемся с вами в ближайшее время.</p>
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

const I = (body) => `<svg viewBox="0 0 24 24" class="pd-ic" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const values = [
    { icon: I('<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.6a3 3 0 0 1 0 5.5M20.5 19a5 5 0 0 0-3.4-4.7"/><path d="M18 3l1 2 2 .5-1.5 1.5.3 2L18 8l-1.8 1 .3-2L15 5.5 17 5z"/>'), title: 'Трафик учеников', text: 'Приведём аудиторию в сообщество и к вашим образовательным продуктам — вы получаете новых учеников.' },
    { icon: I('<path d="M12 4 2 9l10 5 10-5-10-5z"/><path d="M6 11.5V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5M21 9v5"/>'), title: 'Курсы, статьи, продукты', text: 'Публикуйте курсы, пишите статьи и продавайте все цифровые продукты на одной площадке.' },
    { icon: I('<path d="M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-7M2 7h20v5H2zM12 7v13M12 7S9.5 3 7.5 4.2 8 7 12 7zM12 7s2.5-4 4.5-2.8S16 7 12 7z"/>'), title: 'Без затрат', text: 'Никаких вложений и абонентской платы — платформа зарабатывает вместе с вами, а не до этого.' },
];

// Contact form → notifies adv@meetgu.ru via the meetguru-lead n8n webhook (Unisender email). Same
// pattern as LoginPage's password reset: fire-and-confirm — a network error still shows success.
const form = reactive({ org: '', phone: '' });
const sent = ref(false);
const busy = ref(false);
const error = ref('');
const N8N_LEAD = 'https://n8n.meetgu.ru/webhook/meetguru-lead';
async function submitForm() {
    error.value = '';
    if (!form.org || form.phone.replace(/\D/g, '').length < 10) {
        error.value = 'Укажите название заведения и корректный телефон.';
        return;
    }
    busy.value = true;
    try {
        await fetch(N8N_LEAD, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: 'Учебные заведения', name: form.org, phone: form.phone }),
        });
    } catch (e) { /* keep parity with the reset flow: always confirm */ }
    finally { busy.value = false; sent.value = true; }
}

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
.pd-section { padding: 60px 0 40px; }
.pd-ic { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; display: block; }

[data-reveal] { opacity: 0; transform: translateY(20px); transition: opacity 0.6s var(--ease-out), transform 0.6s var(--ease-out); transition-delay: calc(var(--i, 0) * 60ms); }
[data-reveal].is-in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { [data-reveal] { opacity: 1; transform: none; transition: none; } }

.pd-btn { font-family: inherit; font-weight: 600; font-size: 16px; color: var(--btn-ink); background: var(--blue); border: none; border-radius: var(--r-pill); padding: 15px 28px; cursor: pointer; transition: transform 0.16s var(--ease-out), background 0.16s var(--ease-out), box-shadow 0.16s var(--ease-out); box-shadow: 0 10px 26px -12px rgba(46, 112, 221, 0.7); }
.pd-btn:active { transform: translateY(1px); }
.pd-btn:focus-visible { outline: 2px solid var(--blue-ink); outline-offset: 3px; }
.pd-btn:disabled { opacity: 0.6; cursor: default; }
@media (hover: hover) and (pointer: fine) { .pd-btn:not(:disabled):hover { background: var(--blue-strong); transform: translateY(-2px); box-shadow: 0 16px 32px -14px rgba(46, 112, 221, 0.8); } }
.pd-btn--lg { padding: 18px 34px; font-size: 17px; }
.pd-btn--block { width: 100%; }

.pd-ghost { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 16px; color: var(--ink); text-decoration: none; padding: 8px 4px; transition: gap 0.18s var(--ease-out), color 0.18s var(--ease-out); cursor: pointer; }
.pd-ghost .pd-ic { width: 20px; height: 20px; }
@media (hover: hover) and (pointer: fine) { .pd-ghost:hover { color: var(--blue-ink); gap: 12px; } }

/* ── Hero ───────────────────────────────────────────────────────────────── */
.pd-hero { position: relative; padding: 80px 0 40px; overflow: hidden; }
.pd-blobs { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
.pd-blob { position: absolute; filter: blur(6px); will-change: transform; }
.pd-blob--1 { width: 520px; height: 520px; top: -170px; right: -120px; background: radial-gradient(circle at 36% 34%, rgba(84, 149, 243, 0.34), transparent 70%); border-radius: 42% 58% 63% 37% / 45% 42% 58% 55%; animation: pd-blob1 24s ease-in-out infinite; }
.pd-blob--2 { width: 300px; height: 300px; top: 60px; right: 260px; background: radial-gradient(circle at 40% 40%, rgba(240, 145, 87, 0.2), transparent 70%); border-radius: 58% 42% 45% 55% / 52% 55% 45% 48%; animation: pd-blob2 30s ease-in-out infinite; }
@keyframes pd-blob1 { 0%,100% { transform: translate(0,0) rotate(0deg) scale(1); border-radius: 42% 58% 63% 37% / 45% 42% 58% 55%; } 33% { transform: translate(-24px,20px) rotate(9deg) scale(1.05); border-radius: 60% 40% 42% 58% / 54% 58% 42% 46%; } 66% { transform: translate(16px,-14px) rotate(-6deg) scale(0.97); border-radius: 40% 60% 56% 44% / 46% 40% 60% 54%; } }
@keyframes pd-blob2 { 0%,100% { transform: translate(0,0) rotate(0deg) scale(1); } 50% { transform: translate(22px,16px) rotate(-10deg) scale(1.07); } }
@media (prefers-reduced-motion: reduce) { .pd-blob { animation: none; } }

.pd-hero__lead { position: relative; z-index: 1; max-width: 760px; }
.pd-badge { display: inline-flex; align-items: center; gap: 9px; padding: 8px 16px; border-radius: var(--r-pill); background: var(--blue-tint); color: var(--blue-ink); font-weight: 600; font-size: 14px; }
.pd-badge__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--orange); box-shadow: 0 0 0 4px rgba(240, 145, 87, 0.22); }
.pd-hero__title { margin: 22px 0 0; font-weight: 700; font-size: clamp(2.2rem, 5.4vw, 4rem); line-height: 1.02; letter-spacing: -0.025em; }
.pd-hero__sub2 { display: block; margin-top: 10px; font-weight: 500; font-size: clamp(1.1rem, 2.2vw, 1.7rem); color: var(--ink-2); }
.pd-hero__hook { margin: 24px 0 30px; max-width: 62ch; font-size: 1.14rem; color: var(--ink-2); }
.pd-hero__cta { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }

/* ── Cards (values) ─────────────────────────────────────────────────────── */
.pd-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
.pd-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 32px 28px 30px; transition: transform 0.24s var(--ease-out), box-shadow 0.24s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .pd-card:hover { transform: translateY(-5px); box-shadow: var(--shadow); } }
.pd-card__ic { display: grid; place-items: center; width: 56px; height: 56px; border-radius: var(--r-md); background: var(--blue-tint); color: var(--blue-ink); margin-bottom: 22px; }
.pd-card__ic :deep(.pd-ic) { width: 30px; height: 30px; }
.pd-card__t { margin: 0 0 10px; font-weight: 700; font-size: 1.2rem; line-height: 1.2; letter-spacing: -0.01em; }
.pd-card__d { margin: 0; color: var(--ink-2); font-size: 1rem; }

/* ── Contact form ───────────────────────────────────────────────────────── */
.pd-contact-wrap { padding: 40px 0 96px; }
.pd-contact { display: grid; grid-template-columns: 1fr 0.9fr; gap: 0; border-radius: var(--r-lg); overflow: hidden; box-shadow: var(--shadow); }
.pd-contact__l { background: var(--blue); color: #fff; padding: 48px 46px; display: flex; flex-direction: column; justify-content: center; }
.pd-contact__h { margin: 0 0 10px; font-weight: 700; font-size: clamp(1.6rem, 3.2vw, 2.3rem); letter-spacing: -0.02em; line-height: 1.1; }
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
@media (max-width: 1080px) { .pd-cards { grid-template-columns: 1fr; } }
@media (max-width: 900px) {
    .pd-wrap { padding-inline: 22px; }
    .pd-hero { padding: 54px 0 30px; }
    .pd-contact { grid-template-columns: 1fr; }
    .pd-contact__l { padding: 34px 28px; }
    .pd-contact__card { padding: 30px 28px; }
}
@media (max-width: 560px) { .pd-hero__cta .pd-btn { width: 100%; } }
</style>
