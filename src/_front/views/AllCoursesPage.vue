<!--
  AllCoursesPage.vue — the course catalog (/all_course) in the MeetGuru promo (pd-*) brand language.
  Content-only — the shared AppHeader/AppFooter come from App.vue. Published courses are fetched from
  Supabase and filtered client-side (category / search / free). Cards link to /course/<slug||id> (the
  site slug convention; the course page resolves either form). Currently wired as a DEMO at
  /all-course-demo; a physical dist entry is produced via vite.config.js.
-->
<template>
    <main class="pd" :class="{ 'is-ready': ready }">
        <!-- ── HERO ─────────────────────────────────────────────── -->
        <header class="pd-hero">
            <div class="pd-blob" aria-hidden="true"></div>
            <div class="pd-wrap">
                <span class="pd-badge" data-reveal><span class="pd-badge__dot" aria-hidden="true"></span>Каталог</span>
                <h1 class="pd-hero__title" data-reveal>Все курсы по кинезиологии</h1>
                <p class="pd-hero__sub" data-reveal>Программы и семинары от практикующих экспертов — выбирайте направление и учитесь в удобном темпе.</p>
            </div>
        </header>

        <!-- ── CATALOG ──────────────────────────────────────────── -->
        <section class="pd-section pd-section--tint pd-catalog">
            <div class="pd-wrap">
                <!-- filters -->
                <div class="pd-filters" data-reveal>
                    <div class="pd-cats" role="tablist" aria-label="Категории">
                        <button
                            v-for="cat in categories"
                            :key="cat.key"
                            class="pd-cat"
                            :class="{ 'is-on': selectedCat === cat.key }"
                            type="button"
                            role="tab"
                            :aria-selected="selectedCat === cat.key"
                            @click="selectedCat = cat.key"
                        >{{ cat.label }} <span class="pd-cat__n">{{ cat.count }}</span></button>
                    </div>
                    <div class="pd-filters__row">
                        <label class="pd-search">
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
                            <input v-model="query" type="search" placeholder="Поиск по названию" aria-label="Поиск по названию" />
                        </label>
                        <button class="pd-toggle" :class="{ 'is-on': freeOnly }" type="button" :aria-pressed="freeOnly" @click="freeOnly = !freeOnly">
                            <span class="pd-toggle__box" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/></svg></span>
                            Только бесплатные
                        </button>
                    </div>
                </div>

                <!-- results -->
                <p class="pd-count" aria-live="polite">{{ visibleCourses.length }} {{ courseWord(visibleCourses.length) }}</p>

                <div v-if="visibleCourses.length" class="pd-cards pd-cards--courses">
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
                        <div class="pd-course__foot">
                            <span v-if="authorName(c)" class="pd-course__author">{{ authorName(c) }}</span>
                            <span class="pd-course__price" :class="{ 'is-free': c.Free }">{{ c.Free ? 'Бесплатно' : money(c.Price) + ' ₽' }}</span>
                        </div>
                    </a>
                </div>

                <div v-else-if="!loading" class="pd-empty">
                    <img class="pd-empty__mascot" src="/images/minime-06.png" alt="" aria-hidden="true" width="626" height="626" />
                    <p>По вашему запросу курсов не нашлось.</p>
                    <button v-if="isFiltered" class="pd-ghostbtn" type="button" @click="resetFilters">Сбросить фильтры</button>
                </div>

                <p v-if="loading" class="pd-state">Загрузка курсов…</p>
            </div>
        </section>
    </main>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { getSupabase } from '@/_front/chrome/headerAccount.js';

const courses = ref([]);
const authorsById = ref({});
const loading = ref(true);
const ready = ref(false);

const selectedCat = ref('all');
const query = ref('');
const freeOnly = ref(false);

// category tabs derived from the data (label + live count), "Все" first.
const categories = computed(() => {
    const counts = {};
    for (const c of courses.value) {
        const k = c.Category || 'Другое';
        counts[k] = (counts[k] || 0) + 1;
    }
    const cats = Object.keys(counts).sort((a, b) => counts[b] - counts[a])
        .map((k) => ({ key: k, label: k, count: counts[k] }));
    return [{ key: 'all', label: 'Все', count: courses.value.length }, ...cats];
});

const isFiltered = computed(() => selectedCat.value !== 'all' || !!query.value.trim() || freeOnly.value);

const visibleCourses = computed(() => {
    const q = query.value.trim().toLowerCase();
    return courses.value.filter((c) => {
        if (selectedCat.value !== 'all' && (c.Category || 'Другое') !== selectedCat.value) return false;
        if (freeOnly.value && !c.Free) return false;
        if (q && !(c.Title || '').toLowerCase().includes(q)) return false;
        return true;
    });
});

