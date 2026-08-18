<!--
  AppHeader.vue — shared MeetGuru site header. Logo + centered nav + cart (live total) + account
  (avatar/dropdown, auth-aware) + burger menu. Self-contained styles + tokens + font so it renders
  on any route. Account/cart data + checkout live in ./headerAccount.js (money-adjacent isolated).

  Props:
    ctaLabel   — optional CTA button text (e.g. "Записаться · 3 500 ₽"). Empty = no CTA.
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

                <!-- CART -->
                <div class="mgh__pop" ref="cartPop">
                    <button class="mgh__icon" type="button" :aria-expanded="open === 'cart' ? 'true' : 'false'" aria-label="Корзина" @click="toggle('cart')">
                        <svg viewBox="0 0 24 24" class="mgh__ic"><path d="M6 6h15l-1.6 8.5a2 2 0 0 1-2 1.6H9.4a2 2 0 0 1-2-1.6L5.2 4H3"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17.5" cy="20" r="1.3"/></svg>
                        <span v-if="cart.length" class="mgh__badge">{{ cart.length }}</span>
                    </button>
                    <div v-if="open === 'cart'" class="mgh__dd mgh__dd--cart">
                        <template v-if="cart.length">
                            <ul class="mgh__cart-list">
                                <li v-for="item in cart" :key="item.id">
                                    <span class="mgh__cart-name">{{ item.course_name || 'Курс' }}</span>
                                    <span class="mgh__cart-price">{{ money(item.price) }} ₽</span>
                                    <button class="mgh__cart-x" type="button" aria-label="Убрать" @click="remove(item.id)">×</button>
                                </li>
                            </ul>
                            <div class="mgh__cart-total"><span>Итого</span><b>{{ money(total) }} ₽</b></div>
                            <button class="mgh__btn mgh__btn--block" type="button" :disabled="busy" @click="doCheckout">
                                {{ busy ? 'Переход к оплате…' : 'Оформить заказ' }}
                            </button>
                            <p v-if="err" class="mgh__err">{{ err }}</p>
                        </template>
                        <p v-else class="mgh__empty">Корзина пуста</p>
                    </div>
                </div>

                <!-- ACCOUNT -->
                <div v-if="user" class="mgh__pop" ref="acctPop">
                    <button class="mgh__avatar" type="button" :aria-expanded="open === 'acct' ? 'true' : 'false'" aria-label="Аккаунт" @click="toggle('acct')">
                        <img v-if="avatar" :src="avatar" alt="" @error="avatar = ''" />
                        <span v-else>{{ initialsStr }}</span>
                    </button>
                    <div v-if="open === 'acct'" class="mgh__dd mgh__dd--acct">
                        <div class="mgh__acct-head">{{ user.Name || user.email }}</div>
                        <a href="/profile" @click.prevent="go('/profile')">Профиль</a>
                        <a href="/my_courses" @click.prevent="go('/my_courses')">Мои курсы</a>
                        <a href="/my_finanse" @click.prevent="go('/my_finanse')">Финансы<span v-if="user.Ammount != null" class="mgh__bal">{{ money(user.Ammount) }} ₽</span></a>
                        <a href="/chats" @click.prevent="go('/chats')">Чаты</a>
                        <hr />
                        <button class="mgh__logout" type="button" @click="doSignOut">Выйти</button>
                    </div>
                </div>
                <div v-else class="mgh__auth">
                    <a class="mgh__login" href="/login" @click.prevent="go('/login')">Войти</a>
                    <button class="mgh__btn mgh__btn--sm" type="button" @click="go('/registration')">Регистрация</button>
                </div>

                <button class="mgh__burger" type="button" :aria-expanded="menuOpen ? 'true' : 'false'" aria-label="Меню" @click="menuOpen = !menuOpen">
                    <span :class="{ 'is-x': menuOpen }"></span>
                </button>
            </div>
        </div>

        <div class="mgh__menu" :class="{ 'is-open': menuOpen }">
            <nav class="mgh__menu-nav" aria-label="Меню сайта">
                <a v-for="i in menuItems.slice(0, 3)" :key="i.path" :href="i.path" @click.prevent="go(i.path)">{{ i.label }}</a>
                <template v-if="user">
                    <a href="/profile" @click.prevent="go('/profile')">Профиль</a>
                    <a href="/my_courses" @click.prevent="go('/my_courses')">Мои курсы</a>
                    <a href="/my_finanse" @click.prevent="go('/my_finanse')">Финансы</a>
                    <a href="/chats" @click.prevent="go('/chats')">Чаты</a>
                    <a href="#" @click.prevent="doSignOut">Выйти</a>
                </template>
                <template v-else>
                    <a href="/login" @click.prevent="go('/login')">Войти</a>
                    <a href="/registration" @click.prevent="go('/registration')">Регистрация</a>
                </template>
            </nav>
            <button v-if="ctaLabel" class="mgh__btn mgh__btn--block" type="button" @click="$emit('cta')">{{ ctaLabel }}</button>
        </div>
    </header>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
    getSupabase, loadUser, avatarUrl, initials, loadCart, removeCartItem, cartTotal, signOutUser, checkoutCart,
} from './headerAccount.js';

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
const route = useRoute();

