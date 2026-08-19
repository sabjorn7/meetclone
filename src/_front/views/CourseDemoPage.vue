<!--
  CourseDemoPage.vue — DEMO / EXPERIMENT: a course landing in the MeetGuru promo (pd-*) brand
  language. route: /course-demo?slug=<slug> (or ?id=<uuid>). Content-only — the shared
  AppHeader/AppFooter come from App.vue. Course + author + lessons are fetched from Supabase.
  The "Купить" CTA links to the real /course/<slug> page (this prototype does NOT process payment).
-->
<template>
    <main class="pd" :class="{ 'is-ready': ready }" ref="rootEl">
        <template v-if="course">
            <!-- ── HERO ─────────────────────────────────────────────── -->
            <header class="pd-hero">
                <div class="pd-blob" aria-hidden="true"></div>
                <div class="pd-wrap pd-hero__grid">
                    <div class="pd-hero__lead">
                        <span class="pd-badge" data-reveal>
                            <span class="pd-badge__dot" aria-hidden="true"></span>{{ course.Category || 'Курс' }}
                        </span>
                        <h1 class="pd-hero__title pd-hero__title--course" data-reveal>{{ course.Title }}</h1>
                        <p v-if="hook" class="pd-hero__hook" data-reveal>{{ hook }}</p>

                        <div class="pd-buybar" data-reveal>
                            <div class="pd-buybar__price">
                                <span class="pd-buybar__now">{{ priceText }}</span>
                                <span v-if="course.old_price" class="pd-buybar__old">{{ money(course.old_price) }} ₽</span>
                            </div>
                            <a class="pd-btn pd-btn--lg" :href="buyHref">Купить</a>
                        </div>

                        <ul class="pd-facts" data-reveal>
                            <li><svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M4 5h11a2 2 0 0 1 2 2v12l-4-2-4 2V7a2 2 0 0 0-2-2H4z"/></svg>{{ lessons.length || course.Less_Id?.length || 0 }} {{ lessonWord(lessons.length || course.Less_Id?.length || 0) }}</li>
                            <li v-if="course.DurationLong"><svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9h16M9 3v4M15 3v4"/></svg>Доступ {{ course.DurationLong }} мес.</li>
                            <li v-if="!course.Free"><svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 3v18M7 8h7a3 3 0 0 1 0 6H8"/></svg>Онлайн, из любой точки</li>
                        </ul>

                        <a v-if="author" class="pd-author-mini" :href="authorHref" data-reveal>
                            <img v-if="author.Photo" :src="author.Photo" :alt="author.Name" />
                            <span v-else class="pd-author-mini__ava">{{ authorInitials }}</span>
                            <span class="pd-author-mini__text"><span class="muted">Курс от</span><b>{{ author.Name }}</b></span>
                        </a>
                    </div>

                    <aside class="pd-hero__art" data-reveal>
                        <div class="pd-video">
                            <iframe v-if="videoEmbed" :src="videoEmbed" title="Видео о курсе" frameborder="0"
                                allow="fullscreen" allowfullscreen loading="lazy"></iframe>
                            <div v-else class="pd-video__empty"><svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></div>
                        </div>
                    </aside>
                </div>
            </header>

            <!-- ── WHAT YOU'LL LEARN ────────────────────────────────── -->
            <section v-if="learnItems.length" class="pd-section pd-section--tint">
                <div class="pd-wrap">
                    <h2 class="pd-h2" data-reveal>Чему вы научитесь</h2>
                    <ul class="pd-learn">
                        <li v-for="(t, i) in learnItems" :key="i" class="pd-learn__item" data-reveal :style="{ '--i': Math.min(i, 6) }">
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M4 12l5 5L20 6"/></svg>
                            <span>{{ t }}</span>
                        </li>
                    </ul>
                </div>
            </section>

            <!-- ── PROGRAM (lessons) ────────────────────────────────── -->
            <section v-if="lessons.length" class="pd-section">
                <div class="pd-wrap">
                    <div class="pd-head">
                        <h2 class="pd-h2" data-reveal>Программа курса</h2>
                        <p class="pd-head__note" data-reveal>{{ lessons.length }} {{ lessonWord(lessons.length) }}.</p>
                    </div>
                    <ol class="pd-lessons">
                        <li v-for="(l, i) in lessons" :key="l.id" class="pd-lesson" data-reveal :style="{ '--i': Math.min(i, 6) }">
                            <span class="pd-lesson__num">{{ String(i + 1).padStart(2, '0') }}</span>
                            <span class="pd-lesson__title">{{ cleanLesson(l.Title) }}</span>
                        </li>
                    </ol>
                </div>
            </section>

            <!-- ── ABOUT ────────────────────────────────────────────── -->
            <section v-if="descrParagraphs.length" class="pd-section pd-section--tint">
                <div class="pd-wrap pd-about">
                    <h2 class="pd-h2" data-reveal>О курсе</h2>
                    <div class="pd-about__body" data-reveal>
                        <p v-for="(p, i) in descrParagraphs" :key="i">{{ p }}</p>
                    </div>
                </div>
            </section>

            <!-- ── FOR WHOM ─────────────────────────────────────────── -->
            <section v-if="forItems.length" class="pd-section">
                <div class="pd-wrap">
                    <h2 class="pd-h2" data-reveal>Кому подойдёт</h2>
                    <div class="pd-cards pd-cards--for">
                        <article v-for="(t, i) in forItems" :key="i" class="pd-forcard" data-reveal :style="{ '--i': Math.min(i, 6) }">
                            <span class="pd-forcard__dot" aria-hidden="true"></span>
                            <p>{{ t }}</p>
                        </article>
                    </div>
                </div>
            </section>

            <!-- ── PRICE ────────────────────────────────────────────── -->
            <section class="pd-price-wrap">
                <div class="pd-wrap">
                    <div class="pd-price" data-reveal>
                        <div class="pd-price__l">
                            <h2 class="pd-price__h">{{ course.Free ? 'Бесплатный курс' : 'Доступ к курсу' }}</h2>
                            <p class="pd-price__sub">{{ course.Title }}</p>
                            <ul class="pd-price__incl">
                                <li><svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M4 12l5 5L20 6"/></svg>{{ lessons.length || course.Less_Id?.length || 0 }} {{ lessonWord(lessons.length || course.Less_Id?.length || 0) }} в записи</li>
                                <li v-if="course.DurationLong"><svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M4 12l5 5L20 6"/></svg>Доступ на {{ course.DurationLong }} мес.<template v-if="course.DurationPrice">, продление {{ money(course.DurationPrice) }} ₽</template></li>
                                <li><svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M4 12l5 5L20 6"/></svg>Смотрите на сайте и в приложении</li>
                            </ul>
                        </div>
                        <div class="pd-price__card">
                            <span class="pd-price__label">Стоимость</span>
                            <div class="pd-price__amount">
                                {{ course.Free ? 'Бесплатно' : money(course.Price) }}<span v-if="!course.Free" class="cur"> ₽</span>
                            </div>
                            <p v-if="course.old_price" class="pd-price__old">{{ money(course.old_price) }} ₽</p>
                            <a class="pd-btn pd-btn--lg pd-btn--block" :href="buyHref">Купить</a>
                            <p class="pd-price__demo">Демонстрация — покупка проходит на странице курса.</p>
                        </div>
                    </div>
                </div>
            </section>
        </template>

        <div v-else-if="loading" class="pd-state">Загрузка курса…</div>
        <div v-else class="pd-state">Курс не найден.</div>
    </main>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { getSupabase } from '@/_front/chrome/headerAccount.js';
