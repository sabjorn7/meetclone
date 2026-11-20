<template>
    <LegalPage title="Приложение № 1 к агентскому договору-оферте" :docs="docs" :related-links="relatedLinks" />
</template>

<script setup>
import LegalPage from './LegalPage.vue';
import html from './speaker_agreement_appendix.html?raw';
const docs = [{ label: '', html }];
const relatedLinks = [{ href: '/speaker-agreement', label: 'Агентский договор-оферта для спикеров' }];
</script>
