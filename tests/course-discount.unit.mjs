import test from 'node:test';
import assert from 'node:assert/strict';
import { getCourseDiscount } from '../src/_front/course/discount.js';

test('uses the stored current/original prices without repricing or mutating the course', () => {
    const course = Object.freeze({ Price: 8400, old_price: 12000, Free: false });
    assert.deepEqual(getCourseDiscount(course), { oldPrice: 12000, percentText: '30', badgeText: '−30%' });
    assert.equal(course.Price, 8400);
    assert.equal(course.old_price, 12000);
    assert.equal(getCourseDiscount({ Price: '8400.00', old_price: '12000.00' }).badgeText, '−30%');
});

test('does not advertise stale, missing or invalid discount data', () => {
    const rows = [null, {}, { Price: 8400 }, { Price: 8400, old_price: null },
        { Price: 8400, old_price: 0 }, { Price: 8400, old_price: 8400 },
        { Price: 12000, old_price: 8400 }, { Price: 0, old_price: 12000 },
        { Price: -1, old_price: 12000 }, { Price: 8400, old_price: 12000, Free: true }];
    for (const row of rows) assert.equal(getCourseDiscount(row), null);
    for (const invalid of [undefined, null, '', ' ', 'unknown', '0xFFFF', true, [], [12000], {}, NaN, Infinity]) {
        assert.equal(getCourseDiscount({ Price: invalid, old_price: 12000 }), null);
        assert.equal(getCourseDiscount({ Price: 8400, old_price: invalid }), null);
    }
});

test('percentage labels preserve fractional discounts and never invent 0% or 100%', () => {
    assert.equal(getCourseDiscount({ Price: 8750, old_price: 10000 }).badgeText, '−12,5%');
    assert.equal(getCourseDiscount({ Price: 9999, old_price: 10000 }).badgeText, 'Скидка <0,1%');
    assert.equal(getCourseDiscount({ Price: 1, old_price: 10000 }).badgeText, 'Скидка >99,9%');
});
