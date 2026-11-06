const percentFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

function amount(value) {
    if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value))) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

// Display only: Price is already the selling price used by CoursePage and addToCart.
// old_price is the original amount stored by the existing course discount editor.
// Never calculate a new selling price or infer a discount from campaign metadata here.
export function getCourseDiscount(course) {
    if (!course || course.Free) return null;
    const price = amount(course.Price);
    const oldPrice = amount(course.old_price);
    if (price === null || oldPrice === null || price <= 0 || oldPrice <= price) return null;

    const percent = (oldPrice - price) / oldPrice * 100;
    // Avoid advertising 0% or 100% when rounding very small/near-total reductions.
    const bounded = percent < 0.1 || percent > 99.9;
    const percentText = percent < 0.1 ? '<0,1' : percent > 99.9 ? '>99,9' : percentFormat.format(percent);
    return { oldPrice, percentText, badgeText: `${bounded ? 'Скидка ' : '−'}${percentText}%` };
}
