<template>
    <LegalPage title="Согласие на обработку и распространение персональных данных" :docs="docs" />
</template>

<script setup>
import LegalPage from './LegalPage.vue';
import html from './soglasie_rasprostranenie.html?raw';

const docs = [{ label: '', html }];
</script>
