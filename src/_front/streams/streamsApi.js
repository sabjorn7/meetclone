// Supabase data helpers for the "Трансляции" (live streams) feature.
// RLS is off project-wide, so the anon/authenticated client reads & writes directly.

// Roles allowed to create a broadcast (same set as the subscriptions feature).
export const STREAMER_ROLES = ['Спикер', 'Учебное заведение'];

/**
 * Resolve the current user's `users` row on a standalone (non-WeWeb) route, where the WeWeb
 * current-user collection may not be populated. We go through the Supabase auth session and
 * match the `users` row by id (users.id == auth uid for this project), falling back to email.
 */
export async function getCurrentUser(supabase) {
    const { data: sessionData } = await supabase.auth.getSession();
    const authUser = sessionData?.session?.user;
    if (!authUser) return null;

    let { data } = await supabase.from('users').select('*').eq('id', authUser.id).limit(1);
    if (!data?.length && authUser.email) {
        ({ data } = await supabase.from('users').select('*').eq('email', authUser.email).limit(1));
    }
    return data?.[0] ?? null;
}

export function canStream(user) {
    return !!user && STREAMER_ROLES.includes(user.role);
}

/** Insert a stream metadata row. `peertube_video_id` = the live video uuid. price 0 = free.
 *  `scheduled_at` = planned start (ISO) or null. */
export async function createStream(supabase, { author, title, description = '', price = 0, peertube_video_id, access_months = null, backing_course_id = null, scheduled_at = null }) {
    const { data, error } = await supabase
        .from('streams')
        .insert({ author, title, description, price, peertube_video_id, access_months, backing_course_id, scheduled_at })
        .select()
        .limit(1);
    if (error) throw new Error(`Не удалось сохранить эфир: ${error.message}`);
    return data?.[0];
}

// ============================ PAID STREAMS (Phase 3) ============================
// Variant 1 — a paid stream is backed by a hidden `course` row; the UNTOUCHED BuyCourse
// pipeline grants access via user_course on it. The functions below that create the backing
// course and initiate the purchase are the ONLY money-adjacent code — reviewed before deploy.

/**
 * MONEY-ADJACENT: create the hidden backing `course` for a paid stream. Kept out of the catalog
 * (ModStatus != 'Опубликовано', slug stays null). `owner` credits sales/balance to the author;
 * `Price` drives the charge and the seller-revenue calc; `DurationLong` = months (informational
 * here — our gate computes expiry from the air date, see accessExpiry()).
 */
export async function createBackingCourse(supabase, { owner, title, price, months }) {
    const { data, error } = await supabase
        .from('course')
        .insert({
            owner,
            Title: title,
            Price: price,
            Free: false,
            DurationLong: months,
            Category: 'Трансляции',
            ModStatus: 'Черновик', // NOT 'Опубликовано' → excluded from the catalog
        })
        .select('id')
        .limit(1);
    if (error) throw new Error(`Не удалось создать курс-подложку: ${error.message}`);
    return data?.[0]?.id;
}

/**
 * MONEY: initiate a paid-stream purchase — a verbatim port of the site's course purchase
 * client flow (shop cart row → order → Prodamus link → order update → return link to redirect).
 * The actual settlement (mark paid, grant user_course, sales, balance) is handled entirely by
 * the UNTOUCHED n8n `BuyCourse` workflow via the Prodamus callback. Returns the payment URL.
 */
