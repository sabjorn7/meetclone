<template>
    <LegalPage title="Пользовательское соглашение" :docs="docs" />
</template>

<script setup>
import LegalPage from './LegalPage.vue';
import html from './soglashenie.html?raw';

const docs = [{ label: '', html }];
</script>