import { embedUrl } from '@/_front/streams/peertubeLive.js';

const route = useRoute();
const rootEl = ref(null);
const course = ref(null);
const author = ref(null);
const lessons = ref([]);
const loading = ref(true);
const ready = ref(false);

// bullet lists are stored as "- item\n- item"; split, strip the marker, drop blanks.
function bullets(text) {
    return (text || '').split(/\n+/).map((l) => l.replace(/^[\s•\-–—*]+/, '').trim()).filter(Boolean);
}
const hook = computed(() => {
    const d = (course.value?.Decription || '').trim().split(/\n{2,}/)[0].trim();
    return d.length > 220 ? d.slice(0, 217).trimEnd() + '…' : d;
});
const descrParagraphs = computed(() => (course.value?.Decription || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean));
const learnItems = computed(() => bullets(course.value?.WhatTeach));
const forItems = computed(() => bullets(course.value?.For));
const priceText = computed(() => (course.value?.Free ? 'Бесплатно' : `${money(course.value?.Price)} ₽`));
const videoEmbed = computed(() => (course.value?.video_id ? embedUrl(course.value.video_id) : ''));
const buyHref = computed(() => `/course/${course.value?.slug || course.value?.id}`);
const authorHref = computed(() => (author.value ? `/profile_page?user=${author.value.id}` : '#'));
const authorInitials = computed(() => {
    const parts = (author.value?.Name || '').split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '·';
});

