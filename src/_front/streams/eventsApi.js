// Offline-EVENTS data + payment helpers. DI style like streamsApi.js (pass the shared Supabase
// client). The paid path is a verbatim clone of the course/stream purchase flow (shop → order →
// Prodamus link) — the ONLY money-adjacent code here. Settlement (mark paid, grant, sales, balance)
// is handled by the UNTOUCHED n8n BuyCourse via the Prodamus callback; the server-side DB trigger
// trg_event_order_paid then flips the registration to 'paid' and adds the buyer to the event chat.
//
// KEY money-safety marker: order.event_id (nullable, invisible to BuyCourse) tags an order as an
// event payment so the trigger fires only for events; course/stream orders are untouched.

import { deleteLive } from '@/_front/streams/peertubeLive.js';

/**
 * MONEY-ADJACENT: create the hidden backing `course` for an event (clone of streams'
 * createBackingCourse). owner = event creator → BuyCourse credits sales/balance to them on
 * purchase, exactly like a course author. Kept out of the catalog (ModStatus 'Черновик').
 * Returns the new course id. Called from events-manage (E6) at event creation.
 */
export async function createEventBackingCourse(supabase, { owner, title, price }) {
    const { data, error } = await supabase
        .from('course')
        .insert({
            owner,
            Title: title,
            Price: price,
            Free: false,
            DurationLong: 12, // irrelevant for an event flag-course; access is gated by event_registrations
            Category: 'Мероприятия',
            ModStatus: 'Черновик', // NOT 'Опубликовано' → excluded from the catalog
        })
        .select('id')
        .limit(1);
    if (error) throw new Error(`Не удалось создать курс-подложку мероприятия: ${error.message}`);
    return data?.[0]?.id;
}

// The SOLE organizer allowed to manage offline events (MeetGuru company account adv@meetgu.ru).
// This is the /events_manage gate — a per-user check, NOT a role check (unlike courses_manage).
// NOTE: a client-side gate only; events/event_registrations are RLS-off like the rest of the site,
// so this hides the UI but is not a hard DB barrier (consistent with courses_manage). A server/RLS
// barrier would be a separate hardening step.
export const EVENTS_ORGANIZER_USER_ID = 'caa712f8-f5e8-484d-b46d-c56205f52ed1'; // adv@meetgu.ru

export function isEventsOrganizer(userId) {
    return userId === EVENTS_ORGANIZER_USER_ID;
}

// ── CRUD (creator/organizer only; the page gates access) ─────────────────────

const EVENT_FIELDS =
    'id, created_at, slug, title, description, about, what_you_learn, for_whom, starts_at, ends_at, location, speaker_id, cover_url, price, deposit_percent, capacity, chat, backing_course_id, owner, status, video_id, video_size, resume_video_id, resume_chunk, resume_name, review_video_id, review_video_size, review_resume_video_id, review_resume_chunk, review_resume_name';

// Slug generation (ported verbatim from CoursesManagePage: Cyrillic → latin kebab).
const TRANSLIT = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
    к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
    х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};
export function slugify(str) {
    return String(str || '')
        .toLowerCase()
        .split('').map((ch) => (ch in TRANSLIT ? TRANSLIT[ch] : ch)).join('')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'event';
}
/** Unique slug across `events` (append -2, -3… on collision). */
export async function uniqueEventSlug(supabase, base, excludeId = null) {
    let slug = base, n = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        let q = supabase.from('events').select('id').eq('slug', slug).limit(1);
        if (excludeId) q = q.neq('id', excludeId);
        const { data } = await q;
        if (!data || !data.length) return slug;
        n += 1; slug = `${base}-${n}`;
    }
}
/** Backfill: ensure an event has a slug (generate + persist if missing). Returns the slug. */
export async function ensureEventSlug(supabase, ev) {
    if (ev.slug) return ev.slug;
    const slug = await uniqueEventSlug(supabase, slugify(ev.title), ev.id);
    await supabase.from('events').update({ slug }).eq('id', ev.id);
    return slug;
}

/**
 * Create an event. Order matters: create the hidden backing course FIRST so events.backing_course_id
 * is set on insert; the BEFORE INSERT trigger then auto-creates the group chat and fills events.chat.
 */
