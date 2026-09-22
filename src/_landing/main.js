// Standalone marketing landing entry for meetgu.ru — a FULLY ISOLATED build (vite.landing.config.js
// → dist-landing/). No Vue Router, no Vuex/Pinia, no Supabase, no wwLib, no auth. Just the landing.
import { createApp } from 'vue';
import LandingApp from './LandingApp.vue';

createApp(LandingApp).mount('#app');
