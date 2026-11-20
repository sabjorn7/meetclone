<template>
    <LegalPage title="Публичная оферта" :docs="docs" :related-links="relatedLinks" />
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import speaker from './speaker_agreement.html?raw';
import appendix from './speaker_agreement_appendix.html?raw';
import LegalPage from './LegalPage.vue';
import dogovor from './oferta_dogovor.html?raw';
import meropriyatiya from './oferta_meropriyatiya.html?raw';

const route = useRoute();
const relatedLinks = computed(() => ['speaker', 'speaker-appendix'].includes(route.query.tab) ? [
    { href: '/speaker-agreement', label: 'Агентский договор — отдельная страница' },
    { href: '/speaker-agreement-appendix', label: 'Приложение № 1 — отдельная страница' },
] : []);
const docs = [
    { tab: 'dogovor', aliases: ['kursy'], label: 'Для покупателей', html: dogovor },
    { tab: 'meropriyatiya', label: 'Очные мероприятия', html: meropriyatiya },
    { tab: 'speaker', label: 'Для спикеров', html: speaker },
    { tab: 'speaker-appendix', label: 'Приложение № 1', html: appendix },
];
</script>
