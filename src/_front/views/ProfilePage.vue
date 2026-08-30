<!--
  ProfilePage.vue — the public profile page (overrides the WeWeb /profile_page; also served at
  /profile-demo). route: /profile_page?user=<uuid>. Content-only — the shared AppHeader/AppFooter
  come from App.vue. Fetches the users row + their courses/taken courses/articles from Supabase and
  renders them in the MeetGuru brand language (navy/blue + orange, Onest, pd-* design system).
  Persona-aware (speaker/school catalog vs specialist portfolio); honours users.hide = { my, buy }.
  Primary "Записаться" CTA shows only when booking_url is set.
-->
<template>
    <main class="pd" :class="{ 'is-ready': ready }" ref="rootEl">
        <template v-if="user">
            <!-- ── HERO ─────────────────────────────────────────────── -->
            <header class="pd-hero">
                <div class="pd-blob" aria-hidden="true"></div>
                <div class="pd-wrap pd-hero__grid">
                    <div class="pd-hero__lead">
                        <span v-if="user.role" class="pd-badge" data-reveal>
                            <span class="pd-badge__dot" aria-hidden="true"></span>{{ user.role }}
                        </span>
                        <h1 class="pd-hero__title" data-reveal>{{ user.Name }}</h1>
                        <p v-if="user.city" class="pd-hero__city" data-reveal>
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
                            {{ user.city }}
                        </p>
                        <p v-if="hook" class="pd-hero__hook" data-reveal>{{ hook }}</p>
                        <div class="pd-hero__cta" data-reveal>
                            <a v-if="user.booking_url" class="pd-btn pd-btn--lg" :href="user.booking_url" target="_blank" rel="noopener noreferrer">
                                Записаться
                            </a>
                            <a class="pd-ghost" href="#courses" @click.prevent="scrollTo('courses')">
                                Смотреть курсы
                                <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>
                            </a>
                        </div>
                        <div v-if="socials.length" class="pd-socials" data-reveal>
                            <a v-for="s in socials" :key="s.type" class="pd-social" :href="s.url" target="_blank" rel="noopener noreferrer" :aria-label="s.label" v-html="s.icon"></a>
                        </div>
                    </div>

                    <aside class="pd-hero__art" data-reveal>
                        <div class="pd-hero__art-panel">
                            <img v-if="user.Photo" class="pd-hero__avatar" :src="user.Photo" :alt="user.Name" @error="user.Photo = ''" />
                            <span v-else class="pd-hero__avafallback">{{ initials }}</span>
                            <span v-if="nPrimary" class="pd-hero__chip">
                                <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M4 5h11a2 2 0 0 1 2 2v12l-4-2-4 2V7a2 2 0 0 0-2-2H4z"/></svg>
                                {{ nPrimary }} {{ courseWord(nPrimary) }}
                            </span>
                        </div>
                    </aside>
                </div>
            </header>

            <!-- ── STATS ────────────────────────────────────────────── -->
            <section v-if="nPrimary" class="pd-stats" ref="statsEl" aria-label="Показатели">
                <div class="pd-wrap pd-stats__row">
                    <div class="pd-stat" data-reveal>
                        <span class="pd-stat__n">{{ statCourses }}</span>
                        <span class="pd-stat__l">{{ primaryLabel }}</span>
                    </div>
                    <div v-if="nArticles" class="pd-stat" data-reveal>
                        <span class="pd-stat__n">{{ statArticles }}</span>
                        <span class="pd-stat__l">авторских статей</span>
                    </div>
                    <div v-if="nCategories" class="pd-stat" data-reveal>
                        <span class="pd-stat__n">{{ statCats }}</span>
                        <span class="pd-stat__l">направлений в программе</span>
                    </div>
                </div>
            </section>

            <!-- ── ABOUT ────────────────────────────────────────────── -->
            <section v-if="bioParagraphs.length" class="pd-section pd-section--tint">
                <div class="pd-wrap pd-about">
                    <h2 class="pd-h2" data-reveal>{{ aboutLabel }}</h2>
                    <div class="pd-about__body" data-reveal>
                        <p v-for="(p, i) in bioParagraphs" :key="i">{{ p }}</p>
                    </div>
                    <a v-if="user.email" class="pd-ghost pd-about__mail" :href="`mailto:${user.email}`">
                        <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M4 6h16v12H4z"/><path d="M4 7l8 6 8-6"/></svg>
                        {{ user.email }}
                    </a>
                </div>
            </section>

            <!-- ── AUTHORED COURSES (speaker / school catalog) ──────── -->
            <section v-if="showAuthored" id="courses" class="pd-section">
                <div class="pd-wrap">
                    <div class="pd-head">
                        <h2 class="pd-h2" data-reveal>{{ coursesLabel }}</h2>
                        <p class="pd-head__note" data-reveal>{{ courses.length }} {{ courseWord(courses.length) }} — нажмите, чтобы открыть.</p>
                    </div>
                    <div class="pd-cards pd-cards--courses">
                        <a
                            v-for="(c, i) in visibleCourses"
                            :key="c.id"
                            class="pd-course"
                            :href="courseHref(c)"
                            data-reveal
                            :style="{ '--i': Math.min(i, 7) }"
                        >
                            <span class="pd-course__cat">{{ c.Category || 'Курс' }}</span>
                            <h3 class="pd-course__t">{{ c.Title }}</h3>
                            <span class="pd-course__price" :class="{ 'is-free': c.Free }">
                                {{ c.Free ? 'Бесплатно' : money(c.Price) + ' ₽' }}
                            </span>
                        </a>
                    </div>
                    <div v-if="courses.length > COURSE_LIMIT && !showAllCourses" class="pd-more">
                        <button class="pd-showall" type="button" @click="showAllCourses = true">
                            Показать все {{ courses.length }} {{ courseWord(courses.length) }}
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>
                        </button>
                    </div>
                </div>
            </section>

            <!-- ── TAKEN COURSES (specialist portfolio / education) ─── -->
            <section v-if="showCompleted" :id="hasAuthored ? undefined : 'courses'" class="pd-section" :class="{ 'pd-section--tint': hasAuthored }">
                <div class="pd-wrap">
                    <div class="pd-head">
                        <h2 class="pd-h2" data-reveal>{{ completedLabel }}</h2>
                        <p class="pd-head__note" data-reveal>{{ completed.length }} {{ courseWord(completed.length) }} пройдено на платформе.</p>
                    </div>
                    <div class="pd-cards pd-cards--courses">
                        <a
                            v-for="(c, i) in visibleCompleted"
                            :key="c.id"
                            class="pd-course"
                            :href="courseHref(c)"
                            data-reveal
                            :style="{ '--i': Math.min(i, 7) }"
                        >
                            <span class="pd-course__cat">{{ c.Category || 'Курс' }}</span>
                            <h3 class="pd-course__t">{{ c.Title }}</h3>
                            <span class="pd-course__done">
                                <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M4 12l5 5L20 6"/></svg>
                                Пройден
                            </span>
                        </a>
                    </div>
                    <div v-if="completed.length > COURSE_LIMIT && !showAllCompleted" class="pd-more">
                        <button class="pd-showall" type="button" @click="showAllCompleted = true">
                            Показать все {{ completed.length }} {{ courseWord(completed.length) }}
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>
                        </button>
                    </div>
                </div>
            </section>

            <!-- ── ARTICLES ─────────────────────────────────────────── -->
            <section v-if="articles.length" class="pd-section pd-section--tint">
                <div class="pd-wrap">
                    <h2 class="pd-h2" data-reveal>Статьи автора</h2>
                    <div class="pd-cards pd-cards--articles">
                        <a
                            v-for="(a, i) in articles"
                            :key="a.id"
                            class="pd-article"
                            :href="articleHref(a)"
                            data-reveal
                            :style="{ '--i': Math.min(i, 5) }"
                        >
                            <div class="pd-article__cover">
                                <img v-if="a.Image" :src="a.Image" :alt="a.Title" loading="lazy" />
                            </div>
                            <div class="pd-article__body">
                                <span v-if="a.Category" class="pd-course__cat">{{ a.Category }}</span>
                                <h3 class="pd-article__t">{{ a.Title }}</h3>
                            </div>
                        </a>
                    </div>
                </div>
            </section>
        </template>

        <div v-else-if="loading" class="pd-state">Загрузка профиля…</div>
        <div v-else class="pd-state">Профиль не найден.</div>
    </main>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { getSupabase, authCookieUser } from '@/_front/chrome/headerAccount.js';