function money(n) { return Number(n || 0).toLocaleString('ru-RU'); }
function lessonWord(n) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return 'уроков';
    if (b > 1 && b < 5) return 'урока';
    if (b === 1) return 'урок';
    return 'уроков';
}
function cleanLesson(t) { return (t || '').replace(/^\s*\d+[.)]\s*/, ''); } // drop a leading "1. " (we render our own number)

async function load() {
    const slug = route.params.slug || route.query.slug;
    const id = route.query.id;
    const sb = getSupabase();
    if (!sb || (!slug && !id)) { loading.value = false; return; }
    let q = sb.from('course')
        .select('id, "Title", "Decription", "WhatTeach", "For", "Price", "Free", old_price, "Category", video_id, "Less_Id", "DurationLong", "DurationPrice", owner, slug');
    q = slug ? q.eq('slug', slug) : q.eq('id', id);
    const { data } = await q.limit(1);
    course.value = data?.[0] || null;
    if (course.value) {
        document.title = `${course.value.Title} — МитГуру`;
        if (course.value.owner) {
            const { data: au } = await sb.from('users').select('id, "Name", "Photo", role').eq('id', course.value.owner).limit(1);
            author.value = au?.[0] || null;
        }
        const lids = course.value.Less_Id || [];
        if (lids.length) {
            const { data: ls } = await sb.from('lessons').select('id, "Title"').in('id', lids);
            const byId = Object.fromEntries((ls || []).map((l) => [l.id, l]));
            lessons.value = lids.map((lid) => byId[lid]).filter(Boolean); // keep the course's lesson order
        }
    }
    loading.value = false;
    await nextTick();
    ready.value = true; // reactive reveal gate (see ProfilePage.vue)
}

onMounted(() => { ensureFonts(); load(); });

