<!--
  InstallPrompt.vue — dismissible "add to home screen" prompt for the PWA.
  - Android / desktop Chrome: a real "Установить" button driving the captured beforeinstallprompt
    (wwLib.installPwaPrompt, stashed in main.js).
  - iOS Safari: instructions banner (iOS gives no programmatic prompt) — Share → "На экран «Домой»".
  Shown ONLY on the home / «Мои курсы» dashboard ('/'), and only 10s after landing there. Hidden when
  already installed (standalone), dismissed within the last 14 days, or there is nothing to offer.
  Self-contained styles; rendered once by App.vue alongside the shared chrome.
-->
<template>
    <transition name="ip-slide">
        <div v-if="show" class="ip" role="dialog" aria-label="Установка приложения МитГуру">
            <div class="ip__in">
                <img class="ip__icon" src="/images/apple-touch-180.png" alt="" width="44" height="44" />
                <div class="ip__text">
                    <b>Установить «МитГуру»</b>
                    <span v-if="mode === 'android'">Быстрый доступ с экрана «Домой», как у обычного приложения.</span>
                    <span v-else>
                        Нажмите «Поделиться»
                        <svg class="ip__share" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M12 3l-4 4M12 3l4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/></svg>
                        и выберите «На экран „Домой“».
                    </span>
                </div>
                <div class="ip__actions">
                    <button v-if="mode === 'android'" type="button" class="ip__btn" @click="install">Установить</button>
                    <button type="button" class="ip__x" aria-label="Закрыть" @click="dismiss">×</button>
                </div>
            </div>
        </div>
    </transition>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

// Only the home / «Мои курсы» dashboard. ('/my_courses' is the lesson player — excluded.)
const ALLOWED = ['/'];
const DISMISS_KEY = 'mg_install_dismissed';
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000; // re-show no sooner than 14 days after a dismissal
const DELAY_MS = 10000;                       // show 10s after landing on an allowed page

const show = ref(false);
const mode = ref('android'); // 'android' | 'ios'
let delayTimer = null;
let bipHandler = null;
let installedHandler = null;

const normPath = (p) => (p || '').replace(/\/+$/, '') || '/';
const onAllowed = () => ALLOWED.includes(normPath(route.path));

function isStandalone() {
    try {
        return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    } catch (_) { return false; }
}
function recentlyDismissed() {
    try {
        const v = localStorage.getItem(DISMISS_KEY);
        if (!v) return false;
        if (v === '1') return true; // legacy flag → treat as "dismissed just now"
        const ts = Number(v);
        return Number.isFinite(ts) && (Date.now() - ts) < DISMISS_MS;
    } catch (_) { return false; }
}
function isIosSafari() {
    const ua = navigator.userAgent || '';
    const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!ios) return false;
    // Positive Safari detection: real Safari carries a Version/x.y token before "Safari". In-app
    // browsers (and non-Safari iOS browsers) either lack it or carry their own token — they can't A2HS.
    const isSafari = /Version\/[\d.]+.*Safari/i.test(ua);
    const inApp = /crios|fxios|edgios|opios|yabrowser|fban|fbav|instagram|telegram|vkclient|line\/|snapchat|twitter/i.test(ua);
    return isSafari && !inApp;
}

// What can we offer right now (or null)? Also decides android vs ios.
function computeOffer() {
    if (isStandalone() || recentlyDismissed()) return null;
    if (window.wwLib?.installPwaPrompt) return 'android';
    if (isIosSafari()) return 'ios';
    return null;
}

function clearTimer() {
    if (delayTimer) { clearTimeout(delayTimer); delayTimer = null; }
}

// Re-evaluate on mount / nav / late beforeinstallprompt: hide if we left the page or lost eligibility,
// otherwise arm a 10s dwell timer before showing.
function refresh() {
    const offer = computeOffer();
    if (!onAllowed() || !offer) { show.value = false; clearTimer(); return; }
    mode.value = offer;
    if (show.value || delayTimer) return; // already shown or already scheduled
    delayTimer = setTimeout(() => {
        delayTimer = null;
        const o = computeOffer();
        if (onAllowed() && o) { mode.value = o; show.value = true; }
    }, DELAY_MS);
}

function dismiss() {
    show.value = false;
    clearTimer();
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (_) { /* ignore */ }
}

async function install() {
    const e = window.wwLib?.installPwaPrompt;
    if (!e) { show.value = false; return; }
    try {
        e.prompt();
        await e.userChoice; // accepted or not — either way stop offering
    } catch (_) { /* ignore */ }
    window.wwLib.installPwaPrompt = null;
    dismiss();
}

onMounted(() => {
    refresh();
    bipHandler = () => refresh();              // a late beforeinstallprompt (main.js stashes the event)
    window.addEventListener('beforeinstallprompt', bipHandler);
    installedHandler = () => dismiss();
    window.addEventListener('appinstalled', installedHandler);
});

// Leave an allowed page → hide at once; enter one → arm the dwell timer.
watch(() => route.path, () => refresh());

onBeforeUnmount(() => {
    clearTimer();
    if (bipHandler) window.removeEventListener('beforeinstallprompt', bipHandler);
    if (installedHandler) window.removeEventListener('appinstalled', installedHandler);
});
</script>

<style scoped>
.ip {
    position: fixed;
    left: 12px; right: 12px;
    bottom: calc(12px + env(safe-area-inset-bottom));
    z-index: 2147483000;
    display: flex; justify-content: center;
    pointer-events: none;
}
.ip__in {
    pointer-events: auto;
    display: flex; align-items: center; gap: 12px;
    width: 100%; max-width: 480px;
    padding: 12px 14px;
    background: #091747; color: #eaf0fb;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, .35);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, Arial, sans-serif;
}
.ip__icon { flex: 0 0 auto; width: 44px; height: 44px; border-radius: 10px; }
.ip__text { flex: 1 1 auto; min-width: 0; font-size: 13px; line-height: 1.35; color: #c3d2ee; }
.ip__text b { display: block; font-size: 14px; color: #fff; margin-bottom: 2px; }
.ip__share { width: 14px; height: 14px; vertical-align: -2px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.ip__actions { flex: 0 0 auto; display: flex; align-items: center; gap: 6px; }
.ip__btn {
    appearance: none; border: 0; cursor: pointer;
    background: #5495f3; color: #fff; font-weight: 600; font-size: 14px;
    padding: 9px 16px; border-radius: 10px;
    transition: background .15s ease;
}
.ip__btn:hover { background: #3f82e6; }
.ip__btn:active { background: #356fc9; }
.ip__x {
    appearance: none; border: 0; cursor: pointer; background: transparent;
    color: #8aa0c8; font-size: 22px; line-height: 1; width: 30px; height: 30px; border-radius: 8px;
}
.ip__x:hover { color: #fff; background: rgba(255, 255, 255, .08); }

.ip-slide-enter-active { transition: transform .28s cubic-bezier(0.23, 1, 0.32, 1), opacity .28s ease; }
.ip-slide-leave-active { transition: transform .2s ease, opacity .2s ease; }
.ip-slide-enter-from, .ip-slide-leave-to { transform: translateY(120%); opacity: 0; }
@media (prefers-reduced-motion: reduce) {
    .ip-slide-enter-active, .ip-slide-leave-active { transition: opacity .2s ease; }
    .ip-slide-enter-from, .ip-slide-leave-to { transform: none; opacity: 0; }
}
</style>
