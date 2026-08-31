<!--
  MyCoursePage.vue — "/my_courses?course=<id>" (purchased-course viewer) in the MeetGuru promo (pd-*)
  brand language. Demo at /my-course-demo?course=<id>; the live WeWeb page is untouched until go-live.
  Gets the shared AppHeader/AppFooter.

  Single-course player (not a library): course header, PeerTube lesson video, lesson sidebar (Less_Id order),
  per-lesson material download, «Написать куратору» → /chats, «Вернуться» → /, course rating.

  ACCESS GATE (RLS is OFF site-wide — this is the only protection). Preserves the WeWeb behavior AND closes
  the ownership hole the original had:
    - guest → /login
    - free course → allowed
    - paid course not owned (no user_course row) → /course/<slug> (buy)
    - owned but expired (DurationLong≠0 && real end_period < now) → /course/<slug> (renew)
    - else → play. Also writes users.last_open = course.id (as the original did).
-->
<template>
    <main class="pd" :class="{ 'is-ready': ready }">
        <div v-if="loading" class="pd-wrap pd-load">Загрузка…</div>
        <div v-else-if="!course" class="pd-wrap pd-load">
            <p>Курс не найден.</p>
            <a href="/" class="pd-btn">На главную</a>
        </div>

        <section v-else class="pd-section">
            <div class="pd-wrap">
                <div class="pd-head" data-reveal>
                    <a href="/" class="pd-back">
                        <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>
                        Мои курсы
                    </a>
                    <h1 class="pd-head__title">{{ course.Title }}</h1>
                    <p v-if="course.Decription" class="pd-head__descr">{{ course.Decription }}</p>
                    <div class="pd-head__meta">
                        <a v-if="author" class="pd-author" :href="`/profile_page?user=${author.id}`">
                            <img v-if="author.Photo" :src="author.Photo" :alt="author.Name" /><span v-else class="pd-author__i">{{ initials(author.Name) }}</span>
                            <b>{{ author.Name }}</b>
                        </a>
                        <span v-if="ratingAvg" class="pd-rate">
                            <svg viewBox="0 0 24 24" class="pd-star" aria-hidden="true"><path d="M12 2l3 6.5 7 .9-5 4.8 1.3 7L12 18l-6.6 3.2L6.7 14l-5-4.8 7-.9z"/></svg>
                            {{ ratingAvg }}
                        </span>
                    </div>
                </div>

                <div class="pd-player" data-reveal>
                    <!-- video -->
                    <div class="pd-video">
                        <template v-if="currentLesson && currentLesson.video_id">
                            <iframe v-if="videoStarted" :key="currentLesson.id" :src="videoUrl" title="Урок" frameborder="0" allowfullscreen allow="autoplay; fullscreen; picture-in-picture"></iframe>
                            <button v-else type="button" class="pd-video__poster" @click="videoStarted = true" aria-label="Смотреть урок">
                                <img v-if="posterUrl" :src="posterUrl" alt="" />
                                <span class="pd-video__play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
                            </button>
                        </template>
                        <div v-else class="pd-video__empty">Видео урока недоступно</div>
                    </div>

                    <!-- lessons -->
                    <aside class="pd-lessons">
                        <h2 class="pd-lessons__title">Уроки курса</h2>
                        <ul class="pd-lessons__list">
                            <li v-for="(l, i) in lessons" :key="l.id">
                                <button type="button" class="pd-lesson" :class="{ 'is-on': l.id === currentLessonId }" @click="selectLesson(l.id)">
                                    <span class="pd-lesson__n">{{ i + 1 }}</span>
                                    <span class="pd-lesson__name">{{ l.Title || `Урок ${i + 1}` }}</span>
                                    <svg v-if="l.File" viewBox="0 0 24 24" class="pd-ic pd-lesson__file" aria-hidden="true"><path d="M14 3v5h5M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
                                </button>
                            </li>
                        </ul>
                        <p v-if="!lessons.length" class="pd-lessons__empty">В этом курсе пока нет уроков.</p>
                    </aside>
                </div>

                <!-- lesson description + material -->
                <div v-if="currentLesson && (currentLesson.Descr || currentLesson.File)" class="pd-lessoninfo" data-reveal>
                    <p v-if="currentLesson.Descr" class="pd-lessoninfo__descr">{{ currentLesson.Descr }}</p>
                    <a v-if="currentLesson.File" class="pd-btn pd-btn--ghost" :href="currentLesson.File" target="_blank" rel="noopener noreferrer" download>
                        <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/></svg>
                        Скачать материал
                    </a>
                </div>

                <!-- reviews: write a rating + optional comment, then existing reviews -->
                <section class="pd-reviews" data-reveal>
                    <h2 class="pd-reviews__title">{{ myRating ? 'Ваш отзыв о курсе' : 'Оставьте отзыв о курсе' }}</h2>
                    <div class="pd-rform">
                        <div class="pd-stars" role="radiogroup" aria-label="Ваша оценка">
                            <button
                                v-for="n in 5" :key="n" type="button" class="pd-stars__b"
                                :class="{ on: n <= (hoverRating || formRating) }"
                                role="radio" :aria-checked="n === formRating" :aria-label="`${n} из 5`"
                                @click="formRating = n" @mouseenter="hoverRating = n" @mouseleave="hoverRating = 0">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 6.5 7 .9-5 4.8 1.3 7L12 18l-6.6 3.2L6.7 14l-5-4.8 7-.9z"/></svg>
                            </button>
                        </div>
                        <textarea
                            v-model="formText" class="pd-rform__text" rows="3" maxlength="1500"
                            placeholder="Поделитесь впечатлением о курсе (необязательно)"></textarea>
                        <div class="pd-rform__foot">
                            <button type="button" class="pd-btn" :disabled="!formRating || submitting" @click="submitReview">
                                {{ submitting ? 'Сохраняем…' : (myRating ? 'Обновить отзыв' : 'Отправить отзыв') }}
                            </button>
                            <span v-if="justSaved" class="pd-rform__ok">Спасибо! Отзыв сохранён.</span>
                            <span v-if="reviewError" class="pd-rform__err">{{ reviewError }}</span>
                        </div>
                    </div>

                    <ul v-if="reviews.length" class="pd-rlist">
                        <li v-for="(r, i) in reviews" :key="i" class="pd-rev">
                            <img v-if="r.photo" :src="r.photo" :alt="r.name" class="pd-rev__ph" />
                            <span v-else class="pd-rev__ph pd-rev__ph--i">{{ initials(r.name) }}</span>
                            <div class="pd-rev__body">
                                <div class="pd-rev__top">
                                    <b class="pd-rev__name">{{ r.name || 'Новый пользователь' }}</b>
                                    <span v-if="ratingByUser[r.user_id]" class="pd-rev__stars" :aria-label="`Оценка ${ratingByUser[r.user_id]} из 5`">
                                        <svg v-for="n in 5" :key="n" viewBox="0 0 24 24" :class="{ on: n <= ratingByUser[r.user_id] }" aria-hidden="true"><path d="M12 2l3 6.5 7 .9-5 4.8 1.3 7L12 18l-6.6 3.2L6.7 14l-5-4.8 7-.9z"/></svg>
                                    </span>
                                    <time v-if="r.date" class="pd-rev__date">{{ fmtDate(r.date) }}</time>
                                </div>
                                <p class="pd-rev__text">{{ r.comment }}</p>
                            </div>
                        </li>
                    </ul>
                </section>

                <div class="pd-foot" data-reveal>
                    <a href="/" class="pd-btn pd-btn--ghost">Вернуться</a>
                    <a v-if="author && myId && author.id !== myId" class="pd-btn" :href="`/chats?user=${author.id}`">Написать куратору</a>
                </div>
            </div>
        </section>
    </main>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { getSupabase, readStoredSession, authCookieUser } from '@/_front/chrome/headerAccount.js';