const route = useRoute();
const rootEl = ref(null);
const statsEl = ref(null);
const user = ref(null);
const courses = ref([]);      // courses the profile AUTHORS (speaker/school catalog)
const completed = ref([]);    // courses the profile has TAKEN (buied_courses) — specialist portfolio
const articles = ref([]);
const loading = ref(true);
const ready = ref(false); // reactive reveal gate on the root — survives Vue re-renders (stat count-up)
const showAllCourses = ref(false);
const showAllCompleted = ref(false);
const COURSE_LIMIT = 6;
const visibleCourses = computed(() => (showAllCourses.value ? courses.value : courses.value.slice(0, COURSE_LIMIT)));
const visibleCompleted = computed(() => (showAllCompleted.value ? completed.value : completed.value.slice(0, COURSE_LIMIT)));

// ── derived ────────────────────────────────────────────────────────────────
const hook = computed(() => {
    const d = (user.value?.Description || '').trim();
    if (!d) return '';
    const first = d.split(/\n{2,}/)[0].trim();
    return first.length > 240 ? first.slice(0, 237).trimEnd() + '…' : first;
});
const bioParagraphs = computed(() =>
    (user.value?.Description || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
);
// The owner can hide either list in profile settings — users.hide = { my, buy }.
const hideMy = computed(() => user.value?.hide?.my === true);   // hide authored / created courses
const hideBuy = computed(() => user.value?.hide?.buy === true); // hide taken / completed courses
const showAuthored = computed(() => courses.value.length > 0 && !hideMy.value);
const showCompleted = computed(() => completed.value.length > 0 && !hideBuy.value);
const hasAuthored = computed(() => showAuthored.value); // persona: speaker/school = has VISIBLE authored courses
const nArticles = computed(() => user.value?.articles?.length || 0);
// "Primary" course set drives the hero chip + first stat: authored if shown, else taken if shown.
const primaryCourses = computed(() => (showAuthored.value ? courses.value : showCompleted.value ? completed.value : []));
const nPrimary = computed(() => primaryCourses.value.length);
const primaryLabel = computed(() => (hasAuthored.value ? 'курсов и семинаров' : 'пройденных курсов'));
const nCategories = computed(() => new Set(primaryCourses.value.map((c) => c.Category).filter(Boolean)).size);
const initials = computed(() => {
    const parts = (user.value?.Name || '').split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '·';
});
const isSchool = computed(() => user.value?.role === 'Учебное заведение');
const aboutLabel = computed(() => (isSchool.value ? 'О школе' : hasAuthored.value ? 'Об авторе' : 'О специалисте'));
const coursesLabel = computed(() => (isSchool.value ? 'Курсы школы' : 'Курсы автора'));
// The taken-courses section reads as a portfolio for a specialist, or "education" for a speaker who also teaches.
const completedLabel = computed(() => (hasAuthored.value ? 'Образование' : 'Пройденные курсы'));

function courseWord(n) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return 'курсов';
    if (b > 1 && b < 5) return 'курса';
    if (b === 1) return 'курс';
    return 'курсов';
}
function money(n) { return Number(n || 0).toLocaleString('ru-RU'); }
// Human-readable slug URLs (the site convention: slug || id fallback, same as my_courses/Home).
// A course/article without a slug falls back to its id; the target pages resolve either form.
function courseHref(c) { return `/course/${c.slug || c.id}`; }
function articleHref(a) { return `/articles/${a.slug || a.id}`; }

