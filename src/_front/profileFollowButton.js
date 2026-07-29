// Hand-written action row for the public profile_page — a single tidy row of
// [Подписаться] [Написать], mirroring the mobile app's profile actions. Mounted the
// same way as profileChatButton.js (see its header for why the wwObjects pipeline is
// bypassed): an ordinary Vue app rendered into a plain DOM node next to the profile
// card. This REPLACES the separate profileChatButton.js mount (its init call is removed
// from main.js) so the two buttons render together consistently instead of scattered.
//
// - "Подписаться" writes public.subscriptions via the shared supabase client
//   (wwLib.wwPlugins.supabase.instance); shown only for speaker/institution profiles.
// - "Написать" navigates to the chats page with the profile user (same action the old
//   "Написать в чат" button performed).
// RLS is off project-wide, so the authenticated client can insert/delete directly.
import { createApp, h, computed, ref, watch } from 'vue';

const PROFILE_PAGE_ID = '6ff5d3f0-8211-4a41-9774-a6e6a9d8e55d';
const CHATS_PAGE_ID = '371cded4-cfe8-4b30-bfc0-23b87e9f6d07';
const CHUSER_COLLECTION_ID = 'fc08d985-55cb-41e6-968d-9ce8f788a4f2'; // viewed profile's users row
const CURRENT_USER_COLLECTION_ID = 'ebe8a1ca-0b4e-494f-a496-5e281d06bd16'; // logged-in user
const RESOLVED_PROFILE_USER_ID_VAR = '0a6bc2e7-9ab1-4980-8674-8cab02c89def';
const AUTH_PLUGIN_ID = '1fa0dd68-5069-436c-9a7d-3b54c340f1fa';
const CARD_ANCHOR_UID = '7611c661-3b49-42a3-a7d4-7b2075ace1a0';
// A stray 12x12 decorative dot the design renders between the card and the sections —
// hidden so the action row sits cleanly under the card (like the app).
const STRAY_DOT_UID = 'd1484100-802c-445';
// The native "Написать в чат" wwObject inside the card — hidden because our action row
// now provides "Написать" (same navigate-to-chats behavior), avoiding a duplicate.
const NATIVE_CHAT_UID = 'c2600d0f-7919-43ec';
const CONTAINER_ID = 'profile-follow-button-root';
const STYLE_ID = 'mg-profile-actions-style';
const MOUNT_TIMEOUT_MS = 15000;

// Only these roles can be followed (mirrors the mobile app).
const SUBSCRIBABLE_ROLES = ['Спикер', 'Учебное заведение'];

const BLUE = '#5495F3';

let mountedApp = null;
let observer = null;
let timeoutId = null;

function supa() {
    return wwLib.wwPlugins?.supabase?.instance || null;
}

function pillStyle(filled, disabled) {
    return {
        flex: '1 1 0',
        minWidth: '150px',
        maxWidth: '260px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '12px 20px',
        borderRadius: '8px',
        background: filled ? BLUE : '#FFFFFF',
        border: `1px solid ${BLUE}`,
        color: filled ? '#FFFFFF' : BLUE,
        fontSize: '14px',
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.7 : 1,
    };
}

const ProfileActions = {
    setup() {
        const following = ref(false);
        const followerCount = ref(null);
        const busy = ref(false);

        const collections = () => wwLib.$store.getters['data/getCollections'];
        const targetUser = computed(() => collections()?.[CHUSER_COLLECTION_ID]?.data?.[0] || null);
        const targetId = computed(() => targetUser.value?.id || null);
        const meId = computed(() => collections()?.[CURRENT_USER_COLLECTION_ID]?.data?.[0]?.id || null);

        // Chat is offered for any other user; follow only for speakers/institutions.
        const isVisible = computed(() => {
            if (!wwLib.wwPlugins?.[AUTH_PLUGIN_ID]?.isAuthenticated) return false;
            if (!targetId.value || !meId.value) return false;
            return targetId.value !== meId.value;
        });
        const canFollow = computed(
            () => isVisible.value && SUBSCRIBABLE_ROLES.includes(targetUser.value?.role),
        );

        async function load() {
            const client = supa();
            if (!client || !canFollow.value || !targetId.value || !meId.value) return;
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
                console.warn('follow: load failed', e);
            }
        }

        async function onToggleFollow() {
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

        function onChat() {
            const target =
                wwLib.globalVariables?.customCodeVariables?.[RESOLVED_PROFILE_USER_ID_VAR] ||
                targetId.value;
            if (!target) return;
            wwLib.wwApp.goTo(wwLib.wwPageHelper.getPagePath(CHATS_PAGE_ID), { user: target });
        }

        watch([targetId, meId], () => canFollow.value && load(), { immediate: true });

        return { isVisible, canFollow, following, followerCount, busy, onToggleFollow, onChat };
    },
    render() {
        if (!this.isVisible) return null;

        const buttons = [];
        if (this.canFollow) {
            buttons.push(
                h(
                    'button',
                    {
                        type: 'button',
                        disabled: this.busy,
                        onClick: this.onToggleFollow,
                        style: pillStyle(!this.following, this.busy),
                    },
                    this.following ? 'Вы подписаны' : 'Подписаться',
                ),
            );
        }
        buttons.push(
            h(
                'button',
                { type: 'button', onClick: this.onChat, style: pillStyle(false, false) },
                'Написать',
            ),
        );

        const children = [
            h(
                'div',
                {
                    style: {
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        gap: '12px',
                        width: '100%',
                    },
                },
                buttons,
            ),
        ];
        if (this.canFollow && this.followerCount != null) {
            children.push(
                h(
                    'div',
                    { style: { textAlign: 'center', marginTop: '8px', fontSize: '13px', color: '#8A94A6' } },
                    `${this.followerCount} ${pluralSubscribers(this.followerCount)}`,
                ),
            );
        }

        return h(
            'div',
            {
                style: {
                    width: '100%',
                    maxWidth: '560px',
                    margin: '16px auto 0 auto',
                    padding: '0 16px',
                    boxSizing: 'border-box',
                },
            },
            children,
        );
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

function injectStyleOnce() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
        `[class*="ww-element-${STRAY_DOT_UID}"],` +
        `[class*="ww-element-${NATIVE_CHAT_UID}"]{display:none !important;}`;
    document.head.appendChild(s);
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

    mountedApp = createApp(ProfileActions);
    mountedApp.mount(container);
    clearWaiters();
}

function waitAndMount() {
    injectStyleOnce();
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
