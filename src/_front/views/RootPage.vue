<!--
  RootPage.vue — the app root "/" resolver.

  Guests see the public marketing LandingPage (the Tilda → self-host home); logged-in users see the
  HomePage dashboard ("моя страница"). This replaces the old behaviour where guests on "/" were
  redirected to /all_course (that redirect is removed from App.vue).

  "Logged in?" uses isLikelyLoggedIn() (headerAccount.js) — the sb-refresh/access cookie OR a
  persisted localStorage session, available synchronously on load. It fails OPEN (returns true only
  when confident), so a real user is never shown the guest landing by mistake; an actual guest with
  no session reliably gets the landing.
-->
<template>
    <LandingPage v-if="isGuest" />
    <HomePage v-else />
</template>

<script setup>
import { ref } from 'vue';
import LandingPage from './LandingPage.vue';
import HomePage from './HomePage.vue';
import { isLikelyLoggedIn } from '@/_front/chrome/headerAccount.js';

const isGuest = ref(!isLikelyLoggedIn());
</script>
