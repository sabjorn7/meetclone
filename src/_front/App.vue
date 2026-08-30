<template>
    <AppHeader v-if="useNewChrome" />
    <!-- wwFront:start -->
    <router-view />
    <!-- wwFront:end -->
    <AppFooter v-if="useNewChrome" />
</template>

<script>
import { reactive, computed, provide, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppHeader from '@/_front/chrome/AppHeader.vue';
import AppFooter from '@/_front/chrome/AppFooter.vue';
import { isLikelyLoggedIn } from '@/_front/chrome/headerAccount.js';

// The new MeetGuru chrome (AppHeader/AppFooter) is the DEFAULT on every route. This is a denylist,
// not an allowlist: to fast-rollback a single page to the old WeWeb chrome, add its normalized path
// here (one line, no mechanism change, no full revert). Empty ⇒ new chrome truly everywhere.
//
// Rollout batching: product/auth/dev pages start EXCLUDED (custom layouts, verifiable only live —
// e.g. /courses_manage restyles itself via coursesManageStyle.js). Remove a path from this list
// once that page is verified live with the fixed header. The hand-written pages (streams/faq/legal)
// are content-only now and rely on this chrome, so they are intentionally NOT excluded.
const CHROME_EXCLUDE = [
    // account / product ( /profile and /profile_page are redesigned — they get the new chrome)
    '/my_finanse', '/my_courses', '/dashboard', '/feedback',
    // creator management (courses_manage runs coursesManageStyle.js — verify before enabling)
    '/courses_manage', '/articles_manage',
    // admin
    '/superadmin',
    // auth utilities (login is a full-screen dedicated page — its own chrome, no AppHeader/Footer)
    '/login', '/login-demo', '/registration', '/reset_pw',
    // dev / internal
    '/components', '/testpage',
];
// Prefix exclusions for dynamic detail routes (a path is excluded if it STARTS WITH any of these).
// "/course/" uses the hand-written CoursePage, and "/articles/:slug" now uses the hand-written
// ArticlePage — both get the new chrome, so there are no prefix exclusions left.
const CHROME_EXCLUDE_PREFIX = [];

export default {
    components: { AppHeader, AppFooter },
    setup() {
        const wwFrontState = reactive({
            lang: computed(() => wwLib.$store.getters['front/getLang']),
            pageId: computed(() => wwLib.$store.getters['websiteData/getPageId']),
            screenSize: computed(() => wwLib.$store.getters['front/getScreenSize']),
            screenSizes: computed(() => wwLib.$store.getters['front/getScreenSizes']),
        });
        provide('wwFrontState', wwFrontState);

        const route = useRoute();
        const router = useRouter();
        // Normalize the trailing slash: direct hits on the live site (nginx) canonicalize
        // "/about_meet" -> "/about_meet/", which an exact match would miss.
        const normPath = (p) => (p || '').replace(/\/+$/, '') || '/';
        const useNewChrome = computed(() => {
            const p = normPath(route.path);
            return !CHROME_EXCLUDE.includes(p) && !CHROME_EXCLUDE_PREFIX.some((pre) => p.startsWith(pre));
        });
        // Toggle the gate class per route so the (non-scoped) CSS below hides the WeWeb chrome only
        // where our chrome is active, and excluded pages keep their original WeWeb header.
        watch(useNewChrome, (on) => {
            document.documentElement.classList.toggle('mg-newchrome', on);
        }, { immediate: true });

        // The home route "/" is the logged-in dashboard ("моя страница"). Guests get redirected to
        // the public catalog instead of an empty "Здравствуйте, undefined" dashboard. Lives here
        // (not in a router guard) because router.js is a large generated file that the Rolldown
        // build chokes on when edited; App.vue is the safe place to hook route changes.
        //
        // "Logged in?" is decided by isLikelyLoggedIn() (headerAccount.js): the sb-refresh/access
        // cookie OR a persisted localStorage session — NOT sb.auth.getSession() (which can hang on
        // Web Locks) and NOT localStorage alone (which can be stale/cleared, wrongly bouncing a real
        // user). It fails OPEN, so we only ever redirect when we are confident this is a guest.
        function redirectGuestFromHome(path) {
            if (normPath(path) !== '/') return;
            if (!isLikelyLoggedIn()) router.replace('/all_course');
        }
        watch(() => route.path, redirectGuestFromHome, { immediate: true });

        return { useNewChrome };
    },
};
</script>

<style>
/* Site-wide (gate class always on <html>): hide the WeWeb header/footer by their exact, stable
   full-width root uids — the same component is reused on ~30 pages — and reserve space for our
   fixed AppHeader. Pages without that WeWeb header (dashboard/superadmin/promo) simply get ours. */
html.mg-newchrome [data-ww-uid="5d7431c2-133c-4b05-af3f-e3be61b55c8d"],
html.mg-newchrome [data-ww-uid="97853efe-ba2f-4544-9a3e-4681403f71a8"] {
    display: none !important;
}
html.mg-newchrome #app {
    padding-top: 62px;
}
</style>