const menuOpen = ref(false);
const open = ref(null);          // 'cart' | 'acct' | null
const stuck = ref(false);
const user = ref(null);
const avatar = ref('');
const cart = ref([]);
const busy = ref(false);
const err = ref('');

const total = computed(() => cartTotal(cart.value));
const initialsStr = computed(() => initials(user.value));
function money(n) { return Number(n || 0).toLocaleString('ru-RU'); }

const sb = getSupabase();

function toggle(which) { open.value = open.value === which ? null : which; }
function go(path) { open.value = null; menuOpen.value = false; router.push(path); }

async function refreshUser() {
    user.value = await loadUser(sb);
    avatar.value = avatarUrl(user.value);
    if (user.value) reloadCart(); else cart.value = [];
}
async function reloadCart() {
    if (user.value?.id) cart.value = await loadCart(sb, user.value.id);
}
async function remove(id) {
    await removeCartItem(sb, id);
    await reloadCart();
}
async function doCheckout() {
    if (busy.value || !cart.value.length) return;
    busy.value = true; err.value = '';
    try { await checkoutCart(sb, { user: user.value, cart: cart.value }); }
    catch (e) { err.value = e?.message || 'Ошибка оформления'; busy.value = false; }
}
async function doSignOut() {
    await signOutUser(sb);
    user.value = null; cart.value = []; open.value = null; menuOpen.value = false;
    router.push('/login');
}

// close dropdowns + burger menu on outside click / Escape
function onDocClick(e) {
    if (open.value && !e.target.closest?.('.mgh__pop')) open.value = null;
    if (menuOpen.value && !e.target.closest?.('.mgh')) menuOpen.value = false;
}
function onKey(e) { if (e.key === 'Escape') { open.value = null; menuOpen.value = false; } }

// scroll threshold (boolean toggle, passive) for the optional CTA
let onScroll, cartChannel, authSub;
onMounted(() => {
    ensureFont();
    onScroll = () => { stuck.value = window.scrollY > props.stuckAfter; };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);

    refreshUser();
    // live cart: `shop` is realtime-enabled — reload on any change to this user's rows.
    if (sb) {
        authSub = sb.auth.onAuthStateChange(() => refreshUser());
        cartChannel = sb.channel('mgh-cart')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shop' }, () => reloadCart())
            .subscribe();
    }
});
onBeforeUnmount(() => {
    if (onScroll) window.removeEventListener('scroll', onScroll);
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onKey);
    try { authSub?.data?.subscription?.unsubscribe?.(); } catch (e) { /* noop */ }
    try { if (cartChannel && sb) sb.removeChannel(cartChannel); } catch (e) { /* noop */ }
});

// fallback: re-sync the cart when the route changes (covers any missed realtime event)
watch(() => route.path, () => { open.value = null; if (user.value) reloadCart(); });

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
    --ink: #091747; --ink-2: #566058; --line: #e4e9f1; --blue: #2e70dd; --blue-strong: #2360c6; --blue-ink: #1f5fc9; --blue-tint: #eaf1fe; --orange: #f0751f; --btn-ink: #fff;
    --r-pill: 999px; --r-md: 14px; --ease-out: cubic-bezier(0.23, 1, 0.32, 1); --shadow: 0 20px 44px -24px rgba(9, 23, 71, 0.42);
    position: fixed; inset: 0 0 auto 0; z-index: 50;
    background: rgba(255, 255, 255, 0.92); backdrop-filter: saturate(160%) blur(12px);
    border-bottom: 1px solid var(--line); font-family: 'Onest', system-ui, -apple-system, sans-serif;
    transition: box-shadow 0.3s var(--ease-out);
}
.mgh.is-stuck { box-shadow: 0 6px 24px -18px rgba(9, 23, 71, 0.4); }
/* logo | centered nav | right cluster */
.mgh__in { width: 100%; max-width: 1200px; margin-inline: auto; padding-inline: 40px; height: 62px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 20px; }
.mgh__logo { justify-self: start; font-weight: 800; font-size: 22px; letter-spacing: -0.03em; color: var(--ink); text-decoration: none; }
.mgh__logo span { color: var(--blue); }
.mgh__links { justify-self: center; display: flex; gap: 28px; }
.mgh__links a { color: var(--ink); text-decoration: none; font-weight: 500; font-size: 15px; transition: color 0.18s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .mgh__links a:hover { color: var(--blue-ink); } }
.mgh__right { justify-self: end; display: flex; align-items: center; gap: 12px; }
.mgh__ic { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; display: block; }

