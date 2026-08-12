<template>
    <LegalPage title="Политика в отношении обработки персональных данных" :docs="docs" />
</template>

<script setup>
import LegalPage from './LegalPage.vue';
import html from './politika.html?raw';

const docs = [{ label: '', html }];
</script>
