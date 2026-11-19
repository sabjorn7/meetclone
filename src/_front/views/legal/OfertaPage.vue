<template>
    <LegalPage title="Публичная оферта" :docs="docs" />
</template>

<script setup>
import LegalPage from './LegalPage.vue';
import dogovor from './oferta_dogovor.html?raw';
import meropriyatiya from './oferta_meropriyatiya.html?raw';

const docs = [
    { tab: 'dogovor', aliases: ['kursy'], label: 'Для покупателей', html: dogovor },
    { tab: 'meropriyatiya', label: 'Очные мероприятия', html: meropriyatiya },
];
</script>
