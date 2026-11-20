<template>
    <LegalPage title="Агентский договор-оферта для спикеров" :docs="docs" :related-links="relatedLinks" />
</template>

<script setup>
import LegalPage from './LegalPage.vue';
import html from './speaker_agreement.html?raw';
const docs = [{ label: '', html }];
const relatedLinks = [{ href: '/speaker-agreement-appendix', label: 'Приложение № 1: платежи, возвраты, chargeback и расчёты' }];
</script>