function ensureFonts() {
    if (document.getElementById('pd-fonts')) return;
    const l = document.createElement('link');
    l.id = 'pd-fonts';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
</script>

<style scoped>
.pd {
    --bg: #ffffff; --bg-tint: #f1f6fd; --surface: #ffffff;
    --ink: #091747; --ink-2: #5b6472; --ink-3: #98a0ad; --line: #e4e9f1;
    --blue: #2e70dd; --blue-soft: #5495f3; --blue-strong: #2360c6; --blue-ink: #1f5fc9; --blue-tint: #eaf1fe;
    --orange: #f09157; --orange-bright: #ff7a1a; --orange-ink: #c2410c;
    --btn-ink: #ffffff; --r-lg: 26px; --r-md: 16px; --r-pill: 999px;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --shadow: 0 14px 40px -20px rgba(9, 23, 71, 0.24); --shadow-sm: 0 4px 16px -8px rgba(9, 23, 71, 0.18);
    --wrap: 1200px;
    background: var(--bg); color: var(--ink);
    font-family: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 17px; line-height: 1.55; -webkit-font-smoothing: antialiased; overflow-x: hidden;
}
.pd *, .pd *::before, .pd *::after { box-sizing: border-box; }
.pd-wrap { width: 100%; max-width: var(--wrap); margin-inline: auto; padding-inline: 40px; }
.pd-section { padding: 80px 0; }
.pd-section--tint { background: var(--bg-tint); }
.pd-ic { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; display: block; }
.pd-h2 { margin: 0 0 32px; font-weight: 700; font-size: clamp(1.9rem, 4vw, 3rem); line-height: 1.06; letter-spacing: -0.02em; }
.pd-state { max-width: var(--wrap); margin: 120px auto; padding: 0 40px; text-align: center; color: var(--ink-2); font-size: 1.1rem; }

[data-reveal] { opacity: 0; transform: translateY(20px); transition: opacity 0.6s var(--ease-out), transform 0.6s var(--ease-out); transition-delay: calc(var(--i, 0) * 55ms); }
.pd.is-ready [data-reveal] { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { [data-reveal] { opacity: 1; transform: none; transition: none; } }

.pd-btn { display: inline-block; font-family: inherit; font-weight: 600; font-size: 16px; color: var(--btn-ink); background: var(--blue); border: none; border-radius: var(--r-pill); padding: 15px 28px; cursor: pointer; text-decoration: none; transition: transform 0.16s var(--ease-out), background 0.16s var(--ease-out), box-shadow 0.16s var(--ease-out); box-shadow: 0 10px 26px -12px rgba(46, 112, 221, 0.7); }
.pd-btn:active { transform: translateY(1px); }
@media (hover: hover) and (pointer: fine) { .pd-btn:hover { background: var(--blue-strong); transform: translateY(-2px); box-shadow: 0 16px 32px -14px rgba(46, 112, 221, 0.8); } }
.pd-btn--lg { padding: 16px 34px; font-size: 17px; }
.pd-btn--block { display: block; width: 100%; text-align: center; }

/* ── Hero ───────────────────────────────────────────────────────────────── */
.pd-hero { position: relative; padding: 60px 0 80px; overflow: hidden; }
.pd-blob { position: absolute; top: -180px; right: -150px; width: 620px; height: 620px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, rgba(84, 149, 243, 0.22), rgba(84, 149, 243, 0.05) 60%, transparent 72%); pointer-events: none; z-index: 0; }
.pd-hero__grid { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); gap: 52px; align-items: center; }
.pd-badge { display: inline-flex; align-items: center; gap: 9px; padding: 8px 16px; border-radius: var(--r-pill); background: var(--blue-tint); color: var(--blue-ink); font-weight: 600; font-size: 14px; }
.pd-badge__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--orange); box-shadow: 0 0 0 4px rgba(240, 145, 87, 0.22); }
.pd-hero__title--course { margin: 22px 0 0; font-weight: 700; font-size: clamp(1.9rem, 3.6vw, 3rem); line-height: 1.08; letter-spacing: -0.02em; }
.pd-hero__hook { margin: 20px 0 0; max-width: 54ch; font-size: 1.1rem; color: var(--ink-2); }

.pd-buybar { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; margin-top: 28px; }
.pd-buybar__price { display: flex; align-items: baseline; gap: 12px; }
.pd-buybar__now { font-weight: 700; font-size: 2rem; letter-spacing: -0.02em; }
.pd-buybar__old { color: var(--ink-3); text-decoration: line-through; font-size: 1.1rem; }

.pd-facts { list-style: none; margin: 26px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 12px 24px; }
.pd-facts li { display: inline-flex; align-items: center; gap: 8px; color: var(--ink-2); font-weight: 500; font-size: 0.98rem; }
.pd-facts .pd-ic { width: 19px; height: 19px; color: var(--blue-ink); }

.pd-author-mini { display: inline-flex; align-items: center; gap: 12px; margin-top: 26px; text-decoration: none; color: inherit; }
.pd-author-mini img, .pd-author-mini__ava { width: 46px; height: 46px; border-radius: 50%; object-fit: cover; flex: none; }
.pd-author-mini__ava { display: grid; place-items: center; background: var(--blue-tint); color: var(--blue-ink); font-weight: 700; }
.pd-author-mini__text { display: flex; flex-direction: column; line-height: 1.25; font-size: 0.98rem; }
.pd-author-mini__text .muted { color: var(--ink-3); font-size: 0.85rem; }
@media (hover: hover) and (pointer: fine) { .pd-author-mini:hover b { color: var(--blue-ink); } }