import { ownsCourse } from '@/_front/course/coursesApi.js';
import { embedUrl } from '@/_front/streams/peertubeLive.js';

const PEERTUBE = 'https://video.meetgu.ru';
const route = useRoute();
let sb = null;

const myId = ref(null);
const me = ref(null);
const loading = ref(true);
const ready = ref(false);
const course = ref(null);
const author = ref(null);
const lessons = ref([]);
const currentLessonId = ref(null);
const videoStarted = ref(false);
const posterUrl = ref('');

// review form
const formRating = ref(0);
const hoverRating = ref(0);
const formText = ref('');
const submitting = ref(false);
const justSaved = ref(false);
const reviewError = ref('');

const currentLesson = computed(() => lessons.value.find((l) => l.id === currentLessonId.value) || null);
const videoUrl = computed(() => (currentLesson.value?.video_id ? embedUrl(currentLesson.value.video_id, { autoplay: true }) : ''));
const ratingAvg = computed(() => {
    const r = course.value?.rating;
    if (!Array.isArray(r) || !r.length) return '';
    // rating entries are {user_id, rating} objects (same shape CoursePage reads), not bare numbers.
    const vals = r.map((it) => Number(it?.rating ?? it?.value ?? it ?? 0)).filter((n) => Number.isFinite(n) && n > 0);
    if (!vals.length) return '';
    return (Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100).toString().replace('.', ',');
});

