<template>
    <div v-if="kind" class="mg-authbanner" :class="kind">
        <span v-if="kind === 'offline'">Плохая связь: вы временно не авторизованы.</span>
        <span v-else-if="kind === 'recovered'">Соединение восстановлено.</span>
        <span v-else-if="kind === 'reauth'">Не удалось продлить сессию.</span>
        <button v-if="kind === 'recovered' || (kind === 'offline' && showReload)" type="button" @click="reload">Обновить страницу</button>
        <a v-else-if="kind === 'reauth'" href="/login">Войти заново</a>
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

const kind = ref(window.__mgAuthBanner || '');
const showReload = ref(false);
let t = null;
function onBanner(e) { kind.value = e.detail; if (e.detail !== 'offline') showReload.value = true; }
function reload() { window.location.reload(); }
onMounted(() => {
    window.addEventListener('mg-auth-banner', onBanner);
    // offline: кнопку «Обновить» показываем только через 60с (вне reuse-окна) или при смене состояния
    if (kind.value === 'offline') t = setTimeout(() => { showReload.value = true; }, 60000);
});
onBeforeUnmount(() => { window.removeEventListener('mg-auth-banner', onBanner); if (t) clearTimeout(t); });
</script>

<style scoped>
.mg-authbanner {
    /* Снизу, а не сверху: фиксированная шапка AppHeader живёт на top:0 и баннер её перекрывал
       (на iPhone — вместе с гамбургером). env(safe-area-inset-bottom) уводит баннер над home-indicator. */
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;
    padding: 8px 14px; padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
    font: 14px/1.3 'Raleway', system-ui, sans-serif; text-align: center;
    background: #fde68a; color: #1f2733; box-shadow: 0 -2px 10px rgba(15, 23, 42, 0.12);
}
.mg-authbanner.recovered { background: #bbf7d0; }
.mg-authbanner.reauth { background: #fecaca; }
.mg-authbanner button, .mg-authbanner a { margin-left: 12px; font-weight: 600; cursor: pointer; color: inherit; }
</style>
