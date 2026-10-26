<template>
    <div v-if="visible" class="pt">
        <!-- iPhone без установки на экран «Домой»: web-push там недоступен → подсказка вместо кнопки -->
        <p v-if="mode === 'ios-hint'" class="pt__hint">
            🔔 Чтобы получать уведомления на iPhone, добавьте МитГуру на экран «Домой»:
            <b>«Поделиться» → «На экран „Домой“»</b>, затем откройте приложение с иконки.
        </p>

        <!-- уже подписан: статус + выключить -->
        <template v-else-if="mode === 'subscribed'">
            <span class="pt__on">🔔 Уведомления включены</span>
            <button type="button" class="pt__link" :disabled="busy" @click="disable">{{ busy ? '…' : 'Выключить' }}</button>
        </template>

        <!-- заблокировано в настройках браузера -->
        <p v-else-if="mode === 'denied'" class="pt__hint">Уведомления заблокированы в настройках браузера.</p>

        <!-- можно включить -->
        <template v-else-if="mode === 'off'">
            <button type="button" class="pt__btn" :disabled="busy" @click="enable">{{ busy ? '…' : '🔔 Включить уведомления' }}</button>
            <span v-if="msg" class="pt__msg">{{ msg }}</span>
        </template>
    </div>
</template>

<script setup>
// Переиспользуемая кнопка подписки на веб-пуши. Видна ВСЕМ залогиненным (не гостям).
// Разрешение запрашивается ТОЛЬКО по клику. Сервер/allowlist не трогает.
import { ref, onMounted } from 'vue';
import { isPushSupported, subscribeToPush, unsubscribeFromPush, pushState } from '@/_front/chrome/pushClient.js';
import { readStoredSession, authCookieUser } from '@/_front/chrome/headerAccount.js';

const visible = ref(false);
const mode = ref('');     // 'off' | 'subscribed' | 'denied' | 'ios-hint'
const busy = ref(false);
const msg = ref('');

function isLoggedIn() {
    try { return !!(readStoredSession()?.user?.id || authCookieUser()?.id); } catch (_) { return false; }
}
function isIOS() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function isStandalone() {
    if (typeof window === 'undefined') return false;
    return window.navigator.standalone === true
        || (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches);
}

async function refresh() {
    if (!isLoggedIn()) { visible.value = false; return; }          // гостям не показываем
    if (isIOS() && !isStandalone()) { mode.value = 'ios-hint'; visible.value = true; return; }
    if (!isPushSupported()) { visible.value = false; return; }
    const s = await pushState();                                   // 'subscribed'|'off'|'denied'|'unsupported'
    if (s === 'unsupported') { visible.value = false; return; }
    mode.value = s;
    visible.value = true;
}

async function enable() {
    if (busy.value) return;
    busy.value = true; msg.value = '';
    try {
        const r = await subscribeToPush();
        if (r.ok) { mode.value = 'subscribed'; return; }
        const m = {
            unsupported: 'Уведомления недоступны в этом браузере.',
            no_vapid: 'Push ещё не настроен.',
            denied: 'Уведомления заблокированы в настройках браузера.',
            dismissed: 'Разрешение не выдано.',
            no_sw: 'Обновите страницу и попробуйте снова.',
            subscribe_failed: 'Не удалось подписаться.',
            save_failed: 'Не удалось сохранить подписку.',
        };
        msg.value = m[r.reason] || 'Не удалось включить уведомления.';
        if (r.reason === 'denied') mode.value = 'denied';
    } catch (_) { msg.value = 'Ошибка. Попробуйте ещё раз.'; }
    finally { busy.value = false; }
}

async function disable() {
    if (busy.value) return;
    busy.value = true; msg.value = '';
    try { await unsubscribeFromPush(); mode.value = 'off'; }
    catch (_) { msg.value = 'Не удалось выключить.'; }
    finally { busy.value = false; }
}

onMounted(refresh);
</script>

<style scoped>
.pt { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.pt__btn {
    padding: 8px 16px;
    border-radius: 999px;
    border: 1px solid var(--blue, #2563eb);
    background: transparent;
    color: var(--blue, #2563eb);
    font: 600 14px/1 inherit;
    cursor: pointer;
}
.pt__btn:disabled { opacity: 0.6; cursor: default; }
.pt__on { font-size: 14px; font-weight: 600; color: #15803d; }
.pt__link {
    border: none;
    background: none;
    padding: 0;
    color: #6b7280;
    font-size: 13px;
    text-decoration: underline;
    cursor: pointer;
}
.pt__link:disabled { opacity: 0.6; cursor: default; }
.pt__hint { margin: 0; font-size: 13px; line-height: 1.4; color: #6b7280; }
.pt__hint b { color: #374151; }
.pt__msg { font-size: 13px; color: #6b7280; }
</style>
