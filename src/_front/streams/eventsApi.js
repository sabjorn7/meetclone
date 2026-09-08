// Offline-EVENTS data + payment helpers. DI style like streamsApi.js (pass the shared Supabase
// client). The paid path is a verbatim clone of the course/stream purchase flow (shop → order →
// Prodamus link) — the ONLY money-adjacent code here. Settlement (mark paid, grant, sales, balance)
// is handled by the UNTOUCHED n8n BuyCourse via the Prodamus callback; the server-side DB trigger
// trg_event_order_paid then flips the registration to 'paid' and adds the buyer to the event chat.
//
// KEY money-safety marker: order.event_id (nullable, invisible to BuyCourse) tags an order as an
// event payment so the trigger fires only for events; course/stream orders are untouched.

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
    const urlSuccess = `https://app.meetgu.ru/events/${event.slug || event.id}`;
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
