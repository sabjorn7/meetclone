<template>
    <LegalPage title="Реквизиты и юридическая информация" :docs="docs" />
</template>

<script setup>
import LegalPage from './LegalPage.vue';
import html from './rekvizity.html?raw';

const docs = [{ label: '', html }];
</script>
