<!--
  MyFinancePage.vue — hand-written замена WeWeb-страницы /my_finanse (PAGE_OVERRIDES вариант 1).
  Заголовок «Финансы» + баланс (из get_my_profile_private, НЕ из WeWeb-коллекции) + три вкладки
  с локальным state: «История заказов» / «История продаж» / «Вывод средств».
  Гость → /login. Данные — через закрытые RPC (6-pre/6a). Контент-only → общий chrome из App.vue.
-->
<template>
    <div class="mf-page">
        <h1 class="mf-title">Финансы</h1>

        <div class="mf-balance-card">
            <span class="mf-balance-label">Доступно для вывода</span>
            <span class="mf-balance-val">{{ financeState.loaded ? fmtMoney(financeState.balance) + ' руб.' : '—' }}</span>
        </div>

        <div class="mf-tabs" role="tablist">
            <button type="button" class="mf-tab" :class="{ 'mf-tab--on': tab === 'orders' }" role="tab" @click="tab = 'orders'">История заказов</button>
            <button type="button" class="mf-tab" :class="{ 'mf-tab--on': tab === 'sales' }" role="tab" @click="tab = 'sales'">История продаж</button>
            <button type="button" class="mf-tab" :class="{ 'mf-tab--on': tab === 'withdraw' }" role="tab" @click="tab = 'withdraw'">Вывод средств</button>
        </div>

        <div class="mf-panel">
            <div v-if="loadError" class="mf-loading mf-error">Не удалось загрузить. Обновите страницу.</div>
            <div v-else-if="!financeState.loaded" class="mf-loading">Загрузка…</div>
            <template v-else>
                <OrdersList v-if="tab === 'orders'" />
                <SalesList v-else-if="tab === 'sales'" />
                <WithdrawalTab v-else />
            </template>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { readStoredSession, authCookieUser } from '@/_front/chrome/headerAccount.js';
import { SalesList, OrdersList, WithdrawalTab, financeState, loadMyProfilePrivate, fmtMoney } from '@/_front/financeComponents.js';

const tab = ref('orders');
const loadError = ref(false);

onMounted(async () => {
    // Редирект на /login ТОЛЬКО если нет сессии.
    const uid = readStoredSession()?.user?.id || authCookieUser()?.id || null;
    if (!uid) { window.location.href = '/login'; return; }
    // Баланс/uid/почта/роль — из SECURITY DEFINER RPC (не из WeWeb-коллекции).
    // Сессия есть, но RPC не ответил (сеть/ошибка) → сообщение, НЕ редиректим на логин.
    const prof = await loadMyProfilePrivate();
    if (!prof) { loadError.value = true; }
});
</script>

