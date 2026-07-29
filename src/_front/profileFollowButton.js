// Hand-written follow ("Подписаться") button for profile_page, mounted the same way
// as profileChatButton.js (see that file's header for why the wwObjects pipeline is
// bypassed): an ordinary Vue app rendered into a plain DOM node next to the profile
// card, reading the same reactive sources WeWeb's formula evaluator reads and writing
// through the shared supabase-js client (wwLib.wwPlugins.supabase.instance).
//
// Backend: table public.subscriptions (subscriber uuid, target uuid) — user-to-user
// follow, shared with the mobile app. RLS is off project-wide, so the authenticated
// client can insert/delete directly. Only speakers / institutions are followable.
import { createApp, h, computed, ref, watch, onMounted } from 'vue';

const PROFILE_PAGE_ID = '6ff5d3f0-8211-4a41-9774-a6e6a9d8e55d';
const CHUSER_COLLECTION_ID = 'fc08d985-55cb-41e6-968d-9ce8f788a4f2'; // viewed profile's users row
const CURRENT_USER_COLLECTION_ID = 'ebe8a1ca-0b4e-494f-a496-5e281d06bd16'; // logged-in user
const AUTH_PLUGIN_ID = '1fa0dd68-5069-436c-9a7d-3b54c340f1fa';
const CARD_ANCHOR_UID = '7611c661-3b49-42a3-a7d4-7b2075ace1a0';
const CONTAINER_ID = 'profile-follow-button-root';
const MOUNT_TIMEOUT_MS = 15000;

// Only these roles can be followed (mirrors the mobile app).
const SUBSCRIBABLE_ROLES = ['Спикер', 'Учебное заведение'];

let mountedApp = null;
let observer = null;
let timeoutId = null;

function supa() {
    return wwLib.wwPlugins?.supabase?.instance || null;
}

const FollowButton = {
    setup() {
        const following = ref(false);
        const followerCount = ref(null);
        const busy = ref(false);

        const collections = () => wwLib.$store.getters['data/getCollections'];
        const targetUser = computed(() => collections()?.[CHUSER_COLLECTION_ID]?.data?.[0] || null);
        const targetId = computed(() => targetUser.value?.id || null);
        const meId = computed(() => collections()?.[CURRENT_USER_COLLECTION_ID]?.data?.[0]?.id || null);

        const isVisible = computed(() => {
            if (!wwLib.wwPlugins?.[AUTH_PLUGIN_ID]?.isAuthenticated) return false;
            if (!targetId.value || !meId.value) return false;
            if (targetId.value === meId.value) return false;
            return SUBSCRIBABLE_ROLES.includes(targetUser.value?.role);
        });

        async function load() {
            const client = supa();
            if (!client || !targetId.value || !meId.value) return;
            try {
                const [{ data: mine }, { count }] = await Promise.all([
                    client
                        .from('subscriptions')
                        .select('id')
                        .eq('subscriber', meId.value)
                        .eq('target', targetId.value)
                        .limit(1),
                    client
                        .from('subscriptions')
                        .select('id', { count: 'exact', head: true })
                        .eq('target', targetId.value),
                ]);
                following.value = Array.isArray(mine) && mine.length > 0;
                followerCount.value = count ?? 0;
            } catch (e) {
                // non-fatal — button still works, just no initial state/count
                console.warn('follow: load failed', e);
            }
        }

        async function onClick() {
            const client = supa();
            if (busy.value || !client || !targetId.value || !meId.value) return;
            const next = !following.value;
            busy.value = true;
            following.value = next; // optimistic
            followerCount.value =
                followerCount.value == null
                    ? followerCount.value
                    : Math.max(0, followerCount.value + (next ? 1 : -1));
            try {
                if (next) {
                    const { error } = await client
                        .from('subscriptions')
                        .upsert(
                            { subscriber: meId.value, target: targetId.value },
                            { onConflict: 'subscriber,target', ignoreDuplicates: true },
                        );
                    if (error) throw error;
                } else {
                    const { error } = await client
                        .from('subscriptions')
                        .delete()
                        .eq('subscriber', meId.value)
                        .eq('target', targetId.value);
                    if (error) throw error;
                }
            } catch (e) {
                following.value = !next; // revert
                followerCount.value =
                    followerCount.value == null
                        ? followerCount.value
                        : Math.max(0, followerCount.value + (next ? -1 : 1));
                console.warn('follow: toggle failed', e);
            } finally {
                busy.value = false;
            }
        }

        watch([targetId, meId], load, { immediate: true });
        onMounted(load);

        return { isVisible, following, followerCount, busy, onClick };
    },
    render() {
        if (!this.isVisible) return null;
        const children = [
            h(
                'button',
                {
                    type: 'button',
                    disabled: this.busy,
                    onClick: this.onClick,
                    style: {
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        width: 'fit-content',
                        margin: '0 auto',
                        padding: '12px 24px',
                        borderRadius: '8px',
                        background: this.following ? '#FFFFFF' : '#5495F3',
                        border: '1px solid #5495F3',
                        color: this.following ? '#5495F3' : '#FFFFFF',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: this.busy ? 'default' : 'pointer',
                        opacity: this.busy ? 0.7 : 1,
                    },
                },
                this.following ? 'Вы подписаны' : 'Подписаться',
            ),
        ];
        if (this.followerCount != null) {
            children.push(
                h(
                    'div',
                    {
                        style: {
                            textAlign: 'center',
                            marginTop: '6px',
                            fontSize: '13px',
                            color: '#8A94A6',
                        },
                    },
                    `${this.followerCount} ${pluralSubscribers(this.followerCount)}`,
                ),
            );
        }
        return h('div', { style: { margin: '10px auto 0 auto', width: 'fit-content' } }, children);
    },
};

// Russian plural for "подписчик".
function pluralSubscribers(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'подписчик';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'подписчика';
    return 'подписчиков';
}

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
    const anchor = document.querySelector(`[class*="ww-element-${CARD_ANCHOR_UID}"]`);
    if (!anchor?.parentNode) return;

    const container = document.createElement('div');
    container.id = CONTAINER_ID;
    anchor.parentNode.insertBefore(container, anchor.nextSibling);

    mountedApp = createApp(FollowButton);
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

export function initProfileFollowButton(router) {
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
