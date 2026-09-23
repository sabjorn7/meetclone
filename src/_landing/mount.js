// Shared mount for every page of the standalone meetgu.ru landing build: wraps the page component in
// the static LandingHeader + shared AppFooter and mounts to #app. No router / store / Supabase / auth.
import { createApp, h } from 'vue';
import LandingHeader from './LandingHeader.vue';
import AppFooter from '@/_front/chrome/AppFooter.vue';

export function mountLanding(PageComponent) {
    createApp({
        render: () => h('div', { class: 'landing-root' }, [
            h(LandingHeader),
            h(PageComponent),
            h(AppFooter, { note: '' }),
        ]),
    }).mount('#app');
}