/* teaser video */
.pd-hero__art { display: flex; justify-content: center; width: 100%; }
.pd-video { position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: var(--r-lg); overflow: hidden; background: var(--ink); box-shadow: var(--shadow); border: 1px solid var(--line); }
.pd-video iframe { position: absolute; inset: 0; width: 100%; height: 100%; }
.pd-video__empty { position: absolute; inset: 0; display: grid; place-items: center; background: radial-gradient(120% 120% at 60% 20%, var(--blue-tint), #fff 80%); color: var(--blue-ink); }
.pd-video__empty .pd-ic { width: 54px; height: 54px; fill: currentColor; stroke: none; }

/* ── Learn (checklist) ──────────────────────────────────────────────────── */
.pd-learn { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px 32px; }
.pd-learn__item { display: flex; align-items: flex-start; gap: 12px; font-size: 1.06rem; }
.pd-learn__item .pd-ic { flex: none; width: 24px; height: 24px; stroke-width: 2.6; color: #21a366; margin-top: 2px; }

/* ── Lessons (program) ──────────────────────────────────────────────────── */
.pd-head { margin-bottom: 26px; }
.pd-head .pd-h2 { margin-bottom: 10px; }
.pd-head__note { margin: 0; color: var(--ink-2); }
.pd-lessons { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.pd-lesson { display: grid; grid-template-columns: 58px 1fr; align-items: center; gap: 16px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); padding: 20px 24px; transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .pd-lesson:hover { border-color: rgba(46, 112, 221, 0.4); box-shadow: var(--shadow-sm); } }
.pd-lesson__num { font-weight: 700; font-size: 1.2rem; color: var(--orange-ink); font-variant-numeric: tabular-nums; }
.pd-lesson__title { font-weight: 600; font-size: 1.08rem; line-height: 1.3; letter-spacing: -0.01em; }

/* ── About ──────────────────────────────────────────────────────────────── */
.pd-about { max-width: 820px; }
.pd-about__body p { margin: 0 0 16px; font-size: 1.1rem; color: var(--ink-2); }

/* ── For whom ───────────────────────────────────────────────────────────── */
.pd-cards--for { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.pd-forcard { position: relative; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); padding: 24px 24px 24px 28px; }
.pd-forcard__dot { position: absolute; left: 24px; top: 30px; width: 10px; height: 10px; border-radius: 50%; background: var(--blue-soft); }
.pd-forcard p { margin: 0 0 0 22px; color: var(--ink-2); font-size: 1rem; }

/* ── Price ──────────────────────────────────────────────────────────────── */
.pd-price-wrap { padding: 20px 0 88px; }
.pd-price { display: grid; grid-template-columns: 1.25fr 0.85fr; border-radius: var(--r-lg); overflow: hidden; box-shadow: var(--shadow); }
.pd-price__l { background: var(--blue); color: #fff; padding: 46px 44px; }
.pd-price__h { margin: 0 0 8px; font-weight: 700; font-size: clamp(1.6rem, 3vw, 2.3rem); letter-spacing: -0.02em; line-height: 1.1; }
.pd-price__sub { margin: 0 0 24px; font-weight: 500; color: rgba(255, 255, 255, 0.85); }
.pd-price__incl { list-style: none; margin: 0; padding: 0; display: grid; gap: 13px; }
.pd-price__incl li { display: flex; align-items: flex-start; gap: 12px; font-weight: 500; }
.pd-price__incl .pd-ic { flex: none; width: 22px; height: 22px; stroke-width: 2.4; margin-top: 1px; }
.pd-price__card { background: var(--surface); padding: 42px 40px; display: flex; flex-direction: column; justify-content: center; }
.pd-price__label { font-weight: 500; font-size: 0.9rem; color: var(--ink-3); }
.pd-price__amount { margin: 8px 0 0; font-weight: 700; font-size: clamp(2.6rem, 5vw, 3.6rem); line-height: 0.95; letter-spacing: -0.03em; }
.pd-price__amount .cur { color: var(--orange-ink); }
.pd-price__old { margin: 6px 0 0; color: var(--ink-3); text-decoration: line-through; }
.pd-price__card .pd-btn { margin-top: 22px; }
.pd-price__demo { margin: 12px 0 0; text-align: center; font-size: 0.82rem; color: var(--ink-3); }

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 1000px) {
    .pd-hero__grid { grid-template-columns: 1fr; gap: 34px; }
    .pd-hero__art { order: -1; }
    .pd-cards--for { grid-template-columns: 1fr; }
    .pd-learn { grid-template-columns: 1fr; }
}
@media (max-width: 900px) {
    .pd-wrap { padding-inline: 22px; }
    .pd-section { padding: 56px 0; }
    .pd-price { grid-template-columns: 1fr; }
    .pd-price__l, .pd-price__card { padding: 32px 26px; }
}
@media (max-width: 560px) {
    .pd-lesson { grid-template-columns: 44px 1fr; gap: 12px; padding: 16px 18px; }
    .pd-buybar .pd-btn { width: 100%; text-align: center; }
}
</style>
