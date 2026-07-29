// Hand-written "Мои подписки / Мои подписчики" lists on the logged-in user's own
// profile page (route `profile`), mounted the same way as profileChatButton.js /
// profileFollowButton.js (see those headers for why the wwObjects pipeline is bypassed).
// Read-only; mirrors the mobile app's subscription lists. Backend: public.subscriptions
// (subscriber uuid, target uuid) joined to public.users. RLS is off project-wide.
import { createApp, h, computed, ref, watch } from 'vue';

const PROFILE_OWN_PAGE_ID = '92ec31d3-970a-4fa4-9a30-db92e6b3a03d'; // logged-in user's own profile
const PROFILE_PUBLIC_PAGE_ID = '6ff5d3f0-8211-4a41-9774-a6e6a9d8e55d'; // public profile_page (tap target)
const CURRENT_USER_COLLECTION_ID = 'ebe8a1ca-0b4e-494f-a496-5e281d06bd16';
const AUTH_PLUGIN_ID = '1fa0dd68-5069-436c-9a7d-3b54c340f1fa';
const FORM_ANCHOR_UID = '0a2faaa1-290f-4284-a0ff-85d4bb81536a'; // profile form wrapper
const CONTAINER_ID = 'my-subscriptions-root';
const MOUNT_TIMEOUT_MS = 15000;

let mountedApp = null;
let observer = null;
let timeoutId = null;

function supa() {
    return wwLib.wwPlugins?.supabase?.instance || null;
}

// The site displays the "Ученик" role as "Специалист".
function roleLabel(role) {
    if (!role) return '';
    return role === 'Ученик' ? 'Специалист' : role;
}

const MySubscriptions = {
    setup() {
        const following = ref([]);
        const followers = ref([]);
        const loading = ref(true);

        const collections = () => wwLib.$store.getters['data/getCollections'];
        const meId = computed(() => collections()?.[CURRENT_USER_COLLECTION_ID]?.data?.[0]?.id || null);
        const isVisible = computed(
            () => !!wwLib.wwPlugins?.[AUTH_PLUGIN_ID]?.isAuthenticated && !!meId.value,
        );

        async function fetchUsers(ids) {
            const client = supa();
            if (!client || !ids.length) return [];
            const { data } = await client.from('users').select('id,Name,Photo,role').in('id', ids);
            const byId = new Map((data || []).map(u => [u.id, u]));
            return ids.map(id => byId.get(id)).filter(Boolean); // preserve order
        }

        async function load() {
            const client = supa();
            if (!client || !meId.value) return;
            loading.value = true;
            try {
                const [{ data: subs }, { data: fol }] = await Promise.all([
                    client
                        .from('subscriptions')
                        .select('target,created_at')
                        .eq('subscriber', meId.value)
                        .order('created_at', { ascending: false }),
                    client
                        .from('subscriptions')
                        .select('subscriber,created_at')
                        .eq('target', meId.value)
                        .order('created_at', { ascending: false }),
                ]);
                following.value = await fetchUsers((subs || []).map(r => r.target));
                followers.value = await fetchUsers((fol || []).map(r => r.subscriber));
            } catch (e) {
                console.warn('my-subs: load failed', e);
            } finally {
                loading.value = false;
            }
        }

        function openUser(id) {
            if (!id) return;
            wwLib.wwApp.goTo(wwLib.wwPageHelper.getPagePath(PROFILE_PUBLIC_PAGE_ID), { user: id });
        }

        watch(meId, load, { immediate: true });

        return { following, followers, loading, isVisible, openUser };
    },
    render() {
        if (!this.isVisible) return null;

        const card = u =>
            h(
                'div',
                {
                    key: u.id,
                    onClick: () => this.openUser(u.id),
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: '#FFFFFF',
                        border: '1px solid #ECEEF2',
                        cursor: 'pointer',
                    },
                },
                [
                    u.Photo
                        ? h('img', {
                              src: u.Photo,
                              style: {
                                  width: '48px',
                                  height: '48px',
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  flexShrink: 0,
                              },
                          })
                        : h(
                              'div',
                              {
                                  style: {
                                      width: '48px',
                                      height: '48px',
                                      borderRadius: '50%',
                                      background: '#E9F0FE',
                                      color: '#5495F3',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 700,
                                      flexShrink: 0,
                                  },
                              },
                              (u.Name || '?').trim().charAt(0).toUpperCase() || '?',
                          ),
                    h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 } }, [
                        h(
                            'div',
                            {
                                style: {
                                    fontSize: '15px',
                                    fontWeight: 600,
                                    color: '#1B1F27',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                },
                            },
                            u.Name || 'Без имени',
                        ),
                        u.role
                            ? h('div', { style: { fontSize: '13px', color: '#5495F3' } }, roleLabel(u.role))
                            : null,
                    ]),
                ],
            );

        const section = (title, items, emptyText) =>
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, [
                h('div', { style: { fontSize: '18px', fontWeight: 700, color: '#1B1F27' } }, title),
                items.length
                    ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, items.map(card))
                    : h('div', { style: { fontSize: '14px', color: '#8A94A6' } }, emptyText),
            ]);

        return h(
            'div',
            {
                id: 'my-subscriptions-block',
                style: {
                    width: '100%',
                    maxWidth: '1440px',
                    margin: '24px auto',
                    padding: '0 16px',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '28px',
                },
            },
            this.loading
                ? [h('div', { style: { fontSize: '14px', color: '#8A94A6' } }, 'Загрузка…')]
                : [
                      section('Мои подписки', this.following, 'Вы пока ни на кого не подписаны'),
                      section('Мои подписчики', this.followers, 'У вас пока нет подписчиков'),
                  ],
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
    const anchor = document.querySelector(`[class*="ww-element-${FORM_ANCHOR_UID}"]`);
    if (!anchor?.parentNode) return;

    const container = document.createElement('div');
    container.id = CONTAINER_ID;
    anchor.parentNode.insertBefore(container, anchor.nextSibling);

    mountedApp = createApp(MySubscriptions);
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

export function initMySubscriptions(router) {
    if (isOwnProfileRoute(router.currentRoute.value)) {
        waitAndMount();
    }
    router.afterEach(to => {
        unmount();
        if (isOwnProfileRoute(to)) {
            waitAndMount();
        }
    });
}