function resetFilters() { selectedCat.value = 'all'; query.value = ''; freeOnly.value = false; }
function courseHref(c) { return `/course/${c.slug || c.id}`; }
function authorName(c) { return authorsById.value[c.owner] || ''; }
function money(n) { return Number(n || 0).toLocaleString('ru-RU'); }
function courseWord(n) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return 'курсов';
    if (b > 1 && b < 5) return 'курса';
    if (b === 1) return 'курс';
    return 'курсов';
}

async function load() {
    const sb = getSupabase();
    if (!sb) { loading.value = false; return; }
    const { data } = await sb.from('course')
        .select('id, "Title", "Price", "Free", old_price, "Category", slug, owner, created_at')
        .eq('ModStatus', 'Опубликовано')
        .order('created_at', { ascending: false });
    courses.value = data || [];
    // author names (school / teacher) for the card footer — one batched query over distinct owners.
    const ownerIds = [...new Set(courses.value.map((c) => c.owner).filter(Boolean))];
    if (ownerIds.length) {
        const { data: us } = await sb.from('users').select('id, "Name"').in('id', ownerIds);
        authorsById.value = Object.fromEntries((us || []).map((u) => [u.id, u.Name]));
    }
    loading.value = false;
    await nextTick();
    ready.value = true;
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
    --orange: #f09157; --orange-ink: #c2410c;
    --r-lg: 26px; --r-md: 16px; --r-pill: 999px;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --shadow: 0 14px 40px -20px rgba(9, 23, 71, 0.24); --shadow-sm: 0 4px 16px -8px rgba(9, 23, 71, 0.18);
    --wrap: 1200px;
    background: var(--bg); color: var(--ink);
    font-family: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 17px; line-height: 1.55; -webkit-font-smoothing: antialiased; overflow-x: hidden;
}
.pd *, .pd *::before, .pd *::after { box-sizing: border-box; }
.pd-wrap { width: 100%; max-width: var(--wrap); margin-inline: auto; padding-inline: 40px; }
.pd-section { padding: 64px 0 88px; }
.pd-section--tint { background: var(--bg-tint); }
.pd-ic { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; display: block; }
.pd-state { text-align: center; color: var(--ink-2); font-size: 1.05rem; padding: 40px 0; }

[data-reveal] { opacity: 0; transform: translateY(20px); transition: opacity 0.6s var(--ease-out), transform 0.6s var(--ease-out); transition-delay: calc(var(--i, 0) * 45ms); }
.pd.is-ready [data-reveal] { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { [data-reveal] { opacity: 1; transform: none; transition: none; } }

/* ── Hero ───────────────────────────────────────────────────────────────── */
.pd-hero { position: relative; padding: 56px 0 44px; overflow: hidden; }
.pd-blob { position: absolute; top: -200px; right: -160px; width: 620px; height: 620px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, rgba(84, 149, 243, 0.22), rgba(84, 149, 243, 0.05) 60%, transparent 72%); pointer-events: none; z-index: 0; }
.pd-hero > .pd-wrap { position: relative; z-index: 1; }
.pd-badge { display: inline-flex; align-items: center; gap: 9px; padding: 8px 16px; border-radius: var(--r-pill); background: var(--blue-tint); color: var(--blue-ink); font-weight: 600; font-size: 14px; }
.pd-badge__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--orange); box-shadow: 0 0 0 4px rgba(240, 145, 87, 0.22); }
.pd-hero__title { margin: 22px 0 0; font-weight: 700; font-size: clamp(2rem, 4.4vw, 3.2rem); line-height: 1.05; letter-spacing: -0.02em; }
.pd-hero__sub { margin: 18px 0 0; max-width: 56ch; font-size: 1.12rem; color: var(--ink-2); }