const SOCIAL_ICONS = {
    vk: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.8 16.3c-5 0-8-3.5-8.1-9.3h2.5c.1 4.3 2 6.1 3.5 6.5V7h2.4v3.6c1.5-.2 3-1.8 3.6-3.6h2.4c-.5 2.2-2.1 3.8-3.2 4.5 1.1.6 2.9 2 3.6 4.8h-2.6c-.5-1.7-1.9-3-3.8-3.2v3.2h-.3z"/></svg>',
    telegram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 4.5 3.5 11.2c-.9.4-.9 1.6 0 1.9l4.2 1.4 1.6 4.9c.3.8 1.2 1 1.8.4l2.3-2.2 4.2 3.1c.7.5 1.7.1 1.9-.7L22.5 6c.2-1-.7-1.8-1.5-1.5zM9.6 14l7.7-4.8-6.3 5.9-.2 3.1-1.2-4.2z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 8.2a3 3 0 0 0-2.1-2.1C18 5.6 12 5.6 12 5.6s-6 0-7.9.5A3 3 0 0 0 2 8.2 31 31 0 0 0 1.7 12 31 31 0 0 0 2 15.8a3 3 0 0 0 2.1 2.1c1.9.5 7.9.5 7.9.5s6 0 7.9-.5a3 3 0 0 0 2.1-2.1c.3-1.2.3-3.8.3-3.8s0-2.6-.3-3.8zM10 15V9l5.2 3-5.2 3z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3zm5.2 12.7c-.2.6-1.2 1.1-1.7 1.2-.5.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1-1.4-1-2.6 0-1.2.6-1.8.9-2 .2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.7 1.7c.1.2.1.4 0 .5l-.3.5-.3.3c-.1.1-.3.3-.1.6.1.3.7 1.1 1.5 1.8 1 .9 1.8 1.1 2 1.2.3.1.4.1.6-.1l.7-.8c.2-.2.3-.2.6-.1l1.6.8c.3.1.5.2.5.4 0 .1 0 .5-.2 1z"/></svg>',
    website: '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.7 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.7-3.8-9S9.5 5.5 12 3z" fill="none"/></svg>',
};
const socials = computed(() => {
    const u = user.value || {};
    return [
        { type: 'vk', url: u.vk_url, label: 'ВКонтакте' },
        { type: 'telegram', url: u.telegram_url, label: 'Telegram' },
        { type: 'youtube', url: u.youtube_url, label: 'YouTube' },
        { type: 'whatsapp', url: u.whatsapp_url, label: 'WhatsApp' },
        { type: 'website', url: u.website_url, label: 'Сайт' },
    ].filter((s) => s.url).map((s) => ({ ...s, icon: SOCIAL_ICONS[s.type] }));
});