<style>
.mf-page { max-width: 920px; margin: 0 auto; padding: 24px 16px 64px; width: 100%; box-sizing: border-box; }
.mf-page * { box-sizing: border-box; }
.mf-title { font-size: 28px; font-weight: 700; color: #1B1F27; margin: 8px 0 20px; }
.mf-balance-card { display: flex; flex-direction: column; gap: 4px; background: #F4F5F7; border-radius: 14px; padding: 16px 20px; margin-bottom: 20px; }
.mf-balance-label { font-size: 14px; color: #8A94A6; }
.mf-balance-val { font-size: 26px; font-weight: 700; color: #1B1F27; }
.mf-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid #ECEEF2; }
.mf-tab { appearance: none; border: 0; background: transparent; padding: 10px 14px; font-size: 15px; font-weight: 600; color: #8A94A6; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.mf-tab:hover { color: #1B1F27; }
.mf-tab--on { color: #5495F3; border-bottom-color: #5495F3; }
.mf-panel { width: 100%; }
.mf-loading { text-align: center; color: #8A94A6; padding: 32px; }
.mf-error { color: #E6052E; }

/* ---- Списки продаж/заказов (mfs-*, из myFinanseSales) ---- */
.mfs { display: flex; flex-direction: column; gap: 5px; width: 100%; box-sizing: border-box; }
.mfs * { box-sizing: border-box; }
.mfs-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; justify-content: center; margin-bottom: 12px; }
.mfs-flabel { color: #8A94A6; font-size: 14px; }
.mfs-input { height: 40px; border: 1px solid #E1E5EA; border-radius: 8px; padding: 0 12px; font-size: 14px; color: #1B1F27; background: #fff; }
.mfs-reset { height: 40px; border: 1px solid #5495F3; border-radius: 8px; background: #fff; color: #5495F3; font-size: 14px; font-weight: 600; padding: 0 16px; cursor: pointer; }
.mfs-total { text-align: center; font-size: 18px; font-weight: 500; margin: 4px 0 16px; color: #1B1F27; }
.mfs-head { display: flex; align-items: center; gap: 12px; padding: 10px 18px; background: #F4F5F7; border-radius: 10px; font-weight: 600; font-size: 14px; color: #1B1F27; }
.mfs-row { display: flex; align-items: center; gap: 12px; padding: 10px 18px; border-radius: 10px; border-bottom: 1px solid #ECEEF2; font-size: 15px; color: #1B1F27; }
.mfs-clickable { cursor: pointer; }
.mfs-clickable:hover { background: #f7f9fc; }
.mfs-c-name { flex: 2 1 0; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.mfs-c-buyer { flex: 2 1 0; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.mfs-c-paid { width: 120px; flex: none; }
.mfs-c-sum { width: 90px; text-align: center; flex: none; }
.mfs-c-date { width: 110px; text-align: center; flex: none; color: #8A94A6; }
.mfs-name { font-weight: 500; }
.mfs-sub { font-size: 13px; color: #8A94A6; overflow-wrap: anywhere; }
.mfs-buyer { font-weight: 500; }
.mfs-buyer-link { font-weight: 500; color: #5495F3; }
.mfs-dash { color: #B0B7C3; }
.mfs-paid-yes { color: #3BA55D; font-weight: 500; }
.mfs-paid-no { color: #8A94A6; }
.mfs-empty { text-align: center; color: #8A94A6; padding: 24px; }
.mfs-more { display: block; margin: 16px auto 0; padding: 10px 24px; border-radius: 8px; background: #fff; border: 1px solid #5495F3; color: #5495F3; font-size: 14px; font-weight: 600; cursor: pointer; }
.mfs-mobile-label { display: none; }

/* ---- Вывод средств (mfw-*, из myFinanseWithdrawal) ---- */
.mfw { display: flex; flex-direction: column; gap: 16px; width: 100%; box-sizing: border-box; }
.mfw * { box-sizing: border-box; }
.mfw-card { border: 1px solid #ECEEF2; border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.mfw-subhead { font-size: 16px; font-weight: 600; color: #1B1F27; }
.mfw-field { display: flex; flex-direction: column; gap: 4px; }
.mfw-label { font-size: 13px; color: #8A94A6; }
.mfw-input { height: 42px; border: 1px solid #E1E5EA; border-radius: 8px; padding: 0 12px; font-size: 15px; color: #1B1F27; background: #fff; width: 100%; }
.mfw-note { font-size: 13px; color: #92400e; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 8px 10px; }
.mfw-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 4px; }
.mfw-balance { font-size: 17px; font-weight: 600; color: #1B1F27; }
.mfw-wrow { display: flex; gap: 10px; flex-wrap: wrap; }
.mfw-amount { max-width: 200px; }
.mfw-btn { height: 42px; padding: 0 18px; border-radius: 8px; border: 1px solid #5495F3; background: #fff; color: #5495F3; font-size: 14px; font-weight: 600; cursor: pointer; }
.mfw-btn:disabled { opacity: .6; cursor: default; }
.mfw-btn-primary { background: #5495F3; color: #fff; }
.mfw-ok { color: #3BA55D; font-size: 14px; font-weight: 500; }
.mfw-err { color: #E6052E; font-size: 14px; font-weight: 500; }
.mfw-hrow { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #ECEEF2; font-size: 14px; flex-wrap: wrap; }
.mfw-hdate { color: #8A94A6; width: 92px; flex: none; }
.mfw-hsum { font-weight: 600; width: 110px; flex: none; }
.mfw-hst { font-weight: 600; }
.mfw-st-ok { color: #3BA55D; } .mfw-st-no { color: #E6052E; } .mfw-st-wait { color: #C79100; }
.mfw-hcom { color: #8A94A6; flex: 1 1 100%; }
.mfw-empty { color: #8A94A6; padding: 12px 0; }

@media (max-width: 640px) {
    .mf-title { font-size: 24px; }
    .mf-balance-val { font-size: 22px; }
    .mf-tab { padding: 10px 10px; font-size: 14px; }
    .mfs-head { display: none; }
    .mfs-row { flex-direction: column; align-items: stretch; gap: 4px; padding: 12px 4px; }
    .mfs-c-paid, .mfs-c-sum, .mfs-c-date { width: auto; text-align: left; flex: none; }
    .mfs-mobile-label { display: inline; color: #8A94A6; }
    .mfs-input { flex: 1 1 40%; }
}
</style>
