<template>
    <LegalPage title="Публичная оферта" :docs="docs" />
</template>

<script setup>
import LegalPage from './LegalPage.vue';
import dogovor from './oferta_dogovor.html?raw';
import licenziya from './oferta_licenziya.html?raw';
import meropriyatiya from './oferta_meropriyatiya.html?raw';

const docs = [
    { label: 'Договор', html: dogovor },
    { label: 'Продажа курсов', html: licenziya },
    { label: 'Очные мероприятия', html: meropriyatiya },
];
</script>