// ── count-up stats ───────────────────────────────────────────────────────────
const statCourses = ref('0');
const statArticles = ref('0');
const statCats = ref('0');
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function countUp(setter, target, duration) {
    if (reduce() || !target) { setter.value = String(target); return; }
    const start = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    (function tick(now) {
        const t = Math.min(1, (now - start) / duration);
        setter.value = String(Math.round(target * ease(t)));
        if (t < 1) requestAnimationFrame(tick);
    })(performance.now());
}
function scrollTo(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'start' });
}

// ── data + reveal ────────────────────────────────────────────────────────────
let statsIo = null, counted = false;

// Fetch course rows by an id array, chunked — a single .in() over 100+ UUIDs overflows the GET URL (414).
async function fetchCourses(sb, ids, publishedOnly) {
    const list = ids || [];
    if (!list.length) return [];
    const chunks = [];
    for (let i = 0; i < list.length; i += 40) chunks.push(list.slice(i, i + 40));
    const results = await Promise.all(chunks.map((ch) => {
        let q = sb.from('course').select('id, "Title", "Price", "Free", "Category", slug, created_at').in('id', ch);
        if (publishedOnly) q = q.eq('ModStatus', 'Опубликовано');
        return q;
    }));
    return results.flatMap((r) => r.data || []);
}

