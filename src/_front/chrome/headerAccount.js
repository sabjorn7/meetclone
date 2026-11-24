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

// Synchronous UI snapshot established by the single SDK through refreshAuthUser.
// Neither arbitrary localStorage entries nor legacy cookies prove identity.
export function readStoredSession() {
    try {
        const plugin = getAuthPlugin();
        if (!plugin?.publicInstance || (getSupabase() && getSupabase() !== plugin.publicInstance)) return null;
        const user = plugin._getUser?.();
        if (!user?.id || !user._session?.access_token || Number(user._session.expires_at) * 1000 <= Date.now()) return null;
        return { ...user._session, user };
    } catch { return null; }
}

// Retain the synchronous consumer API, but do not read authentication cookies.
export function authCookieUser() {
    const user = readStoredSession()?.user;
    return user ? { id: user.id, email: user.email } : null;
}

export function isLikelyLoggedIn() {
    return !!readStoredSession();
}

// Resolve the logged-in uid, WAITING briefly for the auth session to be restored. The supabase auth
// plugin restores the localStorage session / sets the cookie asynchronously after boot, so a page that
// reads the uid once in onMounted can lose the race (uid=null) and render empty per-user blocks forever
// («Ваши курсы» empty, greeting with no name). Poll until the uid appears or the timeout elapses.
// Returns the uid, or null for a genuine guest (no session after waiting).
export async function waitForUid(timeoutMs = 3000, stepMs = 150) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const uid = readStoredSession()?.user?.id || authCookieUser()?.id;
        if (uid) return uid;
        if (Date.now() >= deadline) return null;
        await new Promise((r) => setTimeout(r, stepMs));
    }
}

