// Course purchase / enrollment for the hand-written /course/:slug page (CoursePage.vue).
//
// MONEY-ADJACENT (reviewed before deploy). This mirrors the WeWeb `course_info` buy workflow 1:1:
//   - FREE course → grant access directly (insert user_course + append to the user's arrays), no payment.
//   - PAID course → create ONE `shop` cart row for this course, then hand it to the proven
//     `checkoutCart` (order → Prodamus do=link → persist link → redirect). Settlement (mark paid,
//     grant user_course, sales, balance) stays entirely in the UNTOUCHED n8n `BuyCourse` workflow,
//     invoked by the Prodamus callback — identical to the rest of the site and to purchaseStream.
//
// The paid path deliberately isolates the order to just this course's cart row (same as
// purchaseStream), so clicking "Купить" never sweeps in unrelated rows left in the cart.
import { checkoutCart } from '@/_front/chrome/headerAccount.js';

// The logged-in buyer's `users` row: id + the two arrays the free grant appends to. Reads the stored
// session id (no getSession() — that acquires the Web Locks auth lock and can hang), then fetches the row.
export async function getBuyerRow(sb, uid) {
    if (!sb || !uid) return null;
    const { data } = await sb.from('users')
        .select('id, buied_courses, buied_course_orig')
        .eq('id', uid).limit(1);
    return data?.[0] || null;
}

// Whether the user already owns this course (a user_course row exists) — drives the "Уже в библиотеке" state.
export async function ownsCourse(sb, courseId, uid) {
    if (!sb || !courseId || !uid) return false;
    const { data } = await sb.from('user_course')
        .select('id').eq('course', courseId).eq('user', uid).limit(1);
    return !!data?.length;
}

// FREE grant — verbatim port of the WeWeb free branch (user_course insert 588dd366 + users update
// 89156b89): insert the enrollment, then append its id to buied_courses and the course id to
// buied_course_orig. No payment, no Prodamus.
export async function enrollFree(sb, { buyer, course }) {
    const { data: ucRows, error } = await sb.from('user_course')
        .insert({ user: buyer.id, course: course.id, Free: true })
        .select('id').limit(1);
    if (error) throw new Error(`Запись: ${error.message}`);
    const ucId = ucRows?.[0]?.id;
    const buied_courses = [...(buyer.buied_courses || []), ucId];
    const buied_course_orig = [...(buyer.buied_course_orig || []), course.id];
    await sb.from('users')
        .update({ buied_courses, buied_course_orig })
        .eq('id', buyer.id);
}

// PAID purchase — clone of the WeWeb NewCourse insert (90ddb3ae): one `shop` cart row for this course
// (owner / price=Price / status:'cart' / prolong:12 / position / quantity:1 / course_id / course_name).
// `is_renewal` is left to its DB default (false; audit-only, does not branch n8n logic). Then hand the
// single row to the proven checkoutCart, which builds the order, fetches the Prodamus link and redirects.
export async function buyCourse(sb, { buyer, course }) {
    const price = course.Price;
    const { count } = await sb.from('shop')
        .select('id', { count: 'exact', head: true })
        .eq('owner', buyer.id).eq('status', 'cart');
    const { data: shopRows, error } = await sb.from('shop')
        .insert({
            owner: buyer.id,
            price,
            status: 'cart',
            prolong: 12,
            position: (count || 0) + 1,
            quantity: 1,
            course_id: course.id,
            course_name: course.Title,
        })
        .select('id, price, quantity, course_name, course_id')
        .limit(1);
    if (error) throw new Error(`Корзина: ${error.message}`);
    // checkoutCart isolates the order to just this row and redirects the browser to Prodamus.
    await checkoutCart(sb, { user: buyer, cart: shopRows });
}