export async function createEvent(supabase, input) {
    const owner = input.owner;
    const title = (input.title || '').trim();
    const price = Number(input.price) || 0;
    const backingCourseId = await createEventBackingCourse(supabase, { owner, title, price });
    const slug = await uniqueEventSlug(supabase, slugify(title), null);
    const { data, error } = await supabase
        .from('events')
        .insert({
            owner,
            title,
            slug,
            description: (input.description || '').trim(),
            about: (input.about || '').trim() || null,
            what_you_learn: (input.what_you_learn || '').trim() || null,
            for_whom: (input.for_whom || '').trim() || null,
            starts_at: input.starts_at || null,
            ends_at: input.ends_at || null,
            location: (input.location || '').trim() || null,
            speaker_id: input.speaker_id || null,
            cover_url: input.cover_url || null,
            price,
            deposit_percent: input.deposit_percent != null && input.deposit_percent !== '' ? Number(input.deposit_percent) : null,
            capacity: input.capacity != null && input.capacity !== '' ? Number(input.capacity) : null,
            backing_course_id: backingCourseId,
            status: 'draft',
        })
        .select(EVENT_FIELDS)
        .limit(1);
    if (error) throw new Error(`Не удалось создать мероприятие: ${error.message}`);
    return data?.[0];
}

/** Update editable event fields (never owner/chat/backing_course_id). */
export async function updateEvent(supabase, eventId, fields) {
    const patch = {};
    for (const k of ['title', 'description', 'about', 'what_you_learn', 'for_whom', 'starts_at', 'ends_at', 'location', 'speaker_id', 'cover_url', 'price', 'deposit_percent', 'capacity']) {
        if (k in fields) patch[k] = fields[k];
    }
    // No .select()/.limit() on the UPDATE: self-hosted PostgREST rejects a mutation with
    // .limit() and no .order() (PGRST109) and rolls it back. The caller refetches via load().
    const { error } = await supabase.from('events').update(patch).eq('id', eventId);
    if (error) throw new Error(`Не удалось сохранить мероприятие: ${error.message}`);
}

/** Single event by id (public read). Returns null if not found. */
export async function getEventById(supabase, id) {
    const { data, error } = await supabase.from('events').select(EVENT_FIELDS).eq('id', id).limit(1);
    if (error) throw new Error(error.message);
    return data?.[0] || null;
}

/** Single event by slug (public read; page applies the draft-visibility gate). */
export async function getEventBySlug(supabase, slug) {
    if (!slug) return null;
    const { data, error } = await supabase.from('events').select(EVENT_FIELDS).eq('slug', slug).limit(1);
    if (error) throw new Error(error.message);
    return data?.[0] || null;
}

/** Published events for the public calendar, earliest first. */
export async function listPublishedEvents(supabase) {
    const { data, error } = await supabase
        .from('events')
        .select('id, slug, title, starts_at, ends_at, location, cover_url, price, deposit_percent, capacity, status')
        .eq('status', 'published')
        .order('starts_at', { ascending: true, nullsFirst: false });
    if (error) throw new Error(`Не удалось загрузить мероприятия: ${error.message}`);
    return data || [];
}

/** Brief user card for display (speaker on the detail page). */
export async function getUserBrief(supabase, userId) {
    if (!userId) return null;
    const { data } = await supabase.from('users').select('id, "Name", "Photo"').eq('id', userId).limit(1);
    return data?.[0] || null;
}

/** Fuller speaker profile for the event detail "О спикере" section (bio + socials). */
export async function getSpeakerProfile(supabase, userId) {
    if (!userId) return null;
    const { data } = await supabase
        .from('users')
        .select('id, "Name", "Photo", "Description", city, vk_url, youtube_url, whatsapp_url, telegram_url, website_url, booking_url')
        .eq('id', userId)
        .limit(1);
    return data?.[0] || null;
}

/** Save a call-back request (phone lead). n8n polls status='new' → emails adv@meetgu.ru → marks notified. */
export async function submitContactRequest(supabase, { event, phone }) {
    const p = (phone || '').trim();
    if (p.replace(/\D/g, '').length < 6) throw new Error('Введите корректный номер телефона.');
    const { error } = await supabase.from('event_contact_requests').insert({ event: event || null, phone: p });
    if (error) throw new Error(`Не удалось отправить заявку: ${error.message}`);
}

