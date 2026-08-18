<!--
  AppHeader.vue — reusable MeetGuru site header (extracted from PromoDemoPage, Phase 0).
  Marketing/brand header: logo + nav + cart + burger menu. Self-contained styles + design
  tokens so it can render on any route (hand-written or, later, WeWeb) without external CSS.

  Props:
    ctaLabel   — optional CTA button text (e.g. "Записаться · 3 500 ₽"). Empty string = no CTA.
    stuckAfter — px scrolled before the CTA slides into the bar (default 160).
    menuItems  — nav links (defaults to the standard site set).
  Emits:
    cta — CTA button clicked (parent handles the action).
-->
<template>
    <header class="mgh" :class="{ 'is-stuck': stuck }">
        <div class="mgh__in">
            <a class="mgh__logo" href="/" @click.prevent="go('/')">meetguru<span>.</span></a>
            <nav class="mgh__links" aria-label="Основная навигация">
                <a v-for="i in menuItems.slice(0, 3)" :key="i.path" :href="i.path" @click.prevent="go(i.path)">{{ i.label }}</a>
            </nav>
            <div class="mgh__right">
                <transition name="mgh-fade">
                    <button v-if="ctaLabel && stuck" class="mgh__btn mgh__btn--sm" type="button" @click="$emit('cta')">{{ ctaLabel }}</button>
                </transition>
                <a class="mgh__icon" href="/all_course" @click.prevent="go('/all_course')" aria-label="Каталог курсов">
                    <svg viewBox="0 0 24 24" class="mgh__ic"><path d="M6 6h15l-1.6 8.5a2 2 0 0 1-2 1.6H9.4a2 2 0 0 1-2-1.6L5.2 4H3"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17.5" cy="20" r="1.3"/></svg>
                </a>
                <button class="mgh__burger" type="button" :aria-expanded="menuOpen ? 'true' : 'false'" aria-label="Меню" @click="menuOpen = !menuOpen">
                    <span :class="{ 'is-x': menuOpen }"></span>
                </button>
            </div>
        </div>
        <div class="mgh__menu" :class="{ 'is-open': menuOpen }">
            <nav class="mgh__menu-nav" aria-label="Меню сайта">
                <a v-for="i in menuItems" :key="i.path" :href="i.path" @click.prevent="go(i.path)">{{ i.label }}</a>
            </nav>
            <button v-if="ctaLabel" class="mgh__btn mgh__btn--block" type="button" @click="$emit('cta')">{{ ctaLabel }}</button>
        </div>
    </header>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps({
    ctaLabel: { type: String, default: '' },
    stuckAfter: { type: Number, default: 160 },
    menuItems: {
        type: Array,
        default: () => ([
            { label: 'Курсы', path: '/all_course' },
            { label: 'Клуб', path: '/club' },
            { label: 'Трансляции', path: '/streams' },
            { label: 'Вопросы и ответы', path: '/faq' },
            { label: 'Контакты', path: '/contacts' },
            { label: 'О нас', path: '/about_meet' },
        ]),
    },
});
defineEmits(['cta']);

const router = useRouter();
const menuOpen = ref(false);
const stuck = ref(false);

function go(path) { menuOpen.value = false; router.push(path); }

// Threshold toggle (boolean), passive listener — not a per-frame scroll animation.
let onScroll;
onMounted(() => {
    ensureFont();
    onScroll = () => { stuck.value = window.scrollY > props.stuckAfter; };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
});
onBeforeUnmount(() => { if (onScroll) window.removeEventListener('scroll', onScroll); });

