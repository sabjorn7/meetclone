// Account + cart data for the shared AppHeader. Uses the same global Supabase client as the rest
// of the app (window.wwLib.wwPlugins.supabase.instance) — the same one used for auth elsewhere.
//
// Mirrors the WeWeb header exactly:
//   - cart      = `shop` rows where owner == currentUser.id AND status == 'cart'
//   - total     = plain sum of the `price` column over those rows
//   - live      = `shop` is realtime-enabled; the header subscribes and reloads on change
//   - checkout  = a verbatim port of the site's course-purchase flow (see
//                 src/_front/streams/streamsApi.js purchaseStream): create an `order` from the
//                 cart, get a Prodamus payment link, redirect. This is the ONLY money-adjacent code.

const SUPABASE_URL = 'https://sb.meetgu.ru';
const AVATAR_BUCKET = 'profile';
const USER_COLS = 'id, email, "Name", "Photo", "Ammount", role, superadmin';

export function getSupabase() {
    return window.wwLib?.wwPlugins?.supabase?.instance || null;
}

// Read the persisted Supabase session straight from localStorage instead of sb.auth.getSession().
// getSession() acquires a Web Locks lock that contends with the app's OWN auth init and can stall
// page data loading (e.g. the course list never fetches for guests). This is a plain, synchronous,
// lock-free read. Returns the session object (with .user / .access_token) or null.
export function readStoredSession() {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const raw = localStorage.getItem(localStorage.key(i));
            if (!raw || !raw.includes('access_token') || !raw.includes('refresh_token')) continue;
            const parsed = JSON.parse(raw);
            // supabase-js v2 stores the session object directly; older shapes nest it.
            const sess = parsed?.access_token ? parsed : (parsed?.currentSession || parsed?.session || null);
            if (sess?.access_token) return sess;
        }
    } catch (e) { /* malformed / blocked storage -> treat as no session */ }
    return null;
}

// Decode the auth user (id + email) from the sb-access-token JWT cookie. The Supabase auth plugin
// sets sb-access-token / sb-refresh-token on login and removes them on logout, so this is a reliable
// logged-in signal that does NOT touch sb.auth.getSession() (which can hang on Web Locks). Used as a
// fallback when the localStorage session isn't present (stale/cleared storage) but the cookie is.
export function authCookieUser() {
    try {
        const c = document.cookie.split(';').map((s) => s.trim()).find((s) => s.startsWith('sb-access-token='));
        if (!c) return null;
        const jwt = decodeURIComponent(c.slice('sb-access-token='.length));
        const payload = jwt.split('.')[1];
        if (!payload) return null;
        // base64url -> base64 (+ padding, which JWTs usually omit and atob otherwise rejects).
        const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const json = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
        return json?.sub ? { id: json.sub, email: json.email } : null;
    } catch (e) { return null; }
}

// Reliable "is a user logged in?" check with NO getSession()/Web-Locks dependency: the auth cookie
// OR a persisted localStorage session. Fails OPEN (returns true) on any error so a real user is never
// treated as a guest. Used by the App.vue home guard so logged-in users are never bounced to the
// public catalog even when localStorage is stale, cleared, or blocked.
export function isLikelyLoggedIn() {
    try {
        return !!(authCookieUser() || readStoredSession());
    } catch (e) { return true; }
}

// Resolve the logged-in user's `users` row (users.id == auth uid for this project; fall back to email).
// Guests (no stored session AND no auth cookie) return null WITHOUT any Supabase call, so the header
// never touches auth on public pages.
export async function loadUser(sb) {
    if (!sb) return null;
    const authUser = readStoredSession()?.user || authCookieUser();
    if (!authUser?.id) return null;
    let { data } = await sb.from('users').select(USER_COLS).eq('id', authUser.id).limit(1);
    if (!data?.length && authUser.email) {
        ({ data } = await sb.from('users').select(USER_COLS).eq('email', authUser.email).limit(1));
    }
    return data?.[0] || { id: authUser.id, email: authUser.email };
}