async function load() {
    // ?user=<uuid> selects whose profile to show; bare /profile_page falls back to the logged-in user.
    const uid = route.query.user || authCookieUser()?.id;
    const sb = getSupabase();
    if (!uid || !sb) { loading.value = false; return; }
    const { data } = await sb.from('users')
        .select('id, "Name", "Photo", role, "Description", email, vk_url, youtube_url, telegram_url, whatsapp_url, website_url, booking_url, courses, articles, hide, city')
        .eq('id', uid).limit(1);
    user.value = data?.[0] || null;
    if (user.value?.Name) document.title = `${user.value.Name} — МитГуру`;
    // Authored courses (published only) — the speaker/school catalog. Free first, then newest.
    courses.value = (await fetchCourses(sb, user.value?.courses, true))
        .sort((a, b) => (Number(!!b.Free) - Number(!!a.Free)) || String(b.created_at).localeCompare(String(a.created_at)));
    // Taken courses — the specialist portfolio. user_course maps a user to the courses they own
    // (users.buied_courses holds user_course row ids, NOT course ids). Read the junction, dedupe,
    // then fetch the course rows. Kept even if a course is no longer on sale. Newest first.
    const { data: uc } = await sb.from('user_course').select('course').eq('user', uid);
    const takenIds = [...new Set((uc || []).map((r) => r.course).filter(Boolean))];
    completed.value = (await fetchCourses(sb, takenIds, false))
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const aids = user.value?.articles || [];
    if (aids.length) {
        const { data: arts } = await sb.from('articles')
            .select('id, "Title", "Image", "Category", slug, "Publish_date"')
            .in('id', aids).eq('Status', 'Опубликовано')
            .order('Publish_date', { ascending: false });
        articles.value = arts || [];
    }
    loading.value = false;
    await nextTick();
    // Reveal via a single reactive ancestor class (not per-element classList, which Vue re-renders
    // during the stat count-up would wipe). CSS staggers by --i.
    ready.value = true;
    setupStats();
}

function setupStats() {
    if (statsEl.value && 'IntersectionObserver' in window && !reduce()) {
        statsIo = new IntersectionObserver((es) => {
            if (es[0].isIntersecting && !counted) {
                counted = true;
                countUp(statCourses, nPrimary.value, 1300);
                countUp(statArticles, nArticles.value, 1000);
                countUp(statCats, nCategories.value, 900);
                statsIo.disconnect();
            }
        }, { threshold: 0.4 });
        statsIo.observe(statsEl.value);
    } else {
        statCourses.value = String(nPrimary.value);
        statArticles.value = String(nArticles.value);
        statCats.value = String(nCategories.value);
    }
}

onMounted(() => {
    ensureFonts();
    load();
});
onBeforeUnmount(() => { statsIo?.disconnect(); });

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
/* ── Tokens: MeetGuru brand (shared with PromoDemoPage) ─────────────────────── */
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
.pd-section { padding: 84px 0; }
.pd-section--tint { background: var(--bg-tint); }
.pd-ic { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; display: block; }
.pd-h2 { margin: 0 0 32px; font-weight: 700; font-size: clamp(1.9rem, 4vw, 3rem); line-height: 1.06; letter-spacing: -0.02em; }
.pd-state { max-width: var(--wrap); margin: 120px auto; padding: 0 40px; text-align: center; color: var(--ink-2); font-size: 1.1rem; }
.pd-empty { color: var(--ink-2); }

