<template>
    <span class="course-price" :class="{ 'is-free': course.Free, 'has-discount': discount }">
        <span class="course-price__now">
            <span v-if="discount" class="course-price__sr">Цена со скидкой: </span>
            {{ course.Free ? 'Бесплатно' : money(course.Price) + ' ₽' }}
        </span>
        <span v-if="discount" class="course-price__meta">
            <s class="course-price__old"><span class="course-price__sr">Прежняя цена: </span>{{ money(discount.oldPrice) }} ₽</s>
            <span class="course-price__badge" :aria-label="`Скидка ${discount.percentText}%`">{{ discount.badgeText }}</span>
        </span>
    </span>
</template>

<script setup>
import { computed } from 'vue';
import { getCourseDiscount } from '@/_front/course/discount.js';

const props = defineProps({ course: { type: Object, required: true } });
const discount = computed(() => getCourseDiscount(props.course));
function money(value) { return Number(value || 0).toLocaleString('ru-RU'); }
</script>

<style scoped>
.course-price { display: inline-flex; flex-direction: column; align-items: var(--course-price-align, flex-start); gap: 5px; max-width: 100%; line-height: 1.2; font-variant-numeric: tabular-nums; }
.course-price__now { white-space: nowrap; }
.has-discount .course-price__now { font-size: 1.15em; }
.course-price__meta { display: flex; align-items: center; flex-wrap: wrap; gap: 5px 7px; max-width: 100%; }
.course-price__old { color: var(--ink-2); font-size: 0.8em; font-weight: 400; white-space: nowrap; text-decoration: line-through; }
.course-price__badge { padding: 3px 6px; border-radius: 5px; background: var(--orange-tint, #fff0e4); color: var(--orange-ink); font-size: 0.7em; font-weight: 700; white-space: nowrap; }
.course-price__sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
</style>