/* buttons */
.mgh__btn { font-family: inherit; font-weight: 600; color: var(--btn-ink); background: var(--blue); border: none; border-radius: var(--r-pill); cursor: pointer; transition: background 0.16s var(--ease-out); }
.mgh__btn--sm { padding: 9px 18px; font-size: 14px; }
.mgh__btn--block { display: block; width: 100%; padding: 13px; font-size: 15px; margin-top: 10px; }
.mgh__btn:disabled { opacity: 0.6; cursor: default; }
@media (hover: hover) and (pointer: fine) { .mgh__btn:not(:disabled):hover { background: var(--blue-strong); } }

/* icon buttons (cart) + avatar */
.mgh__pop { position: relative; display: flex; }
.mgh__icon { position: relative; display: grid; place-items: center; width: 40px; height: 40px; border: none; border-radius: var(--r-pill); background: none; color: var(--ink); cursor: pointer; transition: background 0.18s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .mgh__icon:hover { background: var(--blue-tint); } }
.mgh__badge { position: absolute; top: 2px; right: 2px; min-width: 17px; height: 17px; padding: 0 4px; display: grid; place-items: center; border-radius: 999px; background: var(--orange); color: #fff; font-size: 11px; font-weight: 700; line-height: 1; }
.mgh__avatar { width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--line); background: var(--blue-tint); color: var(--blue-ink); font-weight: 700; font-size: 13px; cursor: pointer; overflow: hidden; display: grid; place-items: center; padding: 0; }
.mgh__avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }

/* auth (logged-out) */
.mgh__auth { display: flex; align-items: center; gap: 12px; }
.mgh__login { color: var(--ink); font-weight: 600; font-size: 15px; text-decoration: none; }
@media (hover: hover) and (pointer: fine) { .mgh__login:hover { color: var(--blue-ink); } }

/* dropdowns */
.mgh__dd { position: absolute; top: calc(100% + 10px); right: 0; background: #fff; border: 1px solid var(--line); border-radius: var(--r-md); box-shadow: var(--shadow); padding: 10px; z-index: 10; }
.mgh__dd--cart { width: 320px; }
.mgh__dd--acct { width: 240px; display: grid; }
.mgh__dd--acct a, .mgh__logout { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 8px; color: var(--ink); text-decoration: none; font-weight: 500; font-size: 15px; background: none; border: none; width: 100%; text-align: left; cursor: pointer; font-family: inherit; }
@media (hover: hover) and (pointer: fine) { .mgh__dd--acct a:hover, .mgh__logout:hover { background: var(--blue-tint); } }
.mgh__acct-head { padding: 8px 12px 10px; font-weight: 700; color: var(--ink); border-bottom: 1px solid var(--line); margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mgh__bal { color: var(--blue-ink); font-weight: 700; font-size: 13px; }
.mgh__dd--acct hr { border: none; border-top: 1px solid var(--line); margin: 4px 0; }
.mgh__logout { color: #c2410c; }

.mgh__empty { padding: 18px 12px; text-align: center; color: var(--ink-2); }
.mgh__cart-list { list-style: none; margin: 0 0 8px; padding: 0; max-height: 260px; overflow-y: auto; }
.mgh__cart-list li { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 10px; padding: 9px 6px; border-bottom: 1px solid var(--line); }
.mgh__cart-name { font-size: 14px; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mgh__cart-price { font-weight: 700; font-size: 14px; }
.mgh__cart-x { border: none; background: none; color: var(--ink-2); font-size: 18px; line-height: 1; cursor: pointer; padding: 0 2px; }
.mgh__cart-x:hover { color: #c2410c; }
.mgh__cart-total { display: flex; justify-content: space-between; align-items: baseline; padding: 10px 6px 2px; font-size: 15px; }
.mgh__cart-total b { font-size: 18px; letter-spacing: -0.01em; }
.mgh__err { margin: 8px 0 0; color: #c2410c; font-size: 13px; }

/* burger */
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
.mgh__menu-nav a { padding: 13px 4px; color: var(--ink); text-decoration: none; font-weight: 600; font-size: 17px; text-align: center; border-bottom: 1px solid var(--line); }
.mgh__menu .mgh__btn--block { margin: 16px 40px 20px; width: calc(100% - 80px); }

@media (prefers-reduced-motion: reduce) { .mgh, .mgh__menu, .mgh-fade-enter-active, .mgh-fade-leave-active { transition: none; } }
@media (max-width: 900px) {
    .mgh__in { padding-inline: 22px; grid-template-columns: auto 1fr auto; }
    .mgh__links { display: none; }
    .mgh__menu-nav { padding-inline: 22px; }
    .mgh__menu .mgh__btn--block { margin-inline: 22px; width: calc(100% - 44px); }
    .mgh__auth .mgh__btn--sm { display: none; } /* keep just "Войти" + burger on mobile */
    .mgh__dd--cart { width: min(320px, calc(100vw - 44px)); }
}
</style>