// the current user's own rating (rating is one-per-user, upsert), 0 if not rated yet
const myRating = computed(() => {
    const r = course.value?.rating;
    if (!Array.isArray(r)) return 0;
    const mine = r.find((x) => x?.user_id === myId.value);
    return mine ? Number(mine.rating) || 0 : 0;
});
// existing comments, newest first
const reviews = computed(() => {
    const c = course.value?.comment;
    if (!Array.isArray(c)) return [];
    return c.filter((x) => x && x.comment).slice().sort((a, b) => new Date(b?.date || 0) - new Date(a?.date || 0));
});
// star grade per author (matched by user_id) so a review card can show its rating
const ratingByUser = computed(() => {
    const m = {};
    for (const r of (course.value?.rating || [])) if (r?.user_id != null) m[r.user_id] = Number(r.rating ?? 0);
    return m;
});

function initials(name) {
    const p = (name || '').split(/\s+/).filter(Boolean);
    return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '·';
}
function courseHref() { return `/course/${course.value.slug || course.value.id}`; }
function fmtDate(d) {
    try { return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }); }
    catch (e) { return ''; }
}

// Submit a review: rating is upserted per user (one entry), a non-empty comment is appended.
// Mirrors the WeWeb original's shape; re-reads the arrays right before writing to shrink the
// read-modify-write window (RLS is off, so there's no server-side merge).
async function submitReview() {
    if (!formRating.value || submitting.value || !sb || !course.value) return;
    submitting.value = true; reviewError.value = ''; justSaved.value = false;
    try {
        const { data: fresh, error: readErr } = await sb.from('course').select('rating, comment').eq('id', course.value.id).limit(1);
        if (readErr) throw readErr;
        const cur = fresh?.[0] || {};
        const rating = Array.isArray(cur.rating) ? cur.rating.slice() : [];
        const comment = Array.isArray(cur.comment) ? cur.comment.slice() : [];
        const now = new Date().toISOString();
        const rEntry = { user_id: myId.value, rating: formRating.value, date: now };
        const ri = rating.findIndex((x) => x?.user_id === myId.value);
        if (ri >= 0) rating[ri] = rEntry; else rating.push(rEntry);
        const text = formText.value.trim();
        if (text) comment.push({ user_id: myId.value, name: me.value?.Name || 'Новый пользователь', photo: me.value?.Photo || null, comment: text, date: now });
        const { error } = await sb.from('course').update({ rating, comment }).eq('id', course.value.id);
        if (error) throw error;
        course.value = { ...course.value, rating, comment };
        formText.value = '';
        justSaved.value = true;
        setTimeout(() => { justSaved.value = false; }, 4000);
    } catch (e) {
        reviewError.value = 'Не удалось сохранить отзыв. Попробуйте ещё раз.';
    } finally {
        submitting.value = false;
    }
}

// day-granularity compare (mirrors the WeWeb gate's formatDate(...,"DD.MM.YY") equality test)
function sameDay(a, b) { const x = new Date(a), y = new Date(b); return x.toDateString() === y.toDateString(); }

