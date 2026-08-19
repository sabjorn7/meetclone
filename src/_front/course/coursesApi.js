// Course purchase / enrollment for the hand-written /course/:slug page (CoursePage.vue).
//
// MONEY-ADJACENT (reviewed before deploy). This mirrors the WeWeb `course_info` buy workflow 1:1:
//   - FREE course → grant access directly (insert user_course + append to the user's arrays), no payment.
//   - PAID course → ADD to the cart only (one `shop` row status='cart', clone of WeWeb NewCourse
//     insert 90ddb3ae). NO order and NO redirect here — checkout happens later from the header cart
//     (headerAccount.checkoutCart), exactly like the old WeWeb "Купить". Settlement (mark paid, grant
//     user_course, sales, balance) stays entirely in the UNTOUCHED n8n `BuyCourse` workflow via the
//     Prodamus callback — identical to the rest of the site.

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

// Whether this course is already sitting in the user's cart (a `shop` row with status='cart') —
// drives the "В корзине" state and guards addToCart against stacking duplicate rows.
export async function courseInCart(sb, courseId, uid) {
    if (!sb || !courseId || !uid) return false;
    const { data } = await sb.from('shop')
        .select('id').eq('owner', uid).eq('status', 'cart').eq('course_id', courseId).limit(1);
    return !!data?.length;
}

// PAID → ADD to cart only — clone of the WeWeb NewCourse insert (90ddb3ae): one `shop` row for this
// course (owner / status:'cart' / prolong:12 / position / quantity:1 / course_id / course_name).
// `renewal` mirrors WeWeb's owner branch: a renewal charges `DurationPrice` and stamps `is_renewal`
// (audit-only, does not branch n8n logic); a fresh buy charges `Price` and leaves `is_renewal` at its
// DB default (false). NO order and NO redirect — the user reviews the header cart and checks out from
// there. Guards against a duplicate row so repeated clicks don't stack the same course. Returns true
// if a row was inserted.
export async function addToCart(sb, { buyer, course, renewal = false }) {
    if (await courseInCart(sb, course.id, buyer.id)) return false; // already in cart → header shows it
    const { count } = await sb.from('shop')
        .select('id', { count: 'exact', head: true })
        .eq('owner', buyer.id).eq('status', 'cart');
    const row = {
        owner: buyer.id,
        price: renewal ? course.DurationPrice : course.Price,
        status: 'cart',
        prolong: 12,
        position: (count || 0) + 1,
        quantity: 1,
        course_id: course.id,
        course_name: course.Title,
    };
    if (renewal) row.is_renewal = true;
    const { error } = await sb.from('shop').insert(row);
    if (error) throw new Error(`Корзина: ${error.message}`);
    return true;
}
