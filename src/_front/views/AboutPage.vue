<!--
  AboutPage.vue — "/about_meet" in the MeetGuru promo (pd-*) brand language. Overrides the WeWeb
  about_meet page. Content-only — the shared AppHeader/AppFooter come from App.vue. Static marketing
  page (no dynamic data). Copy is preserved verbatim from the WeWeb page; the non-functional WeWeb
  contact form (its "Отправить" had no action) is replaced with a working contacts block
  (tel: / mailto: / VK), per product decision — no fake form.
-->
<template>
    <main class="pd" :class="{ 'is-ready': ready }">
        <!-- ── HERO ─────────────────────────────────────────────── -->
        <header class="pd-hero">
            <div class="pd-blob" aria-hidden="true"></div>
            <div class="pd-wrap pd-ahero">
                <div class="pd-ahero__text">
                    <span class="pd-badge" data-reveal><span class="pd-badge__dot" aria-hidden="true"></span>О платформе</span>
                    <h1 class="pd-ahero__title" data-reveal>Образовательная платформа МитГуру</h1>
                    <p class="pd-ahero__sub" data-reveal>Облачная платформа для цифровизации образования в сфере кинезиологии, остеопатии, мануальной терапии и массажа.</p>
                    <a class="pd-btn pd-btn--lg" href="/all_course" data-reveal>Смотреть курсы</a>
                </div>
                <img class="pd-ahero__art" src="/images/efa61e70-1fa2-4d97-9ac7-f937660f8850.png" alt="" aria-hidden="true" data-reveal />
            </div>
        </header>

        <!-- ── УНИКАЛЬНОСТЬ ──────────────────────────────────────── -->
        <section class="pd-section pd-section--tint">
            <div class="pd-wrap pd-uniq">
                <h2 class="pd-h2" data-reveal>Уникальность платформы</h2>
                <p class="pd-uniq__lead" data-reveal>Мы создали все необходимые условия для комфортного обучения и продажи курсов для спикеров и учебных заведений.</p>
            </div>
        </section>

        <!-- ── АУДИТОРИИ ─────────────────────────────────────────── -->
        <section class="pd-section">
            <div class="pd-wrap">
                <div class="pd-cards pd-cards--aud">
                    <article v-for="(a, i) in audiences" :key="i" class="pd-aud" data-reveal :style="{ '--i': Math.min(i, 3) }">
                        <span class="pd-aud__ic" aria-hidden="true"><svg viewBox="0 0 24 24" v-html="AUD_ICONS[a.icon]"></svg></span>
                        <h3 class="pd-aud__t">{{ a.title }}</h3>
                        <p class="pd-aud__p">{{ a.text }}</p>
                    </article>
                </div>
            </div>
        </section>

        <!-- ── КОНТАКТЫ ──────────────────────────────────────────── -->
        <section class="pd-section pd-section--tint">
            <div class="pd-wrap pd-contact">
                <div class="pd-contact__l" data-reveal>
                    <h2 class="pd-h2">Свяжитесь с нами</h2>
                    <p class="pd-contact__note">Напишите свой вопрос и мы ответим вам в течение рабочего дня. Нам важен каждый ваш вопрос или предложение.</p>
                    <a class="pd-btn pd-btn--lg" href="mailto:adv@meetgu.ru">Написать нам</a>
                </div>
                <ul class="pd-contact__list" data-reveal>
                    <li>
                        <a href="tel:+79824979556">
                            <span class="pd-contact__ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L20 13l1 4v3a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/></svg></span>
                            <span class="pd-contact__txt"><span class="muted">Телефон</span><b>+7 982 497 9556</b></span>
                        </a>
                    </li>
                    <li>
                        <a href="mailto:adv@meetgu.ru">
                            <span class="pd-contact__ic" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg></span>
                            <span class="pd-contact__txt"><span class="muted">Почта</span><b>adv@meetgu.ru</b></span>
                        </a>
                    </li>
                    <li>
                        <a href="https://vk.com/meetguruonline" target="_blank" rel="noopener noreferrer">
                            <span class="pd-contact__ic" aria-hidden="true"><svg viewBox="0 0 24 24" stroke="none" fill="currentColor"><path d="M12.8 16.3c-5 0-8-3.5-8.1-9.3h2.5c.1 4.3 2 6.1 3.5 6.5V7h2.4v3.6c1.5-.2 3-1.8 3.6-3.6h2.4c-.5 2.2-2.1 3.8-3.2 4.5 1.1.6 2.9 2 3.6 4.8h-2.6c-.5-1.7-1.9-3-3.8-3.2v3.2h-.3z"/></svg></span>
                            <span class="pd-contact__txt"><span class="muted">ВКонтакте</span><b>vk.com/meetguruonline</b></span>
                        </a>
                    </li>
                    <li>
                        <span class="pd-contact__row">
                            <span class="pd-contact__ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg></span>
                            <span class="pd-contact__txt"><span class="muted">Адрес</span><b>Москва, улица Гарибальди, дом 36</b></span>
                        </span>
                    </li>
                </ul>
            </div>
        </section>
    </main>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';

