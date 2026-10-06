<template>
    <LegalPage title="Политика в отношении файлов cookie" :docs="docs" />
</template>

<script setup>
import LegalPage from './LegalPage.vue';
import html from './cookie.html?raw';

const docs = [{ label: '', html }];
</script>
