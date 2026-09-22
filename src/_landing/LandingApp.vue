<!--
  LandingApp.vue — root of the standalone meetgu.ru landing build.
  Reuses the shared LandingPage.vue and AppFooter.vue (both made router-optional); the header is a
  static LandingHeader (the app's AppHeader is auth/Supabase-heavy and NOT used here). A sticky header
  sits in normal flow, so no fixed-header padding hack is needed.
-->
<template>
    <div class="landing-root">
        <LandingHeader />
        <LandingPage />
        <AppFooter :note="''" />
    </div>
</template>

<script setup>
import LandingHeader from './LandingHeader.vue';
import LandingPage from '@/_front/views/LandingPage.vue';
import AppFooter from '@/_front/chrome/AppFooter.vue';
</script>

<style>
/* global reset for the standalone build (no App.vue chrome CSS here) */
html, body, #app { margin: 0; padding: 0; }
.landing-root { min-height: 100vh; }
</style>