export function avatarUrl(user) {
    const p = user?.Photo;
    if (!p) return '';
    if (/^https?:\/\//.test(p)) return p;
    return `${SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${p}`;
}

export function initials(user) {
    const n = (user?.Name || user?.email || '').trim();
    if (!n) return '·';
    const parts = n.split(/[\s@.]+/).filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || n[0].toUpperCase();
}

// Cart = shop rows for this owner with status 'cart'. Newest first (matches the WeWeb collection sort).
export async function loadCart(sb, ownerId) {
    if (!sb || !ownerId) return [];
    const { data } = await sb.from('shop')
        .select('id, price, quantity, course_name, course_id, status, position')
        .eq('owner', ownerId).eq('status', 'cart')
        .order('created_at', { ascending: false });
    return data || [];
}

export async function removeCartItem(sb, id) {
    if (!sb || !id) return;
    await sb.from('shop').delete().eq('id', id);
}

export function cartTotal(cart) {
    return (cart || []).reduce((s, r) => s + Number(r.price || 0), 0);
}

// The app's canonical auth-plugin (plugin-1fa0dd68 / friendly name "supabaseAuth"). Its signOut()
// removes the sb-access/refresh-token cookies with the exact path/domain it set them and clears the
// app's user state — a raw sb.auth.signOut() does neither.
function getAuthPlugin() {
    const p = window.wwLib?.wwPlugins;
    if (!p) return null;
    if (typeof p.supabaseAuth?.signOut === 'function') return p.supabaseAuth;
    const byId = p['1fa0dd68-5069-436c-9a7d-3b54c340f1fa'];
    return typeof byId?.signOut === 'function' ? byId : null;
}

// Fallback cookie removal (matches setCookies: path '/', domain = hostname; plus '.'+hostname for
// Safari) in case the auth plugin isn't reachable.
function clearAuthCookies() {
    const host = window.location.hostname;
    for (const name of ['sb-access-token', 'sb-refresh-token']) {
        for (const domain of [host, '.' + host, '']) {
            const d = domain ? `; domain=${domain}` : '';
            document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0${d}`;
        }
    }
}

// Remove any persisted supabase session from localStorage (the second source isLikelyLoggedIn reads).
function clearStoredSession() {
    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            const v = localStorage.getItem(k);
            if (v && v.includes('access_token') && v.includes('refresh_token')) localStorage.removeItem(k);
        }
    } catch (e) { /* ignore */ }
}

// Full, race-free sign-out. isLikelyLoggedIn() reads the auth COOKIE **or** the localStorage session,
// so logout must clear BOTH before the caller redirects — otherwise a leftover source keeps the app
// "logged in" and it restores the session on the next load (the observed "logout needs two clicks").
// The synchronous clears below are the guarantee; the network signOut is fired best-effort and NOT
// awaited because it acquires the Web Locks auth lock and can hang.
export async function signOutUser(sb) {
    try { getAuthPlugin()?.signOut(); } catch (e) { /* ignore */ }
    try { sb?.auth?.signOut(); } catch (e) { /* ignore */ }
    clearAuthCookies();
    clearStoredSession();
}

// MONEY (reviewed before deploy): verbatim port of the site's cart checkout, same flow the WeWeb
// "Оформить заказ" runs and the same as streamsApi.purchaseStream — create an `order` from the cart,
// fetch a Prodamus payment link (do=link), persist it, then redirect the buyer to Prodamus. It does
// NOT move funds itself; the buyer completes payment on Prodamus (n8n BuyCourse finalizes via callback).
export async function checkoutCart(sb, { user, cart }) {
    if (!sb || !user?.id || !cart?.length) return;
    const summ = cartTotal(cart);
    const { data: orderRows, error } = await sb.from('order')
        .insert({ summ, owner: user.id, course_positions: cart.map((r) => r.id) })
        .select('id');
    if (error) throw new Error(`Заказ: ${error.message}`);
    const orderId = orderRows?.[0]?.id;

    const base = 'https://meetguru.payform.ru/?do=link&sys=meetguru';
    const urlSuccess = 'https://app.meetgu.ru/my_courses';
    const products = cart.map((r, i) =>
        `products[${i}][price]=${encodeURIComponent(r.price)}` +
        `&products[${i}][quantity]=${encodeURIComponent(r.quantity || 1)}` +
        `&products[${i}][name]=${encodeURIComponent(r.course_name || 'Курс')}`
    ).join('&');
    const buildUrl = `${base}&order_id=${encodeURIComponent(orderId)}&${products}&urlSuccess=${encodeURIComponent(urlSuccess)}`;

    const res = await fetch(buildUrl);
    if (!res.ok) throw new Error(`Prodamus (${res.status})`);
    const payLink = (await res.text()).trim();
    if (!/^https?:\/\//.test(payLink)) throw new Error('Prodamus вернул не ссылку.');

    await sb.from('order').update({ num: orderId, pageUrl: payLink }).eq('id', orderId);
    window.location.href = payLink;
}
