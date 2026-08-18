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
import { getSupabase } from '@/_front/chrome/headerAccount.js';

// Marketing/public routes that get the new MeetGuru chrome (AppHeader/AppFooter). Add or remove
// paths here — membership is an exact route.path match. Phase 2 starts with /about_meet only.
const NEW_CHROME_ROUTES = ['/', '/about_meet', '/all_course', '/articles', '/clubs', '/chats', '/users'];

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
        const useNewChrome = computed(() => NEW_CHROME_ROUTES.includes(normPath(route.path)));
        // Toggle the gate class so the (non-scoped) CSS below hides the WeWeb chrome only here.
        watch(useNewChrome, (on) => {
            document.documentElement.classList.toggle('mg-newchrome', on);
        }, { immediate: true });

        // The home route "/" is the logged-in dashboard ("моя страница"). Guests get redirected to
        // the public catalog instead of an empty "Здравствуйте, undefined" dashboard. Lives here
        // (not in a router guard) because router.js is a large generated file that the Rolldown
        // build chokes on when edited; App.vue is the safe place to hook route changes.
        async function redirectGuestFromHome(path) {
            if (normPath(path) !== '/') return;
            try {
                const sb = getSupabase();
                if (!sb) return;
                const { data } = await sb.auth.getSession();
                if (!data?.session?.user) router.replace('/all_course');
            } catch (e) { /* on any auth error, stay put */ }
        }
        watch(() => route.path, redirectGuestFromHome, { immediate: true });

        return { useNewChrome };
    },
};
</script>

<style>
/* Active only on allow-listed routes (gate class on <html>): hide the WeWeb header/footer by their
   exact, stable full-width root uids, and reserve space for our fixed AppHeader. */
html.mg-newchrome [data-ww-uid="5d7431c2-133c-4b05-af3f-e3be61b55c8d"],
html.mg-newchrome [data-ww-uid="97853efe-ba2f-4544-9a3e-4681403f71a8"] {
    display: none !important;
}
html.mg-newchrome #app {
    padding-top: 62px;
}
</style>