const ready = ref(false);

const audiences = [
    { icon: 'student', title: 'Студентам', text: 'Выбирайте курсы в сфере кинезиологии и остеопатии от ведущих врачей, экспертов и учебных заведений.' },
    { icon: 'mic', title: 'Спикерам', text: 'Делитесь своими знаниями с лёгкостью, а мы поможем с подачей материала. Здесь вы сможете загрузить свой курс и настроить продажи за 10 минут. Простой и понятный способ вывода средств. Ваши ученики будут рады такому формату развития!' },
    { icon: 'school', title: 'Учебным заведениям', text: 'Сделайте свои образовательные продукты доступнее и увеличьте количество учеников.' },
];
const AUD_ICONS = {
    student: '<path d="M12 4L2 9l10 5 10-5-10-5z"/><path d="M6 11v4c0 1.5 2.7 3 6 3s6-1.5 6-3v-4"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0"/><path d="M12 17v4M9 21h6"/>',
    school: '<path d="M3 21V9l9-5 9 5v12"/><path d="M9 21v-6h6v6"/><path d="M3 21h18"/>',
};

onMounted(async () => {
    ensureFonts();
    setMeta();
    await nextTick();
    ready.value = true;
});

// SEO title + description (the WeWeb about_meet page had neither). Client-side so it applies on the
// live /about_meet override too.
function setMeta() {
    document.title = 'О платформе — МитГуру';
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement('meta'); m.setAttribute('name', 'description'); document.head.appendChild(m); }
    m.setAttribute('content', 'МитГуру — облачная платформа для цифровизации образования в сфере кинезиологии, остеопатии, мануальной терапии и массажа. Курсы от ведущих экспертов и учебных заведений.');
}

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
    --orange: #f09157; --orange-ink: #c2410c;
    --r-lg: 26px; --r-md: 16px; --r-pill: 999px;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --shadow: 0 14px 40px -20px rgba(9, 23, 71, 0.24); --shadow-sm: 0 4px 16px -8px rgba(9, 23, 71, 0.18);
    --wrap: 1200px;
    background: var(--bg); color: var(--ink);
    font-family: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 17px; line-height: 1.55; -webkit-font-smoothing: antialiased; overflow-x: hidden;
}
.pd *, .pd *::before, .pd *::after { box-sizing: border-box; }
.pd-wrap { width: 100%; max-width: var(--wrap); margin-inline: auto; padding-inline: 40px; }
.pd-section { padding: 72px 0; }
.pd-section--tint { background: var(--bg-tint); }

[data-reveal] { opacity: 0; transform: translateY(20px); transition: opacity 0.6s var(--ease-out), transform 0.6s var(--ease-out); transition-delay: calc(var(--i, 0) * 60ms); }
.pd.is-ready [data-reveal] { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { [data-reveal] { opacity: 1; transform: none; transition: none; } }

.pd-btn { display: inline-block; font-family: inherit; font-weight: 600; font-size: 16px; color: #fff; background: var(--blue); border: none; border-radius: var(--r-pill); padding: 14px 26px; cursor: pointer; text-decoration: none; text-align: center; transition: transform 0.16s var(--ease-out), background 0.16s var(--ease-out), box-shadow 0.16s var(--ease-out); box-shadow: 0 10px 26px -12px rgba(46, 112, 221, 0.7); }
.pd-btn:active { transform: translateY(1px); }
@media (hover: hover) and (pointer: fine) { .pd-btn:hover { background: var(--blue-strong); transform: translateY(-2px); box-shadow: 0 16px 32px -14px rgba(46, 112, 221, 0.8); } }
.pd-btn--lg { padding: 16px 34px; font-size: 17px; }
.pd-h2 { margin: 0; font-weight: 700; font-size: clamp(1.9rem, 4vw, 3rem); line-height: 1.06; letter-spacing: -0.02em; }
.pd-badge { display: inline-flex; align-items: center; gap: 9px; padding: 8px 16px; border-radius: var(--r-pill); background: var(--blue-tint); color: var(--blue-ink); font-weight: 600; font-size: 14px; }
.pd-badge__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--orange); box-shadow: 0 0 0 4px rgba(240, 145, 87, 0.22); }

