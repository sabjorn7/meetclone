<template>
    <AppHeader v-if="useNewChrome" />
    <!-- wwFront:start -->
    <router-view />
    <!-- wwFront:end -->
    <AppFooter v-if="useNewChrome" />
</template>

<script>
import { reactive, computed, provide, watch } from 'vue';
import { useRoute } from 'vue-router';
import AppHeader from '@/_front/chrome/AppHeader.vue';
import AppFooter from '@/_front/chrome/AppFooter.vue';

// Marketing/public routes that get the new MeetGuru chrome (AppHeader/AppFooter). Add or remove
// paths here — membership is an exact route.path match. Phase 2 starts with /about_meet only.
const NEW_CHROME_ROUTES = ['/about_meet', '/all_course'];

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
        // Normalize the trailing slash: direct hits on the live site (nginx) canonicalize
        // "/about_meet" -> "/about_meet/", which an exact match would miss.
        const useNewChrome = computed(() => NEW_CHROME_ROUTES.includes(route.path.replace(/\/+$/, '') || '/'));
        // Toggle the gate class so the (non-scoped) CSS below hides the WeWeb chrome only here.
        watch(useNewChrome, (on) => {
            document.documentElement.classList.toggle('mg-newchrome', on);
        }, { immediate: true });

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
