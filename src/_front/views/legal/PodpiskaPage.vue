<template>
    <LegalPage title="Условия подписки и регулярных платежей" :docs="docs" />
</template>

<script setup>
import LegalPage from './LegalPage.vue';
import html from './podpiska.html?raw';

const docs = [{ label: '', html }];
</script>
