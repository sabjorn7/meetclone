// Hand-written "Город" (city) input on the logged-in user's own account-edit page (route `profile`),
// mounted the same way as mySubscriptions.js (see its header for why the wwObjects pipeline is bypassed).
// The WeWeb form's "Сохранить" updates its own fields only, so city saves independently (on blur / Enter)
// straight to public.users.city via the shared Supabase client. RLS is off project-wide.
// NOTE: requires the column — `alter table public.users add column city text;`.
import { createApp, h, computed, ref, watch } from 'vue';

const PROFILE_OWN_PAGE_ID = '92ec31d3-970a-4fa4-9a30-db92e6b3a03d';
const CURRENT_USER_COLLECTION_ID = 'ebe8a1ca-0b4e-494f-a496-5e281d06bd16';
const AUTH_PLUGIN_ID = '1fa0dd68-5069-436c-9a7d-3b54c340f1fa';
const ANCHOR_UID = '838d987e-e082-4b0b-b099-d9b7cecde8ac'; // INP | Username — city is inserted right after it
const CONTAINER_ID = 'profile-city-root';
const MOUNT_TIMEOUT_MS = 15000;

let mountedApp = null;
let observer = null;
let timeoutId = null;

function supa() { return wwLib.wwPlugins?.supabase?.instance || null; }

const ProfileCity = {
    setup() {
        const city = ref('');
        const saving = ref(false);
        const saved = ref(false);
        let lastSaved = '';

        const collections = () => wwLib.$store.getters['data/getCollections'];
        const meId = computed(() => collections()?.[CURRENT_USER_COLLECTION_ID]?.data?.[0]?.id || null);
        const isVisible = computed(() => !!wwLib.wwPlugins?.[AUTH_PLUGIN_ID]?.isAuthenticated && !!meId.value);

        // Load the current city directly (the WeWeb currentUser collection may not select the new column).
        watch(meId, async (id) => {
            const client = supa();
            if (!client || !id) return;
            const { data } = await client.from('users').select('city').eq('id', id).limit(1);
            city.value = data?.[0]?.city || '';
            lastSaved = city.value;
        }, { immediate: true });

        async function save() {
            const client = supa();
            const val = city.value.trim();
            if (!client || !meId.value || val === lastSaved) return;
            saving.value = true; saved.value = false;
            try {
                const { error } = await client.from('users').update({ city: val || null }).eq('id', meId.value);
                if (!error) {
                    lastSaved = val;
                    // keep the WeWeb currentUser collection row in sync so a re-render doesn't clobber it
                    const m = collections()?.[CURRENT_USER_COLLECTION_ID]?.data?.[0]; if (m) m.city = val || null;
                    saved.value = true; setTimeout(() => { saved.value = false; }, 2000);
                }
            } finally { saving.value = false; }
        }

        return { city, saving, saved, isVisible, save };
    },
    render() {
        if (!this.isVisible) return null;
        return h('div', { id: 'profile-city-block', style: { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '16px' } }, [
            h('input', {
                value: this.city,
                onInput: (e) => { this.city = e.target.value; },
                onBlur: () => this.save(),
                onKeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } },
                placeholder: 'Город',
                'aria-label': 'Город',
                style: {
                    width: '100%', boxSizing: 'border-box', height: '44px', padding: '0 16px',
                    border: '1px solid #E3E7EE', borderRadius: '8px', background: '#FFFFFF',
                    fontFamily: 'inherit', fontSize: '15px', color: '#1B1F27', outline: 'none',
                },
            }),
            h('div', { style: { fontSize: '12px', color: '#8A94A6', lineHeight: 1.4 } },
                this.saving ? 'Сохранение…' : this.saved ? 'Сохранено ✓' : 'Ваш город. Появится в публичном профиле и в фильтре каталога специалистов.'),
        ]);
    },
};

function clearWaiters() {
    if (observer) { observer.disconnect(); observer = null; }
    if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
}
function unmount() {
    clearWaiters();
    if (mountedApp) { mountedApp.unmount(); mountedApp = null; }
    document.getElementById(CONTAINER_ID)?.remove();
}
function tryMount() {
    if (mountedApp || document.getElementById(CONTAINER_ID)) return;
    const anchor = document.querySelector(`[class*="ww-element-${ANCHOR_UID}"]`);
    if (!anchor?.parentNode) return;
    const container = document.createElement('div');
    container.id = CONTAINER_ID;
    anchor.parentNode.insertBefore(container, anchor.nextSibling);
    mountedApp = createApp(ProfileCity);
    mountedApp.mount(container);
    clearWaiters();
}
function waitAndMount() {
    tryMount();
    if (mountedApp) return;
    observer = new MutationObserver(tryMount);
    observer.observe(document.body, { childList: true, subtree: true });
    timeoutId = setTimeout(clearWaiters, MOUNT_TIMEOUT_MS);
}
function isOwnProfileRoute(route) {
    return !!route?.name && route.name.startsWith(`page-${PROFILE_OWN_PAGE_ID}`);
}

export function initProfileCity(router) {
    if (isOwnProfileRoute(router.currentRoute.value)) waitAndMount();
    router.afterEach((to) => {
        unmount();
        if (isOwnProfileRoute(to)) waitAndMount();
    });
}