export async function purchaseStream(supabase, { buyer, stream }) {
    if (!stream.backing_course_id) throw new Error('У эфира нет курса-подложки.');

    // 1) cart row in `shop` (clone of course action 90ddb3ae; +quantity:1, read by the Prodamus builder)
    const { count } = await supabase
        .from('shop')
        .select('id', { count: 'exact', head: true })
        .eq('owner', buyer)
        .eq('status', 'cart');
    const { data: shopRows, error: shopErr } = await supabase
        .from('shop')
        .insert({
            owner: buyer,
            price: stream.price,
            status: 'cart',
            prolong: 12,
            position: (count || 0) + 1,
            quantity: 1,
            course_id: stream.backing_course_id,
            course_name: stream.title,
        })
        .select('id')
        .limit(1);
    if (shopErr) throw new Error(`Корзина: ${shopErr.message}`);
    const shopId = shopRows?.[0]?.id;

    // 2) order (clone of 21527f28) — ISOLATED to just this stream (only its shop row)
    const { data: orderRows, error: orderErr } = await supabase
        .from('order')
        .insert({ summ: stream.price, owner: buyer, course_positions: [shopId] })
        .select('id')
        .limit(1);
    if (orderErr) throw new Error(`Заказ: ${orderErr.message}`);
    const orderId = orderRows?.[0]?.id;

    // 3) build + fetch the Prodamus payment link (clone of d70ac6c3). do=link returns the link.
    const base = 'https://meetguru.payform.ru/?do=link&sys=meetguru';
    const urlSuccess = `https://app.meetgu.ru/streams?stream=${stream.id}`;
    const products =
        `products[0][price]=${encodeURIComponent(stream.price)}` +
        `&products[0][quantity]=1` +
        `&products[0][name]=${encodeURIComponent(stream.title)}`;
    const buildUrl = `${base}&order_id=${encodeURIComponent(orderId)}&${products}&urlSuccess=${encodeURIComponent(urlSuccess)}`;
    const res = await fetch(buildUrl);
    if (!res.ok) throw new Error(`Prodamus (${res.status})`);
    const payLink = (await res.text()).trim();
    if (!/^https?:\/\//.test(payLink)) throw new Error('Prodamus вернул не ссылку.');

    // 4) store num + pageUrl on the order (clone of 1edef42a)
    await supabase.from('order').update({ num: orderId, pageUrl: payLink }).eq('id', orderId);

    // 5) caller redirects the browser to payLink (clone of change-page a434302a)
    return payLink;
}

// ---------- access gate (NOT money) ----------

/** Air date a paid stream's access window is measured from. */
export function streamAirDate(stream) {
    return new Date(stream.scheduled_at || stream.created_at);
}

/** When paid access ends: air date + access_months. null for free / no duration. */
export function accessExpiry(stream) {
    if (!stream.access_months) return null;
    const e = streamAirDate(stream);
    e.setMonth(e.getMonth() + Number(stream.access_months));
    return e;
}

/** Whether the user has purchased this stream (a user_course row on the backing course exists). */
export async function hasBoughtStream(supabase, stream, userId) {
    if (!stream.backing_course_id || !userId) return false;
    const { data } = await supabase
        .from('user_course')
        .select('id')
        .eq('course', stream.backing_course_id)
        .eq('user', userId)
        .limit(1);
    return !!data?.length;
}

/** All streams by a given author, newest first (for the author's own list). */
export async function listMyStreams(supabase, authorId) {
    const { data, error } = await supabase
        .from('streams')
        .select('*')
        .eq('author', authorId)
        .order('created_at', { ascending: false });
    if (error) throw new Error(`Не удалось загрузить эфиры: ${error.message}`);
    return data ?? [];
}

/** Flip a stream's cached status (used by the author's "я в эфире" / "завершить" actions). */
export async function setStreamStatus(supabase, streamId, status) {
    const { error } = await supabase.from('streams').update({ status }).eq('id', streamId);
    if (error) throw new Error(`Не удалось обновить статус: ${error.message}`);
}

import { deleteLive } from '@/_front/streams/peertubeLive.js';

/**
 * Delete a FREE stream (author-only): removes its PeerTube live video, then the streams row.
 * Paid streams are refused here for now — a paid stream is backed by a course that may have
 * buyers, so its deletion is deferred (see the feature notes).
 */
export async function deleteStream(supabase, stream) {
    if (Number(stream.price) > 0 || stream.backing_course_id) {
        throw new Error('Удаление платных эфиров пока недоступно.');
    }
    // Best-effort: remove the PeerTube video, but still delete the row even if that fails.
    if (stream.peertube_video_id) {
        try {
            await deleteLive(supabase, stream.peertube_video_id);
        } catch (e) {
            console.warn('[streams] PeerTube video delete failed:', e.message);
        }
    }
    const { error } = await supabase.from('streams').delete().eq('id', stream.id);
    if (error) throw new Error(`Не удалось удалить эфир: ${error.message}`);
}

// Public list ordering: live first, then scheduled, then ended; newest first within a group.
const STATUS_ORDER = { live: 0, scheduled: 1, ended: 2 };

/** Attach each stream's author user row (Name/Photo/role) via one batched lookup. */
async function attachAuthors(supabase, rows) {
    const ids = [...new Set(rows.map(r => r.author).filter(Boolean))];
    let byId = {};
    if (ids.length) {
        const { data: users } = await supabase.from('users').select('*').in('id', ids);
        byId = Object.fromEntries((users || []).map(u => [u.id, u]));
    }
    return rows.map(r => ({ ...r, authorUser: byId[r.author] || null }));
}

/** All streams for the public list, with authors, ordered live → scheduled → ended. */
export async function listAllStreams(supabase) {
    const { data, error } = await supabase.from('streams').select('*');
    if (error) throw new Error(`Не удалось загрузить эфиры: ${error.message}`);
    const rows = await attachAuthors(supabase, data || []);
    return rows.sort(
        (a, b) =>
            (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) ||
            new Date(b.created_at) - new Date(a.created_at)
    );
}

/** A single stream (with author) for the detail view. */
export async function getStreamById(supabase, id) {
    const { data, error } = await supabase.from('streams').select('*').eq('id', id).limit(1);
    if (error) throw new Error(`Не удалось загрузить эфир: ${error.message}`);
    if (!data?.length) return null;
    const [row] = await attachAuthors(supabase, data);
    return row;
}