// Resolve the logged-in user's `users` row (users.id == auth uid for this project; fall back to email).
// Guests (no stored session AND no auth cookie) return null WITHOUT any Supabase call, so the header
// never touches auth on public pages.
export async function loadUser(sb) {
    if (!sb) return null;
    const snapshot = readStoredSession();
    const authUser = snapshot?.user;
    const stillCurrent = () => readStoredSession()?.access_token === snapshot?.access_token;
    if (!authUser?.id) return null;
    // Retry on an EMPTY result: the users row always exists for a logged-in user, so a transient empty
    // response (observed intermittently, esp. on slow mobile) is a race/hiccup, not "no such user" —
    // falling back to {id,email} here is what makes the header show email-initials ("2M") with no name.
    for (let attempt = 0; attempt < 3; attempt++) {
        let { data } = await sb.from('users').select(USER_COLS).eq('id', authUser.id).limit(1);
        if (!stillCurrent()) return null;
        if (!data?.length && authUser.email) {
            ({ data } = await sb.from('users').select(USER_COLS).eq('email', authUser.email).limit(1));
        }
        if (!stillCurrent()) return null;
        if (data?.length) return data[0];
        await new Promise((r) => setTimeout(r, 300));
    }
    return stillCurrent() ? { id: authUser.id, email: authUser.email } : null;
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
    for (const name of ['mg-auth-v2-access', 'mg-auth-v2-refresh']) {
        for (const domain of [host, '.' + host, '']) {
            const d = domain ? `; domain=${domain}` : '';
            document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0${d}`;
        }
    }
}

// Remove any persisted supabase session from localStorage (the second source isLikelyLoggedIn reads).
function clearStoredSession() {
    const id = window.wwLib?.wwWebsiteData?.getInfo?.()?.id;
    if (!id) throw new Error('Auth namespace unavailable');
    // Do not scan or remove another SDK generation's storage.
    const key = `${id}:auth-v2`;
    localStorage.removeItem(key);
    localStorage.removeItem(key + '-user');
}

// Explicit logout. isLikelyLoggedIn() reads the auth COOKIE **or** the localStorage session,
// so logout must clear BOTH before the caller redirects — otherwise a leftover source keeps the app
// "logged in" and it restores the session on the next load (the observed "logout needs two clicks").
// Hide the confirmed plugin view first; preserve bounded push cleanup, then
// clear only this namespace. Return server revocation errors to the caller.
export async function signOutUser(sb) {
    const plugin = getAuthPlugin();
    if (!plugin?.publicInstance || sb !== plugin.publicInstance) throw new Error('Auth client mismatch');
    const token = readStoredSession()?.access_token || null;
    plugin._authEpoch = (plugin._authEpoch || 0) + 1;
    plugin._authRequest = (plugin._authRequest || 0) + 1;
    plugin._lastAuthSession = null;
    plugin.clearAuthView();
    clearAuthCookies();

    // Push: отписать текущий endpoint ПОКА сессия ещё активна (push_unsubscribe берёт user_id из
    // auth.uid()) — на общих устройствах подписка не должна остаться на прежнем пользователе. Best-effort.
    // rpc берёт auth-lock и может зависнуть — выход из аккаунта НЕ должен ждать (гонка с таймаутом 1500мс).
    try {
        await Promise.race([
            (async () => {
                if (!('serviceWorker' in navigator)) return;
                const r = await navigator.serviceWorker.getRegistration();
                const sub = r && (await r.pushManager.getSubscription());
                if (sub) {
                    try { await sb?.rpc('push_unsubscribe', { p_endpoint: sub.endpoint }); } catch (e) { /* ignore */ }
                    try { await sub.unsubscribe(); } catch (e) { /* ignore */ }
                }
            })(),
            new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);
    } catch (e) { /* best-effort */ }
    clearStoredSession();
    // Notify the existing SDK observers after local invalidation. No second client.
    const local = await sb.auth.signOut({ scope: 'local' });
    if (local.error) return { error: local.error, localCleared: true };
    // Preserve the existing global revocation request, using only the confirmed
    // SDK snapshot captured above. Never use another namespace or a cookie token.
    const authUrl = sb.auth.url || (sb.supabaseUrl ? `${sb.supabaseUrl}/auth/v1` : null);
    const key = sb.supabaseKey || sb.auth.headers?.apikey || sb.headers?.apikey;
    if (!token) return { error: new Error('No confirmed session for server logout'), localCleared: true };
    if (!authUrl || !key) return { error: new Error('Server logout unavailable'), localCleared: true };
    try {
        const response = await fetch(`${authUrl}/logout`, {
            method: 'POST', keepalive: true,
            headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        return { error: response.ok ? null : new Error('Server logout not confirmed'), localCleared: true };
    } catch {
        return { error: new Error('Server logout not confirmed'), localCleared: true };
    }
}

// MONEY (reviewed before deploy): verbatim port of the site's cart checkout, same flow the WeWeb
// "Оформить заказ" runs and the same as streamsApi.purchaseStream — create an `order` from the cart,
// fetch a Prodamus payment link (do=link), persist it, then redirect the buyer to Prodamus. It does
// NOT move funds itself; the buyer completes payment on Prodamus (n8n BuyCourse finalizes via callback).
export async function checkoutCart(sb, { user, cart, promoCode = null }) {
    if (window.__mgGuestAuth) throw new Error('Нет связи с аккаунтом. Обновите страницу.'); // (a') guard
    if (!sb || !user?.id || !cart?.length) return;

    // Promo (optional). Re-validate server-side at checkout so the discount is authoritative and
    // reflects the CURRENT cart (not a stale "applied" snapshot). preview_promo returns per-line
    // new prices; we persist them to shop.price so n8n BuyCourse bills the author's commission on the
    // discounted price (the invariant order.summ == Σ shop.price == amount charged stays intact).
    const priceById = {};
    let promoId = null, promoDiscount = 0;
    if (promoCode) {
        const { data: pv, error: pErr } = await sb.rpc('preview_promo', {
            p_code: promoCode, p_shop_ids: cart.map((r) => r.id),
        });
        if (pErr) throw new Error(`Промокод: ${pErr.message}`);
        if (!pv?.valid) throw new Error('Промокод больше не действует — обновите корзину.');
        promoId = pv.promo_id;
        promoDiscount = Number(pv.discount) || 0;
        for (const l of (pv.lines || [])) {
            priceById[l.shop_id] = Number(l.new_price);
            await sb.from('shop').update({ price: Number(l.new_price) }).eq('id', l.shop_id);
        }
    }
    const priceOf = (r) => (priceById[r.id] !== undefined ? priceById[r.id] : Number(r.price || 0));
    const summ = cart.reduce((s, r) => s + priceOf(r), 0);

    const { data: orderRows, error } = await sb.from('order')
        .insert({ summ, owner: user.id, course_positions: cart.map((r) => r.id),
                  promo_code_id: promoId, promo_discount: promoId ? promoDiscount : null })
        .select('id');
    if (error) throw new Error(`Заказ: ${error.message}`);
    const orderId = orderRows?.[0]?.id;

    const base = 'https://meetguru.payform.ru/?do=link&sys=meetguru';
    // Return to the home dashboard ("Ваши курсы") — a paid cart can hold several courses, so there is
    // no single ?course=<id> to deep-link, and bare /my_courses now shows "Курс не найден".
    const urlSuccess = 'https://app.meetgu.ru/';
    const products = cart.map((r, i) =>
        `products[${i}][price]=${encodeURIComponent(priceOf(r))}` +
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