/* ── Hero ───────────────────────────────────────────────────────────────── */
.pd-hero { position: relative; padding: 56px 0 40px; overflow: hidden; }
.pd-blob { position: absolute; top: -180px; right: -140px; width: 600px; height: 600px; border-radius: 50%; background: radial-gradient(circle at 40% 40%, rgba(84, 149, 243, 0.18), rgba(84, 149, 243, 0.04) 60%, transparent 72%); pointer-events: none; z-index: 0; }
.pd-ahero { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 40px; align-items: center; }
.pd-ahero__title { margin: 22px 0 0; font-weight: 800; font-size: clamp(2rem, 4.6vw, 3.4rem); line-height: 1.04; letter-spacing: -0.03em; }
.pd-ahero__sub { margin: 20px 0 0; max-width: 52ch; font-size: 1.14rem; color: var(--ink-2); }
.pd-ahero__text .pd-btn { margin-top: 28px; }
.pd-ahero__art { height: 380px; width: auto; max-width: 100%; justify-self: end; display: block; filter: drop-shadow(0 24px 44px rgba(9, 23, 71, 0.16)); }

/* ── Уникальность ───────────────────────────────────────────────────────── */
.pd-uniq { max-width: 860px; }
.pd-uniq__lead { margin: 22px 0 0; font-size: clamp(1.15rem, 2.4vw, 1.5rem); line-height: 1.4; color: var(--ink-2); font-weight: 500; }

/* ── Аудитории ──────────────────────────────────────────────────────────── */
.pd-cards--aud { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; }
.pd-aud { display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 30px 28px; transition: transform 0.22s var(--ease-out), box-shadow 0.22s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .pd-aud:hover { transform: translateY(-4px); box-shadow: var(--shadow); } }
.pd-aud__ic { width: 54px; height: 54px; border-radius: 16px; background: var(--blue-tint); color: var(--blue-ink); display: grid; place-items: center; margin-bottom: 20px; }
.pd-aud__ic svg { width: 28px; height: 28px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.pd-aud__t { margin: 0 0 12px; font-weight: 700; font-size: 1.4rem; letter-spacing: -0.01em; }
.pd-aud__p { margin: 0; color: var(--ink-2); font-size: 1.02rem; line-height: 1.5; }

/* ── Контакты ───────────────────────────────────────────────────────────── */
.pd-contact { display: grid; grid-template-columns: 1fr 1fr; gap: 44px; align-items: center; }
.pd-contact__note { margin: 20px 0 28px; max-width: 44ch; color: var(--ink-2); font-size: 1.1rem; }
.pd-contact__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
.pd-contact__list li a, .pd-contact__row { display: flex; align-items: center; gap: 16px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); padding: 16px 20px; text-decoration: none; color: inherit; transition: transform 0.16s var(--ease-out), box-shadow 0.16s var(--ease-out), border-color 0.16s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .pd-contact__list li a:hover { transform: translateY(-2px); box-shadow: var(--shadow-sm); border-color: rgba(46, 112, 221, 0.4); } }
.pd-contact__ic { width: 44px; height: 44px; flex: none; border-radius: 50%; background: var(--blue-tint); color: var(--blue-ink); display: grid; place-items: center; }
.pd-contact__ic svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.pd-contact__txt { display: flex; flex-direction: column; line-height: 1.3; min-width: 0; }
.pd-contact__txt .muted { color: var(--ink-3); font-size: 0.82rem; }
.pd-contact__txt b { font-weight: 600; font-size: 1.02rem; overflow: hidden; text-overflow: ellipsis; }

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 940px) {
    .pd-ahero { grid-template-columns: 1fr; gap: 20px; }
    .pd-ahero__art { display: none; }
    .pd-cards--aud { grid-template-columns: 1fr; }
    .pd-contact { grid-template-columns: 1fr; gap: 28px; }
}
@media (max-width: 900px) { .pd-wrap { padding-inline: 22px; } .pd-section { padding: 52px 0; } }
</style>