// Self-load Onest so the chrome looks right on any page (guarded — added once site-wide).
function ensureFont() {
    if (document.getElementById('mg-chrome-fonts')) return;
    const l = document.createElement('link');
    l.id = 'mg-chrome-fonts';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
</script>

<style scoped>
.mgh {
    --ink: #091747; --line: #e4e9f1; --blue: #2e70dd; --blue-strong: #2360c6; --blue-ink: #1f5fc9; --blue-tint: #eaf1fe; --btn-ink: #fff;
    --r-pill: 999px; --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    position: fixed; inset: 0 0 auto 0; z-index: 50;
    background: rgba(255, 255, 255, 0.92); backdrop-filter: saturate(160%) blur(12px);
    border-bottom: 1px solid var(--line); font-family: 'Onest', system-ui, -apple-system, sans-serif;
    transition: box-shadow 0.3s var(--ease-out);
}
.mgh.is-stuck { box-shadow: 0 6px 24px -18px rgba(9, 23, 71, 0.4); }
.mgh__in { width: 100%; max-width: 1200px; margin-inline: auto; padding-inline: 40px; height: 62px; display: flex; align-items: center; gap: 30px; }
.mgh__logo { font-weight: 800; font-size: 22px; letter-spacing: -0.03em; color: var(--ink); text-decoration: none; }
.mgh__logo span { color: var(--blue); }
.mgh__links { display: flex; gap: 26px; }
.mgh__links a { color: var(--ink); text-decoration: none; font-weight: 500; font-size: 15px; transition: color 0.18s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .mgh__links a:hover { color: var(--blue-ink); } }
.mgh__right { margin-left: auto; display: flex; align-items: center; gap: 14px; }
.mgh__ic { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; display: block; }
.mgh__icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: var(--r-pill); color: var(--ink); transition: background 0.18s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .mgh__icon:hover { background: var(--blue-tint); } }
.mgh__btn { font-family: inherit; font-weight: 600; color: var(--btn-ink); background: var(--blue); border: none; border-radius: var(--r-pill); cursor: pointer; transition: background 0.16s var(--ease-out); }
.mgh__btn--sm { padding: 10px 20px; font-size: 14px; }
.mgh__btn--block { width: calc(100% - 80px); margin: 16px 40px 20px; padding: 15px; font-size: 16px; }
@media (hover: hover) and (pointer: fine) { .mgh__btn:hover { background: var(--blue-strong); } }
.mgh__burger { position: relative; width: 40px; height: 40px; border: none; background: none; cursor: pointer; }
.mgh__burger span, .mgh__burger span::before, .mgh__burger span::after { content: ''; position: absolute; left: 9px; width: 22px; height: 2px; border-radius: 2px; background: var(--ink); transition: transform 0.28s var(--ease-out), background 0.1s; }
.mgh__burger span { top: 19px; }
.mgh__burger span::before { top: -7px; }
.mgh__burger span::after { top: 7px; }
.mgh__burger span.is-x { background: transparent; }
.mgh__burger span.is-x::before { transform: translateY(7px) rotate(45deg); }
.mgh__burger span.is-x::after { transform: translateY(-7px) rotate(-45deg); }
.mgh-fade-enter-active, .mgh-fade-leave-active { transition: opacity 0.25s var(--ease-out), transform 0.25s var(--ease-out); }
.mgh-fade-enter-from, .mgh-fade-leave-to { opacity: 0; transform: translateY(-6px); }
.mgh__menu { position: absolute; top: 100%; left: 0; right: 0; background: #fff; border-bottom: 1px solid var(--line); box-shadow: 0 20px 40px -24px rgba(9, 23, 71, 0.4); opacity: 0; transform: translateY(-8px); pointer-events: none; transition: opacity 0.25s var(--ease-out), transform 0.25s var(--ease-out); }
.mgh__menu.is-open { opacity: 1; transform: none; pointer-events: auto; }
.mgh__menu-nav { display: grid; padding: 10px 40px 0; }
.mgh__menu-nav a { padding: 13px 4px; color: var(--ink); text-decoration: none; font-weight: 600; font-size: 17px; border-bottom: 1px solid var(--line); }
@media (prefers-reduced-motion: reduce) { .mgh, .mgh__menu, .mgh-fade-enter-active, .mgh-fade-leave-active { transition: none; } }
@media (max-width: 900px) {
    .mgh__in { padding-inline: 22px; }
    .mgh__links { display: none; }
    .mgh__menu-nav { padding-inline: 22px; }
    .mgh__btn--block { margin-inline: 22px; width: calc(100% - 44px); }
}
</style>
