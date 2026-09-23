<!--
  LandingHeader.vue — static marketing header for the standalone meetgu.ru landing.
  App actions (nav to the platform, login) point to app.meetgu.ru; the landing's own subpages
  (О нас / Спикерам / Ученикам / Учебным заведениям) are physical pages under meetgu.ru. Sticky bar
  with an "О нас" dropdown on desktop and a burger menu on mobile. No auth / Supabase / router.
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

                <div class="lh__drop" ref="dropEl" :class="{ 'is-open': dropOpen }">
                    <button class="lh__drop-btn" type="button" :aria-expanded="dropOpen ? 'true' : 'false'" @click="dropOpen = !dropOpen">
                        О нас
                        <svg class="lh__caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                    </button>
                    <div class="lh__drop-menu" v-show="dropOpen">
                        <a href="/onas">О нас</a>
                        <a href="/spikeram">Спикерам</a>
                        <a href="/uchenikam">Ученикам</a>
                        <a href="/uchz">Учебным заведениям</a>
                    </div>
                </div>
            </nav>

            <div class="lh__cta">
                <a class="lh__login" href="https://app.meetgu.ru/login">Войти</a>
                <a class="lh__reg" href="https://app.meetgu.ru/registration">Регистрация</a>
            </div>

            <button class="lh__burger" type="button" :class="{ 'is-open': mobileOpen }" aria-label="Меню" @click="mobileOpen = !mobileOpen">
                <span></span><span></span><span></span>
            </button>
        </div>

        <!-- mobile menu -->
        <div class="lh__mobile" v-show="mobileOpen">
            <span class="lh__mobile-cap">Платформа</span>
            <a href="/onas">О нас</a>
            <a href="/spikeram">Спикерам</a>
            <a href="/uchenikam">Ученикам</a>
            <a href="/uchz">Учебным заведениям</a>
            <span class="lh__mobile-cap">Приложение</span>
            <a href="https://app.meetgu.ru/events">Мероприятия</a>
            <a href="https://app.meetgu.ru/all_course">Курсы</a>
            <a href="https://app.meetgu.ru/clubs">Клуб</a>
            <a href="https://app.meetgu.ru/streams">Трансляции</a>
            <div class="lh__mobile-cta">
                <a class="lh__login" href="https://app.meetgu.ru/login">Войти</a>
                <a class="lh__reg" href="https://app.meetgu.ru/registration">Регистрация</a>
            </div>
        </div>
    </header>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

const dropOpen = ref(false);
const mobileOpen = ref(false);
const dropEl = ref(null);

// Close the desktop dropdown on any outside click.
function onDocClick(e) {
    if (dropOpen.value && dropEl.value && !dropEl.value.contains(e.target)) dropOpen.value = false;
}
onMounted(() => document.addEventListener('click', onDocClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocClick));
</script>

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

.lh__nav { display: flex; align-items: center; gap: 28px; }
.lh__nav > a { color: #091747; text-decoration: none; font-weight: 500; font-size: 0.98rem; transition: color 0.18s cubic-bezier(0.23, 1, 0.32, 1); }
@media (hover: hover) and (pointer: fine) { .lh__nav > a:hover { color: #2e70dd; } }

/* dropdown */
.lh__drop { position: relative; }
.lh__drop-btn { display: inline-flex; align-items: center; gap: 5px; font-family: inherit; font-weight: 500; font-size: 0.98rem; color: #091747; background: none; border: 0; padding: 0; cursor: pointer; transition: color 0.18s cubic-bezier(0.23, 1, 0.32, 1); }
.lh__caret { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; transition: transform 0.2s cubic-bezier(0.23, 1, 0.32, 1); }
.lh__drop.is-open .lh__drop-btn, .lh__drop-btn:hover { color: #2e70dd; }
.lh__drop.is-open .lh__caret { transform: rotate(180deg); }
.lh__drop-menu { position: absolute; top: calc(100% + 12px); left: 50%; transform: translateX(-50%); min-width: 220px; background: #fff; border: 1px solid #e4e9f1; border-radius: 16px; box-shadow: 0 14px 40px -20px rgba(9, 23, 71, 0.28); padding: 8px; display: grid; gap: 2px; }
.lh__drop-menu a { display: block; padding: 10px 14px; border-radius: 10px; color: #091747; text-decoration: none; font-weight: 500; font-size: 0.96rem; transition: background 0.14s, color 0.14s; }
@media (hover: hover) and (pointer: fine) { .lh__drop-menu a:hover { background: #eaf1fe; color: #1f5fc9; } }

.lh__cta { display: flex; align-items: center; gap: 16px; flex: none; }
.lh__login { color: #091747; text-decoration: none; font-weight: 600; font-size: 0.98rem; }
@media (hover: hover) and (pointer: fine) { .lh__login:hover { color: #2e70dd; } }
.lh__reg { text-decoration: none; font-weight: 600; font-size: 0.98rem; color: #fff; background: #2e70dd; border-radius: 999px; padding: 9px 20px; transition: background 0.18s cubic-bezier(0.23, 1, 0.32, 1); }
@media (hover: hover) and (pointer: fine) { .lh__reg:hover { background: #2360c6; } }

/* burger (mobile) */
.lh__burger { display: none; flex-direction: column; justify-content: center; gap: 5px; width: 40px; height: 40px; background: none; border: 0; cursor: pointer; padding: 8px; }
.lh__burger span { display: block; height: 2px; width: 100%; background: #091747; border-radius: 2px; transition: transform 0.24s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.24s; }
.lh__burger.is-open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.lh__burger.is-open span:nth-child(2) { opacity: 0; }
.lh__burger.is-open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

/* mobile menu panel */
.lh__mobile { display: none; }

@media (max-width: 860px) {
    .lh__wrap { padding: 0 20px; }
    .lh__nav, .lh__cta { display: none; }
    .lh__burger { display: flex; }
    .lh__mobile { display: block; border-top: 1px solid #e4e9f1; padding: 12px 20px 20px; background: #fff; }
    .lh__mobile-cap { display: block; margin: 14px 0 6px; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #98a0ad; }
    .lh__mobile-cap:first-child { margin-top: 4px; }
    .lh__mobile a { display: block; padding: 10px 0; color: #091747; text-decoration: none; font-weight: 500; font-size: 1.02rem; }
    .lh__mobile-cta { display: flex; align-items: center; gap: 16px; margin-top: 16px; }
    .lh__mobile-cta .lh__reg { padding: 10px 22px; }
}
</style>