/* ── Filters ────────────────────────────────────────────────────────────── */
.pd-catalog { padding-top: 40px; }
.pd-filters { display: flex; flex-direction: column; gap: 18px; margin-bottom: 22px; }
.pd-cats { display: flex; flex-wrap: wrap; gap: 10px; }
.pd-cat { display: inline-flex; align-items: center; gap: 8px; font-family: inherit; font-weight: 600; font-size: 15px; color: var(--ink-2); background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-pill); padding: 10px 18px; cursor: pointer; transition: color 0.16s var(--ease-out), background 0.16s var(--ease-out), border-color 0.16s var(--ease-out); }
.pd-cat__n { font-size: 12px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
@media (hover: hover) and (pointer: fine) { .pd-cat:hover { border-color: var(--blue-soft); color: var(--ink); } }
.pd-cat.is-on { background: var(--blue); border-color: var(--blue); color: #fff; }
.pd-cat.is-on .pd-cat__n { color: rgba(255, 255, 255, 0.75); }

.pd-filters__row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.pd-search { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 240px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-pill); padding: 0 18px; height: 50px; transition: border-color 0.16s var(--ease-out), box-shadow 0.16s var(--ease-out); }
.pd-search:focus-within { border-color: var(--blue-soft); box-shadow: 0 0 0 4px rgba(84, 149, 243, 0.15); }
.pd-search .pd-ic { width: 20px; height: 20px; color: var(--ink-3); flex: none; }
.pd-search input { flex: 1; border: none; outline: none; background: transparent; font-family: inherit; font-size: 16px; color: var(--ink); min-width: 0; }
.pd-search input::placeholder { color: var(--ink-3); }

.pd-toggle { display: inline-flex; align-items: center; gap: 10px; font-family: inherit; font-weight: 600; font-size: 15px; color: var(--ink-2); background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-pill); padding: 0 20px; height: 50px; cursor: pointer; transition: color 0.16s var(--ease-out), border-color 0.16s var(--ease-out); }
.pd-toggle__box { width: 20px; height: 20px; border-radius: 6px; border: 1.5px solid var(--line); display: grid; place-items: center; transition: background 0.16s var(--ease-out), border-color 0.16s var(--ease-out); }
.pd-toggle__box svg { width: 14px; height: 14px; fill: none; stroke: #fff; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; opacity: 0; transition: opacity 0.16s var(--ease-out); }
.pd-toggle.is-on { color: var(--orange-ink); border-color: var(--orange); }
.pd-toggle.is-on .pd-toggle__box { background: var(--orange); border-color: var(--orange); }
.pd-toggle.is-on .pd-toggle__box svg { opacity: 1; }
@media (hover: hover) and (pointer: fine) { .pd-toggle:hover { border-color: var(--orange); } }

.pd-count { margin: 0 0 22px; color: var(--ink-2); font-size: 0.98rem; }

/* ── Cards (reused from ProfilePage for consistency) ────────────────────── */
.pd-cards--courses { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.pd-course { display: flex; flex-direction: column; gap: 14px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); padding: 24px 24px 22px; text-decoration: none; color: inherit; transition: transform 0.22s var(--ease-out), box-shadow 0.22s var(--ease-out), border-color 0.22s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .pd-course:hover { transform: translateY(-4px); box-shadow: var(--shadow); border-color: rgba(46, 112, 221, 0.4); } }
.pd-course__cat { align-self: flex-start; padding: 5px 12px; border-radius: var(--r-pill); background: var(--blue-tint); color: var(--blue-ink); font-weight: 600; font-size: 12px; }
.pd-course__t { margin: 0; font-weight: 600; font-size: 1.08rem; line-height: 1.28; letter-spacing: -0.01em; flex: 1; }
.pd-course__foot { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-top: 2px; }
.pd-course__author { color: var(--ink-3); font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pd-course__price { font-weight: 700; font-size: 1.05rem; color: var(--ink); white-space: nowrap; }
.pd-course__price.is-free { color: var(--orange-ink); }

/* ── Empty state ────────────────────────────────────────────────────────── */
.pd-empty { text-align: center; padding: 30px 0 20px; color: var(--ink-2); }
.pd-empty__mascot { display: block; width: 120px; height: auto; margin: 0 auto 16px; opacity: 0.9; }
.pd-empty p { margin: 0 0 18px; font-size: 1.1rem; }
.pd-ghostbtn { font-family: inherit; font-weight: 600; font-size: 15px; color: var(--blue-ink); background: transparent; border: 1.5px solid var(--line); border-radius: var(--r-pill); padding: 12px 24px; cursor: pointer; transition: background 0.16s var(--ease-out), border-color 0.16s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .pd-ghostbtn:hover { background: var(--blue-tint); border-color: var(--blue-soft); } }

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 960px) { .pd-cards--courses { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 900px) { .pd-wrap { padding-inline: 22px; } .pd-section { padding: 48px 0 64px; } }
@media (max-width: 560px) {
    .pd-cards--courses { grid-template-columns: 1fr; }
    .pd-filters__row { flex-direction: column; align-items: stretch; }
    .pd-toggle { justify-content: center; }
}
</style>