async function load() {
    sb = getSupabase();
    myId.value = readStoredSession()?.user?.id || authCookieUser()?.id || null;
    const courseId = route.query.course || '';

    // guest → login
    if (!myId.value) { window.location.href = '/login'; return; }
    if (!sb || !courseId) { loading.value = false; return; }

    const { data } = await sb.from('course')
        .select('id, "Title", "Decription", "Less_Id", "Free", "DurationLong", owner, slug, rating, comment, video_id')
        .eq('id', courseId).limit(1);
    course.value = data?.[0] || null;
    if (!course.value) { loading.value = false; return; }

    // ── access gate (RLS off — frontend is the only guard) ───────────────
    if (!course.value.Free) {
        const { data: uc } = await sb.from('user_course').select('id, buy, end_period, created_at').eq('course', course.value.id).eq('user', myId.value).limit(1);
        const row = uc?.[0];
        if (!row) { window.location.href = courseHref(); return; }   // paid + not owned → buy page
        // expired: time-limited access (DurationLong≠0), a real end_period (≠ created_at) in the past
        const dur = Number(course.value.DurationLong || 0);
        if (dur !== 0 && row.end_period && !sameDay(row.end_period, row.created_at) && new Date(row.end_period) < new Date()) {
            window.location.href = courseHref(); return;             // expired → renew page
        }
    }

    document.title = `${course.value.Title} — МитГуру`;
    sb.from('users').update({ last_open: course.value.id }).eq('id', myId.value);   // parity with WeWeb (fire-and-forget)

    // current user (name/photo stamped into a comment) + prefill the star input with their existing grade
    const { data: meRow } = await sb.from('users').select('"Name", "Photo"').eq('id', myId.value).limit(1);
    me.value = meRow?.[0] || null;
    if (myRating.value) formRating.value = myRating.value;

    // author + lessons (in the course's Less_Id order)
    if (course.value.owner) {
        const { data: au } = await sb.from('users').select('id, "Name", "Photo"').eq('id', course.value.owner).limit(1);
        author.value = au?.[0] || null;
    }
    const lids = course.value.Less_Id || [];
    if (lids.length) {
        const { data: ls } = await sb.from('lessons').select('id, "Title", "Descr", "File", video_id').in('id', lids);
        const byId = Object.fromEntries((ls || []).map((l) => [l.id, l]));
        lessons.value = lids.map((lid) => byId[lid]).filter(Boolean);
    }
    if (lessons.value.length) selectLesson(lessons.value[0].id);

    loading.value = false;
    await nextTick();
    ready.value = true;
}

function selectLesson(id) {
    currentLessonId.value = id;
    videoStarted.value = false;
    posterUrl.value = '';
    loadPoster(currentLesson.value?.video_id);
}
async function loadPoster(uuid) {
    if (!uuid) return;
    try {
        const res = await fetch(`${PEERTUBE}/api/v1/videos/${uuid}`);
        if (!res.ok) return;
        const d = await res.json();
        const p = d.thumbnailPath || d.previewPath;
        if (p && currentLesson.value?.video_id === uuid) posterUrl.value = `${PEERTUBE}${p}`;
    } catch (e) { /* no poster */ }
}

onMounted(() => { ensureFonts(); load(); });