[data-reveal] { opacity: 0; transform: translateY(20px); transition: opacity 0.6s var(--ease-out), transform 0.6s var(--ease-out); transition-delay: calc(var(--i, 0) * 55ms); }
.pd.is-ready [data-reveal] { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { [data-reveal] { opacity: 1; transform: none; transition: none; } }

/* buttons */
.pd-btn { display: inline-block; font-family: inherit; font-weight: 600; font-size: 16px; color: var(--btn-ink); background: var(--blue); border: none; border-radius: var(--r-pill); padding: 15px 28px; cursor: pointer; text-decoration: none; transition: transform 0.16s var(--ease-out), background 0.16s var(--ease-out), box-shadow 0.16s var(--ease-out); box-shadow: 0 10px 26px -12px rgba(46, 112, 221, 0.7); }
.pd-btn:active { transform: translateY(1px); }
@media (hover: hover) and (pointer: fine) { .pd-btn:hover { background: var(--blue-strong); transform: translateY(-2px); box-shadow: 0 16px 32px -14px rgba(46, 112, 221, 0.8); } }
.pd-btn--lg { padding: 17px 32px; font-size: 17px; }
.pd-ghost { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 16px; color: var(--ink); text-decoration: none; padding: 8px 4px; transition: gap 0.18s var(--ease-out), color 0.18s var(--ease-out); }
.pd-ghost .pd-ic { width: 20px; height: 20px; }
@media (hover: hover) and (pointer: fine) { .pd-ghost:hover { color: var(--blue-ink); gap: 12px; } }

/* ── Hero ───────────────────────────────────────────────────────────────── */
.pd-hero { position: relative; padding: 64px 0 84px; overflow: hidden; }
.pd-blob { position: absolute; top: -180px; right: -150px; width: 620px; height: 620px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, rgba(84, 149, 243, 0.22), rgba(84, 149, 243, 0.05) 60%, transparent 72%); pointer-events: none; z-index: 0; }
.pd-hero__grid { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.85fr); gap: 56px; align-items: center; }
.pd-badge { display: inline-flex; align-items: center; gap: 9px; padding: 8px 16px; border-radius: var(--r-pill); background: var(--blue-tint); color: var(--blue-ink); font-weight: 600; font-size: 14px; }
.pd-badge__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--orange); box-shadow: 0 0 0 4px rgba(240, 145, 87, 0.22); }
.pd-hero__title { margin: 22px 0 0; font-weight: 700; font-size: clamp(2.2rem, 5.2vw, 4rem); line-height: 1.02; letter-spacing: -0.025em; }
.pd-hero__city { display: inline-flex; align-items: center; gap: 6px; margin: 12px 0 0; color: var(--ink-2); font-size: 1rem; font-weight: 500; }
.pd-hero__city .pd-ic { width: 18px; height: 18px; color: var(--blue); }
.pd-hero__hook { margin: 22px 0 0; max-width: 52ch; font-size: 1.14rem; color: var(--ink-2); }
/* margin-top keeps a gap above the CTA whether or not the bio hook is present (short/no-bio profiles
   otherwise let the button ride up against the name). */
