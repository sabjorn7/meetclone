// pushClient.js — клиент web-push подписки. Кнопка/подписка на этом этапе СКРЫТЫ за ?push=1;
// публичный показ снимается отдельным коммитом. Разрешение запрашивается ТОЛЬКО по жесту (клику),
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
async function reg() {
    try { return (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.ready); }
    catch (_) { return null; }
}
async function saveSubscription(sub) {
    try {
        const j = sub.toJSON();
        if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) return false;
        const { error } = await getSupabase().rpc('push_subscribe', {
            p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_ua: navigator.userAgent || '',
        });
        return !error;
    } catch (_) { return false; }
}

// Подписаться (ТОЛЬКО по жесту). Возвращает { ok, reason }.
export async function subscribeToPush() {
    if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
    if (!VAPID_PUBLIC || VAPID_PUBLIC.startsWith('__')) return { ok: false, reason: 'no_vapid' };
    let perm = Notification.permission;
    if (perm === 'default') { try { perm = await Notification.requestPermission(); } catch (_) { perm = 'denied'; } }
    if (perm !== 'granted') return { ok: false, reason: perm === 'denied' ? 'denied' : 'dismissed' };
    const r = await reg();
    if (!r) return { ok: false, reason: 'no_sw' };
    let sub;
    try {
        sub = await r.pushManager.getSubscription();
        if (!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(VAPID_PUBLIC) });
    } catch (_) { return { ok: false, reason: 'subscribe_failed' }; }
    return (await saveSubscription(sub)) ? { ok: true } : { ok: false, reason: 'save_failed' };
}

// При открытии приложения у подписанного пользователя — обновить подписку (last_seen) в фоне.
export async function refreshPushSubscription() {
    try {
        if (!isPushSupported() || Notification.permission !== 'granted') return;
        const uid = readStoredSession()?.user?.id || authCookieUser()?.id;
        if (!uid) return;
        const r = await navigator.serviceWorker.getRegistration();
        const sub = r && (await r.pushManager.getSubscription());
        if (sub) await saveSubscription(sub);
    } catch (_) { /* best-effort */ }
}

// Текущее состояние для UI кнопки.
export async function pushState() {
    if (!isPushSupported()) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    try {
        const r = await navigator.serviceWorker.getRegistration();
        const sub = r && (await r.pushManager.getSubscription());
        return sub && Notification.permission === 'granted' ? 'subscribed' : 'off';
    } catch (_) { return 'off'; }
}
