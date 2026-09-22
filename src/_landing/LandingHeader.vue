<!--
  LandingHeader.vue — static marketing header for the standalone meetgu.ru landing.
  No auth / Supabase / router: every action lives on the app at app.meetgu.ru. Sticky top bar
  matching the platform's AppHeader look (white bar, meetguru wordmark, nav, Войти + Регистрация).
-->
<template>
    <header class="lh">
        <div class="lh__wrap">
            <a class="lh__logo" href="/">meetguru<span>.</span></a>

            <nav class="lh__nav" aria-label="Навигация">
                <a href="https://app.meetgu.ru/events">Мероприятия</a>
                <a href="https://app.meetgu.ru/all_course">Курсы</a>
                <a href="https://app.meetgu.ru/clubs">Клуб</a>
                <a href="https://app.meetgu.ru/streams">Трансляции</a>
            </nav>

            <div class="lh__cta">
                <a class="lh__login" href="https://app.meetgu.ru/login">Войти</a>
                <a class="lh__reg" href="https://app.meetgu.ru/registration">Регистрация</a>
            </div>
        </div>
    </header>
</template>

<script setup></script>

<style scoped>
.lh {
    position: sticky;
    top: 0;
    z-index: 50;
    background: #fff;
    border-bottom: 1px solid #e4e9f1;
    font-family: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
}
.lh__wrap {
    width: 100%;
    max-width: 1200px;
    margin-inline: auto;
    padding: 0 40px;
    height: 62px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
}
.lh__logo { font-weight: 800; font-size: 1.4rem; letter-spacing: -0.03em; color: #091747; text-decoration: none; flex: none; }
.lh__logo span { color: #5495f3; }

.lh__nav { display: flex; align-items: center; gap: 30px; }
.lh__nav a { color: #091747; text-decoration: none; font-weight: 500; font-size: 0.98rem; transition: color 0.18s cubic-bezier(0.23, 1, 0.32, 1); }
@media (hover: hover) and (pointer: fine) { .lh__nav a:hover { color: #2e70dd; } }

.lh__cta { display: flex; align-items: center; gap: 16px; flex: none; }
.lh__login { color: #091747; text-decoration: none; font-weight: 600; font-size: 0.98rem; }
.lh__reg {
    text-decoration: none; font-weight: 600; font-size: 0.98rem; color: #fff;
    background: #2e70dd; border-radius: 999px; padding: 9px 20px;
    transition: background 0.18s cubic-bezier(0.23, 1, 0.32, 1);
}
@media (hover: hover) and (pointer: fine) { .lh__reg:hover { background: #2360c6; } }
@media (hover: hover) and (pointer: fine) { .lh__login:hover { color: #2e70dd; } }

@media (max-width: 860px) {
    .lh__wrap { padding: 0 20px; }
    .lh__nav { display: none; }
}
@media (max-width: 460px) {
    .lh__login { display: none; }
}
</style>