.pd-hero__cta { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; margin-top: 30px; }
.pd-socials { display: flex; gap: 12px; margin-top: 28px; }
.pd-social { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: var(--blue-tint); color: var(--blue-ink); transition: transform 0.16s var(--ease-out), background 0.16s var(--ease-out), color 0.16s var(--ease-out); }
.pd-social :deep(svg) { width: 22px; height: 22px; fill: currentColor; }
@media (hover: hover) and (pointer: fine) { .pd-social:hover { transform: translateY(-2px); background: var(--blue); color: #fff; } }

.pd-hero__art { display: flex; justify-content: center; }
.pd-hero__art-panel { position: relative; width: 100%; max-width: 420px; aspect-ratio: 1; border-radius: var(--r-lg); background: radial-gradient(120% 120% at 62% 18%, var(--blue-tint), #ffffff 76%); border: 1px solid var(--line); display: grid; place-items: center; padding: 26px; box-shadow: var(--shadow); overflow: hidden; }
.pd-hero__avatar { width: 100%; height: 100%; object-fit: contain; border-radius: var(--r-md); }
.pd-hero__avafallback { display: grid; place-items: center; width: 100%; height: 100%; border-radius: var(--r-md); background: #fff; color: var(--blue-ink); font-weight: 700; font-size: 4rem; box-shadow: var(--shadow-sm); }
.pd-hero__chip { position: absolute; left: 18px; bottom: 18px; display: inline-flex; align-items: center; gap: 7px; padding: 8px 15px; border-radius: var(--r-pill); background: #fff; border: 1px solid var(--line); box-shadow: var(--shadow-sm); font-weight: 700; font-size: 14px; color: var(--ink); }
.pd-hero__chip .pd-ic { width: 18px; height: 18px; color: var(--orange-ink); }

/* ── Stats (navy band) ──────────────────────────────────────────────────── */
.pd-stats { background: var(--ink); color: #fff; }
.pd-stats__row { display: grid; grid-template-columns: repeat(3, 1fr); }
.pd-stat { padding: 52px 34px 52px 0; }
.pd-stat + .pd-stat { padding-left: 40px; border-left: 1px solid rgba(255, 255, 255, 0.14); }
.pd-stat__n { display: block; font-weight: 700; font-size: clamp(2.8rem, 5.4vw, 4rem); line-height: 1; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.pd-stat__l { display: block; margin-top: 12px; color: rgba(255, 255, 255, 0.66); font-size: 1rem; max-width: 24ch; }

/* ── About ──────────────────────────────────────────────────────────────── */
.pd-about { max-width: 820px; }
.pd-about__body p { margin: 0 0 16px; font-size: 1.1rem; color: var(--ink-2); }
.pd-about__mail { margin-top: 10px; }

/* ── Course cards ───────────────────────────────────────────────────────── */
.pd-head { margin-bottom: 30px; }
.pd-head .pd-h2 { margin-bottom: 10px; }
.pd-head__note { margin: 0; color: var(--ink-2); }
.pd-cards--courses { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.pd-course { display: flex; flex-direction: column; gap: 14px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); padding: 24px 24px 22px; text-decoration: none; color: inherit; transition: transform 0.22s var(--ease-out), box-shadow 0.22s var(--ease-out), border-color 0.22s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .pd-course:hover { transform: translateY(-4px); box-shadow: var(--shadow); border-color: rgba(46, 112, 221, 0.4); } }
.pd-course__cat { align-self: flex-start; padding: 5px 12px; border-radius: var(--r-pill); background: var(--blue-tint); color: var(--blue-ink); font-weight: 600; font-size: 12px; }
.pd-course__t { margin: 0; font-weight: 600; font-size: 1.08rem; line-height: 1.28; letter-spacing: -0.01em; flex: 1; }
.pd-course__price { font-weight: 700; font-size: 1.05rem; color: var(--ink); }
.pd-course__price.is-free { color: var(--orange-ink); }
.pd-course__done { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; font-size: 0.95rem; color: #178a5a; }
.pd-course__done .pd-ic { width: 18px; height: 18px; stroke-width: 2.6; color: #21a366; }

/* "show all" */
.pd-more { margin-top: 30px; display: flex; justify-content: center; }
.pd-showall { display: inline-flex; align-items: center; gap: 8px; font-family: inherit; font-weight: 600; font-size: 15px; color: var(--blue-ink); background: #fff; border: 1px solid var(--line); border-radius: var(--r-pill); padding: 13px 26px; cursor: pointer; transition: border-color 0.16s var(--ease-out), background 0.16s var(--ease-out), transform 0.16s var(--ease-out); }
.pd-showall .pd-ic { width: 18px; height: 18px; }
@media (hover: hover) and (pointer: fine) { .pd-showall:hover { border-color: var(--blue-soft); background: var(--blue-tint); transform: translateY(-1px); } }

/* ── Article cards ──────────────────────────────────────────────────────── */
.pd-cards--articles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
.pd-article { display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); overflow: hidden; text-decoration: none; color: inherit; transition: transform 0.22s var(--ease-out), box-shadow 0.22s var(--ease-out), border-color 0.22s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .pd-article:hover { transform: translateY(-4px); box-shadow: var(--shadow); border-color: rgba(46, 112, 221, 0.4); } }
.pd-article__cover { aspect-ratio: 16 / 9; background: var(--blue-tint); overflow: hidden; }
.pd-article__cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pd-article__body { display: flex; flex-direction: column; gap: 12px; padding: 20px 22px 22px; }
.pd-article__t { margin: 0; font-weight: 600; font-size: 1.08rem; line-height: 1.3; letter-spacing: -0.01em; }

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 1080px) {
    .pd-hero__grid { grid-template-columns: 1fr; gap: 36px; }
    .pd-hero__art { order: -1; }
    .pd-hero__art-panel { max-width: 320px; }
    .pd-cards--courses, .pd-cards--articles { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 900px) {
    .pd-wrap { padding-inline: 22px; }
    .pd-section { padding: 60px 0; }
    .pd-hero { padding: 44px 0 60px; }
    .pd-stats__row { grid-template-columns: 1fr; }
    .pd-stat { padding: 30px 0; }
    .pd-stat + .pd-stat { padding-left: 0; border-left: none; border-top: 1px solid rgba(255, 255, 255, 0.14); }
}
@media (max-width: 560px) {
    .pd-cards--courses, .pd-cards--articles { grid-template-columns: 1fr; }
    .pd-hero__cta { gap: 14px; }
    .pd-hero__cta .pd-btn { width: 100%; text-align: center; }
}
</style>
