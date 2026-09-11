<template>
    <LegalPage title="Правила отмены участия и возврата денежных средств Meetguru" :docs="docs" />
</template>

<script setup>
import LegalPage from './LegalPage.vue';
import html from './pravila_otmeny.html?raw';

const docs = [{ label: '', html }];
</script>
