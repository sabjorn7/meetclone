// pushClient.js — подписка и проверка её сохранения на сервере.
// Разрешение запрашивается ТОЛЬКО по жесту (клику),
// на iOS — только в установленном PWA (standalone) 16.4+. RPC push_subscribe/push_unsubscribe —
// user_id берётся из сессии на сервере (SECURITY DEFINER), не от клиента.
import { getSupabase, readStoredSession, authCookieUser } from './headerAccount.js';

// applicationServerKey = VAPID public (генерируется set-push-env.sh на sb, печатается им). Заполнить
// перед включением push (до теста D7). Пока плейсхолдер — подписка вернёт reason:'no_vapid'.
const VAPID_PUBLIC = 'BGTxONvOxhjJdBeucbJgRYdvLzmILSjQKu4ADV_-ufh5CUiE5sTC43GSZEhC7-32QNtcL67t9sCzZNgKYDdpyok';

export function isPushSupported() {
    return typeof navigator !== 'undefined'
        && 'serviceWorker' in navigator && typeof window !== 'undefined'
        && 'PushManager' in window && 'Notification' in window;
}

function urlB64ToUint8(b64) {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const s = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(s);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
}
const DEADLINE_MS = 8000;
let stateCheck = null;
let unsubscribing = false;
function currentUserId() { return readStoredSession()?.user?.id || authCookieUser()?.id || null; }
async function bounded(operation) {
    let timer;
    const controller = new AbortController();
    try {
        return await Promise.race([
            Promise.resolve().then(() => operation(controller.signal)),
            new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('push_timeout')); }, DEADLINE_MS); }),
        ]);
    } finally { clearTimeout(timer); }
}
async function reg() {
    return bounded(async () => (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.ready));
}
async function accountPermission(uid) {
    const {data, error} = await bounded(signal => getSupabase().from('users').select('send_notif').eq('id', uid).maybeSingle().abortSignal(signal));
    if (error || !data || currentUserId() !== uid) throw new Error('preference_unavailable');
    return data.send_notif !== false;
}
async function saveSubscription(sub, uid) {
    try {
        if (unsubscribing || currentUserId() !== uid) return false;
        const j = sub.toJSON();
        if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) return false;
        const { error } = await bounded(signal => getSupabase().rpc('push_subscribe', {
            p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_ua: navigator.userAgent || '',
        }).abortSignal(signal));
        return !error && currentUserId() === uid;
    } catch (_) { return false; }
}

// Подписаться (ТОЛЬКО по жесту). Возвращает { ok, reason }.
export async function subscribeToPush() {
    if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
    if (!VAPID_PUBLIC || VAPID_PUBLIC.startsWith('__')) return { ok: false, reason: 'no_vapid' };
    let perm = Notification.permission;
    if (perm === 'default') { try { perm = await Notification.requestPermission(); } catch (_) { perm = 'denied'; } }
    if (perm !== 'granted') return { ok: false, reason: perm === 'denied' ? 'denied' : 'dismissed' };
    const uid = currentUserId();
    if (!uid) return { ok: false, reason: 'signed_out' };
    try { if (!(await accountPermission(uid))) return { ok: false, reason: 'account_disabled' }; }
    catch (_) { return { ok: false, reason: 'sync_error' }; }
    let r;
    try { r = await reg(); } catch (_) { return { ok: false, reason: 'no_sw' }; }
    if (!r) return { ok: false, reason: 'no_sw' };
    let sub;
    try {
        sub = await bounded(() => r.pushManager.getSubscription());
        if (!sub) sub = await bounded(() => r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(VAPID_PUBLIC) }));
    } catch (_) { return { ok: false, reason: 'subscribe_failed' }; }
    return (await saveSubscription(sub, uid)) ? { ok: true } : { ok: false, reason: 'save_failed' };
}

// При открытии приложения у подписанного пользователя — обновить подписку (last_seen) в фоне.
export async function refreshPushSubscription() {
    if (!isPushSupported() || Notification.permission !== 'granted' || !currentUserId()) return;
    return pushState();
}

// Отписаться на этом устройстве: push_unsubscribe (сервер, по endpoint) + sub.unsubscribe() (браузер).
// user_id на сервере берётся из auth.uid() (SECURITY DEFINER). Возвращает { ok }.
export async function unsubscribeFromPush() {
    if (unsubscribing) return {ok: false};
    unsubscribing = true;
    try {
        // Let an already running repair settle before removing its server record.
        if (stateCheck) await stateCheck.promise;
        const r = await reg();
        const sub = r && (await bounded(() => r.pushManager.getSubscription()));
        if (sub) {
            const {error} = await bounded(signal => getSupabase().rpc('push_unsubscribe', {p_endpoint: sub.endpoint}).abortSignal(signal));
            if (error) return {ok: false};
            if (!(await bounded(() => sub.unsubscribe()))) return {ok: false};
        }
        return {ok: true};
    } catch (_) { return {ok: false}; }
    finally { unsubscribing = false; }
}

// A browser subscription alone is not proof of a working server registration.
// Repair it idempotently before showing success; never prompt or create a browser subscription here.
export function pushState() {
    if (!isPushSupported()) return Promise.resolve('unsupported');
    if (Notification.permission === 'denied') return Promise.resolve('denied');
    const uid = currentUserId();
    if (!uid) return Promise.resolve('off');
    if (unsubscribing) return Promise.resolve('sync_error');
    if (stateCheck?.uid === uid) return stateCheck.promise;
    const check = {uid, promise: null};
    check.promise = (async () => {
        try {
            if (!(await accountPermission(uid))) return 'account_disabled';
            if (Notification.permission !== 'granted') return 'off';
            const r = await reg();
            const sub = r && (await bounded(() => r.pushManager.getSubscription()));
            if (currentUserId() !== uid) return 'off';
            if (!sub) return 'off';
            return (await saveSubscription(sub, uid)) ? 'subscribed' : 'sync_error';
        } catch (_) { return 'sync_error'; }
        finally { if (stateCheck === check) stateCheck = null; }
    })();
    stateCheck = check;
    return check.promise;
}