function ensureFonts() {
    if (document.getElementById('pd-fonts')) return;
    const l = document.createElement('link');
    l.id = 'pd-fonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
</script>

<style scoped>
.pd {
    --bg: #ffffff; --bg-tint: #f1f6fd; --surface: #ffffff;
    --ink: #091747; --ink-2: #5b6472; --ink-3: #98a0ad; --line: #e4e9f1;
    --blue: #2e70dd; --blue-soft: #5495f3; --blue-strong: #2360c6; --blue-ink: #1f5fc9; --blue-tint: #eaf1fe;
    --gold: #f0a641;
    --r-lg: 22px; --r-md: 14px; --r-pill: 999px;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --shadow-sm: 0 4px 16px -8px rgba(9, 23, 71, 0.18); --shadow: 0 20px 50px -28px rgba(9, 23, 71, 0.32);
    --wrap: 1100px;
    background: var(--bg); color: var(--ink);
    font-family: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 17px; line-height: 1.55; -webkit-font-smoothing: antialiased; overflow-x: hidden;
}
.pd *, .pd *::before, .pd *::after { box-sizing: border-box; }
.pd-wrap { width: 100%; max-width: var(--wrap); margin-inline: auto; padding-inline: 24px; }
.pd-ic { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
[data-reveal] { opacity: 0; transform: translateY(16px); transition: opacity 0.5s var(--ease-out), transform 0.5s var(--ease-out); }
.pd.is-ready [data-reveal] { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { [data-reveal] { opacity: 1; transform: none; transition: none; } }

.pd-section { padding: 34px 0 90px; }
.pd-load { padding: 90px 24px; text-align: center; color: var(--ink-2); }
.pd-load .pd-btn { margin-top: 14px; }

.pd-head { margin-bottom: 26px; }
.pd-back { display: inline-flex; align-items: center; gap: 4px; color: var(--ink-2); text-decoration: none; font-weight: 600; font-size: 0.92rem; }
.pd-back .pd-ic { width: 18px; height: 18px; }
.pd-back:hover { color: var(--blue-ink); }
.pd-head__title { margin: 14px 0 0; font-weight: 800; font-size: clamp(1.7rem, 3.6vw, 2.4rem); line-height: 1.1; letter-spacing: -0.025em; }
.pd-head__descr { margin: 12px 0 0; color: var(--ink-2); font-size: 1.05rem; max-width: 70ch; }
.pd-head__meta { display: flex; align-items: center; gap: 18px; margin-top: 16px; flex-wrap: wrap; }
.pd-author { display: inline-flex; align-items: center; gap: 9px; text-decoration: none; color: var(--ink); }
.pd-author img, .pd-author__i { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; }
.pd-author__i { display: grid; place-items: center; background: var(--blue-tint); color: var(--blue-ink); font-weight: 700; font-size: 0.78rem; }
.pd-author b { font-weight: 600; font-size: 0.95rem; }
.pd-author:hover b { color: var(--blue-ink); }
.pd-rate { display: inline-flex; align-items: center; gap: 5px; font-weight: 700; }
.pd-rate .pd-star { width: 17px; height: 17px; fill: var(--gold); stroke: var(--gold); }

.pd-player { display: grid; grid-template-columns: 1fr 340px; gap: 22px; align-items: start; }
.pd-video { position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: var(--r-lg); overflow: hidden; background: #0b1e52; box-shadow: var(--shadow); }
.pd-video iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.pd-video__poster { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; padding: 0; cursor: pointer; background: #0b1e52; display: grid; place-items: center; }
.pd-video__poster img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.pd-video__play { position: relative; width: 72px; height: 72px; border-radius: 50%; background: rgba(255, 255, 255, 0.92); display: grid; place-items: center; box-shadow: 0 10px 30px -8px rgba(0, 0, 0, 0.5); transition: transform 0.16s var(--ease-out); }
.pd-video__play svg { width: 32px; height: 32px; fill: var(--blue); margin-left: 3px; }
@media (hover: hover) and (pointer: fine) { .pd-video__poster:hover .pd-video__play { transform: scale(1.08); } }
.pd-video__empty { position: absolute; inset: 0; display: grid; place-items: center; color: rgba(255, 255, 255, 0.7); font-size: 0.95rem; }

.pd-lessons { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 18px; }
.pd-lessons__title { margin: 0 0 12px; font-weight: 800; font-size: 1.1rem; letter-spacing: -0.02em; }
.pd-lessons__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.pd-lesson { display: flex; align-items: center; gap: 11px; width: 100%; text-align: left; border: 1px solid transparent; background: var(--bg-tint); border-radius: var(--r-md); padding: 11px 13px; cursor: pointer; font-family: inherit; color: var(--ink); transition: background 0.14s var(--ease-out), border-color 0.14s; }
@media (hover: hover) and (pointer: fine) { .pd-lesson:hover { background: #e7eefb; } }
.pd-lesson.is-on { background: var(--blue-tint); border-color: var(--blue-soft); }
.pd-lesson__n { flex: none; width: 24px; height: 24px; border-radius: 50%; background: var(--surface); border: 1px solid var(--line); display: grid; place-items: center; font-size: 0.78rem; font-weight: 700; color: var(--ink-2); }
.pd-lesson.is-on .pd-lesson__n { background: var(--blue); border-color: var(--blue); color: #fff; }
.pd-lesson__name { flex: 1; min-width: 0; font-size: 0.93rem; font-weight: 500; line-height: 1.3; }
.pd-lesson__file { width: 16px; height: 16px; color: var(--ink-3); flex: none; }
.pd-lessons__empty { color: var(--ink-3); font-size: 0.9rem; }

.pd-lessoninfo { margin-top: 22px; display: flex; flex-direction: column; align-items: flex-start; gap: 14px; }
.pd-lessoninfo__descr { margin: 0; color: var(--ink-2); font-size: 1rem; line-height: 1.6; max-width: 72ch; white-space: pre-wrap; }

/* reviews */
.pd-reviews { margin-top: 40px; padding-top: 30px; border-top: 1px solid var(--line); }
.pd-reviews__title { margin: 0 0 16px; font-weight: 800; font-size: 1.3rem; letter-spacing: -0.02em; }
.pd-rform { background: var(--bg-tint); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 20px; }
.pd-stars { display: inline-flex; gap: 4px; }
.pd-stars__b { border: 0; background: none; padding: 2px; cursor: pointer; line-height: 0; }
.pd-stars__b svg { width: 30px; height: 30px; fill: #d7deea; transition: fill 0.12s var(--ease-out), transform 0.12s var(--ease-out); }
.pd-stars__b.on svg { fill: var(--gold); }
@media (hover: hover) and (pointer: fine) { .pd-stars__b:hover svg { transform: scale(1.12); } }
.pd-rform__text { display: block; width: 100%; margin-top: 14px; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--surface); padding: 12px 14px; font-family: inherit; font-size: 0.98rem; color: var(--ink); resize: vertical; min-height: 68px; }
.pd-rform__text:focus { outline: none; border-color: var(--blue-soft); box-shadow: 0 0 0 3px var(--blue-tint); }
.pd-rform__text::placeholder { color: var(--ink-3); }
.pd-rform__foot { display: flex; align-items: center; gap: 14px; margin-top: 14px; flex-wrap: wrap; }
.pd-btn:disabled { opacity: 0.5; cursor: default; transform: none; }
.pd-rform__ok { color: var(--blue-ink); font-weight: 600; font-size: 0.92rem; }
.pd-rform__err { color: #de0030; font-weight: 600; font-size: 0.92rem; }

.pd-rlist { list-style: none; margin: 24px 0 0; padding: 0; display: flex; flex-direction: column; gap: 18px; }
.pd-rev { display: flex; gap: 13px; }
.pd-rev__ph { flex: none; width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
.pd-rev__ph--i { display: grid; place-items: center; background: var(--blue-tint); color: var(--blue-ink); font-weight: 700; font-size: 0.9rem; }
.pd-rev__body { flex: 1; min-width: 0; }
.pd-rev__top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pd-rev__name { font-weight: 700; font-size: 0.98rem; }
.pd-rev__stars { display: inline-flex; gap: 1px; }
.pd-rev__stars svg { width: 15px; height: 15px; fill: #d7deea; }
.pd-rev__stars svg.on { fill: var(--gold); }
.pd-rev__date { color: var(--ink-3); font-size: 0.84rem; }
.pd-rev__text { margin: 5px 0 0; color: var(--ink-2); font-size: 0.98rem; line-height: 1.55; white-space: pre-wrap; }

.pd-foot { display: flex; align-items: center; gap: 12px; margin-top: 30px; flex-wrap: wrap; }
.pd-btn { display: inline-flex; align-items: center; gap: 8px; border: none; border-radius: var(--r-pill); background: var(--blue); color: #fff; font-family: inherit; font-weight: 700; font-size: 0.96rem; padding: 12px 24px; cursor: pointer; text-decoration: none; transition: background 0.15s var(--ease-out), transform 0.15s var(--ease-out); }
.pd-btn .pd-ic { width: 18px; height: 18px; }
.pd-btn--ghost { background: var(--surface); color: var(--ink-2); border: 1px solid var(--line); }
@media (hover: hover) and (pointer: fine) {
    .pd-btn:not(.pd-btn--ghost):hover { background: var(--blue-strong); transform: translateY(-1px); }
    .pd-btn--ghost:hover { background: var(--bg-tint); color: var(--ink); }
}

@media (max-width: 860px) {
    .pd-player { grid-template-columns: 1fr; }
    .pd-lessons { order: 2; }
}
</style>
