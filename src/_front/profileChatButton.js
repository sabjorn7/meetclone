// Hand-written, bypasses the wwObjects rendering pipeline entirely: on the production
// build (npm run build), a wwObject added by hand to public/data/<page>.json for
// profile_page was present in the Vuex store (confirmed via $store.state.websiteData)
// but never reached the DOM - a discrepancy only visible in the built/previewed app,
// not the dev server, and not reproducible from static analysis of wwLayout.vue or the
// generated CSS. Rather than depend on that pipeline for this one button, it's mounted
// here as an ordinary Vue app into a plain DOM node, reading the same reactive sources
// (collections, plugin state, page variables) that WeWeb's own formula evaluator reads
// (see src/_common/helpers/code/customCode.js), and navigating via the same
// wwLib.wwApp.goTo() helper the "change-page" workflow action itself calls.
import { createApp, h, computed, ref, onMounted, onUnmounted } from 'vue';

const PROFILE_PAGE_ID = '6ff5d3f0-8211-4a41-9774-a6e6a9d8e55d';
const CHATS_PAGE_ID = '371cded4-cfe8-4b30-bfc0-23b87e9f6d07';
const CHUSER_COLLECTION_ID = 'fc08d985-55cb-41e6-968d-9ce8f788a4f2';
const CURRENT_USER_COLLECTION_ID = 'ebe8a1ca-0b4e-494f-a496-5e281d06bd16';
const RESOLVED_PROFILE_USER_ID_VAR = '0a6bc2e7-9ab1-4980-8674-8cab02c89def';
const AUTH_PLUGIN_ID = '1fa0dd68-5069-436c-9a7d-3b54c340f1fa';
const CARD_ANCHOR_UID = '7611c661-3b49-42a3-a7d4-7b2075ace1a0';
const WWOBJECT_BUTTON_UID = 'c2600d0f-7919-43ec-8712-ce88eeac82df';
const CONTAINER_ID = 'profile-chat-button-root';
const MOUNT_TIMEOUT_MS = 15000;

let mountedApp = null;
let observer = null;
let timeoutId = null;

const ChatButton = {
    setup() {
        // The wwObjects-based button (same uid, added to public/data/<page>.json) can
        // render on its own with no fixed timing relative to this component's mount (it
        // waits on the same collections) - keep checking for as long as this component is
        // alive, not just once up front, and hide immediately if it ever shows up.
        const wwObjectRendered = ref(!!document.querySelector(`[class*="ww-element-${WWOBJECT_BUTTON_UID}"]`));
        let duplicateObserver = null;

        onMounted(() => {
            if (wwObjectRendered.value) return;
            duplicateObserver = new MutationObserver(() => {
                if (document.querySelector(`[class*="ww-element-${WWOBJECT_BUTTON_UID}"]`)) {
                    wwObjectRendered.value = true;
                    duplicateObserver.disconnect();
                    duplicateObserver = null;
                }
            });
            duplicateObserver.observe(document.body, { childList: true, subtree: true });
        });
        onUnmounted(() => {
            duplicateObserver?.disconnect();
            duplicateObserver = null;
        });

        const isVisible = computed(() => {
            if (wwObjectRendered.value) return false;
            if (!wwLib.wwPlugins?.[AUTH_PLUGIN_ID]?.isAuthenticated) return false;
            const collections = wwLib.$store.getters['data/getCollections'];
            const chUserId = collections?.[CHUSER_COLLECTION_ID]?.data?.[0]?.id;
            const currentUserId = collections?.[CURRENT_USER_COLLECTION_ID]?.data?.[0]?.id;
            return !!chUserId && chUserId !== currentUserId;
        });

        function onClick() {
            const targetId = wwLib.globalVariables.customCodeVariables[RESOLVED_PROFILE_USER_ID_VAR];
            if (!targetId) return;
            wwLib.wwApp.goTo(wwLib.wwPageHelper.getPagePath(CHATS_PAGE_ID), { user: targetId });
        }

        return { isVisible, onClick };
    },
    render() {
        if (!this.isVisible) return null;
        return h(
            'button',
            {
                type: 'button',
                onClick: this.onClick,
                style: {
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: 'fit-content',
                    margin: '10px auto 0 auto',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    background: '#FFFFFF',
                    border: '1px solid #5495F3',
                    color: '#5495F3',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                },
            },
            'Написать в чат'
        );
    },
};

function clearWaiters() {
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
    }
}

function unmount() {
    clearWaiters();
    if (mountedApp) {
        mountedApp.unmount();
        mountedApp = null;
    }
    document.getElementById(CONTAINER_ID)?.remove();
}

function tryMount() {
    if (mountedApp || document.getElementById(CONTAINER_ID)) return;
    // The wwObjects-based button (same uid, added to public/data/<page>.json) already
    // rendered on its own - don't add a second one next to it.
    if (document.querySelector(`[class*="ww-element-${WWOBJECT_BUTTON_UID}"]`)) {
        clearWaiters();
        return;
    }
    const anchor = document.querySelector(`[class*="ww-element-${CARD_ANCHOR_UID}"]`);
    if (!anchor?.parentNode) return;

    const container = document.createElement('div');
    container.id = CONTAINER_ID;
    anchor.parentNode.insertBefore(container, anchor.nextSibling);

    mountedApp = createApp(ChatButton);
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

function isProfilePageRoute(route) {
    return !!route?.name && route.name.startsWith(`page-${PROFILE_PAGE_ID}`);
}

export function initProfileChatButton(router) {
    // router.afterEach only fires on *future* navigations - a hard load landing directly
    // on profile_page needs this checked once for the route that's already resolved too.
    if (isProfilePageRoute(router.currentRoute.value)) {
        waitAndMount();
    }
    router.afterEach(to => {
        unmount();
        if (isProfilePageRoute(to)) {
            waitAndMount();
        }
    });
}