/** Search users by name/email for the speaker picker (same pattern as chat member search). */
export async function searchUsers(supabase, query) {
    const q = (query || '').trim();
    if (!q) return [];
    const { data } = await supabase
        .from('users')
        .select('id, "Name", "Photo", email')
        .or(`Name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(20);
    return data || [];
}

/** The organizer's events, newest first. */
export async function listMyEvents(supabase, ownerId) {
    const { data, error } = await supabase.from('events').select(EVENT_FIELDS).eq('owner', ownerId).order('created_at', { ascending: false });
    if (error) throw new Error(`Не удалось загрузить мероприятия: ${error.message}`);
    return data || [];
}

/** Count paid registrations for an event (roster size / capacity display / delete guard). */
export async function countPaidRegistrations(supabase, eventId) {
    const { count } = await supabase
        .from('event_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('event', eventId)
        .eq('status', 'paid');
    return count || 0;
}

/**
 * Roster for the organizer: registrations joined to the buyer (users FK `user`), showing
 * paid + pending (cancelled hidden as noise). Embeds via event_registrations_user_fkey.
 */
export async function listEventRegistrations(supabase, eventId) {
    const { data, error } = await supabase
        .from('event_registrations')
        .select('id, status, payment_type, amount_paid, amount_total, created_at, user:users(id, "Name", email)')
        .eq('event', eventId)
        .in('status', ['paid', 'pending'])
        .order('created_at', { ascending: true });
    if (error) throw new Error(`Не удалось загрузить участников: ${error.message}`);
    return data || [];
}

/** Publish (draft → published) — the organizer self-publishes (no admin moderation for events). */
export async function publishEvent(supabase, eventId) {
    const { error } = await supabase.from('events').update({ status: 'published' }).eq('id', eventId);
    if (error) throw new Error(`Не удалось опубликовать: ${error.message}`);
}

/**
 * Delete an event. Three tables FK-reference events (all ON DELETE NO ACTION), so ANY leftover
 * child row raises a raw "violates foreign key constraint" error unless cleared first:
 *   event_registrations.event · order.event_id · event_contact_requests.event
 *
 *  - REFUSED with a plain message if real money is attached — a PAID registration OR a PAID order.
 *  - Otherwise clears the unpaid references (no money moved) so an abandoned/test event is deletable:
 *      · registrations → delete non-paid rows
 *      · orders        → DETACH unpaid orders (event_id → null): keep the payment record, drop the FK
 *      · contact reqs  → DETACH (event → null): keep the phone lead, drop the FK
 * No .select()/.limit() on any mutation — self-hosted PostgREST rejects UPDATE/DELETE+limit
 * without an .order() (PGRST109).
 */
export async function deleteEvent(supabase, eventId) {
    const paidRegs = await countPaidRegistrations(supabase, eventId);
    // A paid order also flips a registration to 'paid' via trg_event_order_paid, but check both.
    const { count: paidOrders } = await supabase
        .from('order')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('paid', true);
    if (paidRegs > 0 || (paidOrders || 0) > 0) {
        throw new Error(`Нельзя удалить: у мероприятия есть оплатившие участники (${paidRegs || paidOrders}). Сначала оформите возвраты.`);
    }

    // best-effort: drop the event's PeerTube videos (teaser + reviews) so they don't orphan
    const ev = await getEventById(supabase, eventId).catch(() => null);
    for (const vid of [ev?.video_id, ev?.review_video_id]) {
        if (vid) { try { await deleteLive(supabase, vid); } catch (_) { /* already gone */ } }
    }

    // .neq('status','paid') / .eq('paid', false) are safety belts: a row flipped to paid by a
    // callback mid-delete is never touched here.
    const r1 = await supabase.from('event_registrations').delete().eq('event', eventId).neq('status', 'paid');
    if (r1.error) throw new Error(`Не удалось очистить незавершённые регистрации: ${r1.error.message}`);
    const r2 = await supabase.from('order').update({ event_id: null }).eq('event_id', eventId).eq('paid', false);
    if (r2.error) throw new Error(`Не удалось отвязать незавершённые заказы: ${r2.error.message}`);
    const r3 = await supabase.from('event_contact_requests').update({ event: null }).eq('event', eventId);
    if (r3.error) throw new Error(`Не удалось отвязать заявки на звонок: ${r3.error.message}`);

    const { error } = await supabase.from('events').delete().eq('id', eventId);
    if (error) {
        // Everything unpaid was cleared above; a lingering registrations-FK means a paid row
        // appeared mid-delete. Match ONLY that constraint — not any "foreign key" text.
        if (/event_registrations_event_fkey/i.test(error.message)) {
            throw new Error('Нельзя удалить: у мероприятия появились оплатившие участники.');
        }
        throw new Error(`Не удалось удалить: ${error.message}`);
    }
}

/** How much this payment charges: full price, or the deposit share (rounded to the ruble). */
export function eventAmount(event, paymentType) {
    if (paymentType === 'deposit') {
        if (!event.deposit_percent) throw new Error('Для этого мероприятия предоплата недоступна.');
        return Math.round((Number(event.price) * Number(event.deposit_percent)) / 100);
    }
    return Number(event.price);
}

/** The current user's registration for an event, or null (drives the "Вы записаны" gate). */
export async function getMyEventRegistration(supabase, eventId, userId) {
    const { data, error } = await supabase
        .from('event_registrations')
        .select('id, status, payment_type, amount_paid, amount_total')
        .eq('event', eventId)
        .eq('user', userId)
        .limit(1);
    if (error) throw new Error(error.message);
    return data?.[0] || null;
}

/**
 * MONEY: initiate an event registration payment — clone of purchaseStream.
 * `paymentType` = 'full' | 'deposit'. Returns the Prodamus payment URL (caller redirects).
 * Gates: already-paid → blocked; a leftover 'pending' registration is reused (unique(event,user));
 * capacity (if set) → blocked when paid registrations already fill it.
 */
export async function purchaseEvent(supabase, { buyer, event, paymentType }) {
    if (!event?.backing_course_id) throw new Error('У мероприятия нет курса-подложки.');
    if (paymentType !== 'full' && paymentType !== 'deposit') throw new Error('Неверный тип оплаты.');
    const amount = eventAmount(event, paymentType);
    if (!(amount > 0)) throw new Error('Некорректная сумма к оплате.');

    // Gate 1: existing registration. paid → block; pending/cancelled → reuse the row (unique(event,user)).
    const existing = await getMyEventRegistration(supabase, event.id, buyer);
    if (existing && existing.status === 'paid') {
        throw new Error('Вы уже записаны на это мероприятие.');
    }

    // Gate 2: capacity (simple, non-locking count of paid registrations).
    if (event.capacity != null) {
        const { count } = await supabase
            .from('event_registrations')
            .select('id', { count: 'exact', head: true })
            .eq('event', event.id)
            .eq('status', 'paid');
        if ((count || 0) >= Number(event.capacity)) {
            throw new Error('На мероприятии не осталось свободных мест.');
        }
    }

    // 1) shop cart row (price = the chosen amount — full or deposit)
    const { count: cartCount } = await supabase
        .from('shop')
        .select('id', { count: 'exact', head: true })
        .eq('owner', buyer)
        .eq('status', 'cart');
    const { data: shopRows, error: shopErr } = await supabase
        .from('shop')
        .insert({
            owner: buyer,
            price: amount,
            status: 'cart',
            prolong: 12,
            position: (cartCount || 0) + 1,
            quantity: 1,
            course_id: event.backing_course_id,
            course_name: event.title,
        })
        .select('id')
        .limit(1);
    if (shopErr) throw new Error(`Корзина: ${shopErr.message}`);
    const shopId = shopRows?.[0]?.id;

    // 2) order — isolated to this event; event_id is the trigger marker (invisible to BuyCourse)
    const { data: orderRows, error: orderErr } = await supabase
        .from('order')
        .insert({ summ: amount, owner: buyer, course_positions: [shopId], event_id: event.id })
        .select('id')
        .limit(1);
    if (orderErr) throw new Error(`Заказ: ${orderErr.message}`);
    const orderId = orderRows?.[0]?.id;

    // 3) registration (pending) linked to the order — the trigger flips it to 'paid' on callback.
    //    Reuse a leftover pending row (unique(event,user)) or insert a fresh one.
    const regFields = {
        payment_type: paymentType,
        amount_paid: amount,
        amount_total: Number(event.price),
        order: orderId,
        status: 'pending',
    };
    if (existing) {
        const { error: upErr } = await supabase
            .from('event_registrations')
            .update(regFields)
            .eq('id', existing.id);
        if (upErr) throw new Error(`Регистрация: ${upErr.message}`);
    } else {
        const { error: insErr } = await supabase
            .from('event_registrations')
            .insert({ event: event.id, user: buyer, ...regFields });
        if (insErr) throw new Error(`Регистрация: ${insErr.message}`);
    }

    // 4) build + fetch the Prodamus payment link (same builder as courses/streams)
    const base = 'https://meetguru.payform.ru/?do=link&sys=meetguru';
    const urlSuccess = `https://app.meetgu.ru/events?event=${event.id}`;
    const products =
        `products[0][price]=${encodeURIComponent(amount)}` +
        `&products[0][quantity]=1` +
        `&products[0][name]=${encodeURIComponent(event.title)}`;
    const buildUrl = `${base}&order_id=${encodeURIComponent(orderId)}&${products}&urlSuccess=${encodeURIComponent(urlSuccess)}`;
    const res = await fetch(buildUrl);
    if (!res.ok) throw new Error(`Prodamus (${res.status})`);
    const payLink = (await res.text()).trim();
    if (!/^https?:\/\//.test(payLink)) throw new Error('Prodamus вернул не ссылку.');

    // 5) store num + pageUrl on the order
    await supabase.from('order').update({ num: orderId, pageUrl: payLink }).eq('id', orderId);

    return payLink;
}
