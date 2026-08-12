<template>
    <LegalPage title="Согласие на обработку персональных данных" :docs="docs" />
</template>

<script setup>
import LegalPage from './LegalPage.vue';
import html from './soglasie.html?raw';

const docs = [{ label: '', html }];
</script>
