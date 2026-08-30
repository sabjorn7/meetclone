<!--
  ArticlesPage.vue — "/articles" (article LIST) in the MeetGuru promo (pd-*) brand language. Demo at
  /articles-demo; the live WeWeb list is untouched until go-live. The detail page (/articles/:slug) is
  already the hand-written ArticlePage.vue.

  Reproduces the WeWeb list 1:1 (verified against public/data/7d160a8b….json):
    - articles where Status == 'Опубликовано', ordered created_at DESC (no limit).
    - two client-side filters: Title contains (case-insensitive) + Category exact (fixed dropdown list).
    - card: category chip, cover (Image), title, Content excerpt, author (Creator→users Name/Photo),
      date DD.MM.YYYY, rating avg (mean of Rating[], 2dp) + count, comment count, "Ваша оценка" if rated.
    - card → /articles/<slug || id> (the live detail route).
-->
<template>
    <main class="pd" :class="{ 'is-ready': ready }">
        <header class="pd-hero">
            <div class="pd-wrap">
                <h1 class="pd-hero__title" data-reveal>Все статьи</h1>
                <p class="pd-hero__sub" data-reveal>Материалы по прикладной кинезиологии от практикующих специалистов.</p>
            </div>
        </header>

        <section class="pd-section">
            <div class="pd-wrap">
                <!-- filters -->
                <div class="pd-filters" data-reveal>
                    <label class="pd-search">
                        <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
                        <input v-model="q" type="search" placeholder="Название" aria-label="Поиск по названию" />
                    </label>

                    <div class="pd-select" :class="{ 'is-open': catOpen }">
                        <button type="button" class="pd-select__btn" @click="catOpen = !catOpen" :aria-expanded="catOpen">
                            <span :class="{ 'pd-select__ph': !cat }">{{ cat || 'Категория' }}</span>
                            <svg viewBox="0 0 24 24" class="pd-ic pd-select__chev" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
                        </button>
                        <ul v-if="catOpen" class="pd-select__menu">
                            <li><button type="button" @click="pickCat('')">Все категории</button></li>
                            <li v-for="c in CATS" :key="c"><button type="button" :class="{ 'is-on': cat === c }" @click="pickCat(c)">{{ c }}</button></li>
                        </ul>
                    </div>

                    <button v-if="q || cat" type="button" class="pd-reset" @click="resetFilters">Сбросить фильтр</button>
                </div>

                <!-- grid -->
                <p v-if="loading" class="pd-empty">Загрузка…</p>
                <p v-else-if="!filtered.length" class="pd-empty">Список пуст</p>

                <div v-else class="pd-grid">
                    <a
                        v-for="a in filtered" :key="a.id"
                        class="pd-card" :href="`/articles/${a.slug || a.id}`" data-reveal
                    >
                        <div class="pd-card__cover">
                            <img :src="a.Image || COVER_FALLBACK" :alt="a.Title" loading="lazy" />
                            <span v-if="a.Category" class="pd-card__cat">{{ a.Category }}</span>
                        </div>
                        <div class="pd-card__body">
                            <h2 class="pd-card__title">{{ a.Title }}</h2>
                            <p v-if="a.excerpt" class="pd-card__excerpt">{{ a.excerpt }}</p>
                            <div class="pd-card__spacer"></div>
                            <div class="pd-card__author">
                                <img v-if="usersById[a.Creator]?.Photo" class="pd-card__ava" :src="usersById[a.Creator].Photo" :alt="usersById[a.Creator]?.Name" />
                                <span v-else class="pd-card__ava pd-card__ava--i">{{ initials(usersById[a.Creator]?.Name) }}</span>
                                <span class="pd-card__meta"><b>{{ usersById[a.Creator]?.Name || 'Автор' }}</b><span>{{ fmtDate(a.created_at) }}</span></span>
                            </div>
                            <div class="pd-card__foot">
                                <span v-if="a.ratingCount" class="pd-card__stat">
                                    <svg viewBox="0 0 24 24" class="pd-star pd-star--on" aria-hidden="true"><path d="M12 2l3 6.5 7 .9-5 4.8 1.3 7L12 18l-6.6 3.2L6.7 14l-5-4.8 7-.9z"/></svg>
                                    {{ a.ratingAvg }}
                                </span>
                                <span v-if="myRatings[a.id]" class="pd-card__mine">Ваша оценка: {{ myRatings[a.id] }}</span>
                                <span class="pd-card__stat pd-card__stat--cmt">
                                    <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                    {{ a.commentCount }}
                                </span>
                            </div>
                        </div>
                    </a>
                </div>
            </div>
        </section>
    </main>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { getSupabase, readStoredSession } from '@/_front/chrome/headerAccount.js';

// Fixed category list — matches the WeWeb `Cat_Articles` variable (not derived from the data).
const CATS = ['Общая практика', 'Остеопатия', 'Психология', 'Кинезиология'];
const COVER_FALLBACK = 'https://sb.meetgu.ru/storage/v1/object/public/profile//image_16x9_enhanced.png';
const LIST_COLS = 'id, created_at, "Title", "Content", "Image", "Category", "Rating", "Comments", "slug", "Creator"';

let sb = null;
const myId = ref(null);
const loading = ref(true);
const ready = ref(false);
const articles = ref([]);
const usersById = ref({});
const myRatings = ref({});   // article id -> my rating

const q = ref('');
const cat = ref('');
const catOpen = ref(false);

function initials(name) {
    const p = (name || '').split(/\s+/).filter(Boolean);
    return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '·';
}
function fmtDate(iso) { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function excerptOf(content) {
    const plain = (content || '').replace(/<[^>]+>/g, ' ').replace(/[#>*_`~]+/g, ' ').replace(/\s+/g, ' ').trim();
    return plain.length > 150 ? plain.slice(0, 150).replace(/\S*$/, '').trim() + '…' : plain;
}
function ratingAvgOf(r) {
    if (!Array.isArray(r) || !r.length) return { avg: '', count: 0 };
    const mean = r.reduce((a, b) => a + Number(b || 0), 0) / r.length;
    return { avg: (Math.round(mean * 100) / 100).toString().replace('.', ','), count: r.length };
}

const filtered = computed(() => {
    const needle = q.value.trim().toLowerCase();
    return articles.value.filter((a) => {
        if (cat.value && a.Category !== cat.value) return false;
        if (needle && !(a.Title || '').toLowerCase().includes(needle)) return false;
        return true;
    });
});

function pickCat(c) { cat.value = c; catOpen.value = false; }
function resetFilters() { q.value = ''; cat.value = ''; }
function onDocClick(e) { if (!e.target.closest('.pd-select')) catOpen.value = false; }

async function load() {
    sb = getSupabase();
    myId.value = readStoredSession()?.user?.id || null;
    if (!sb) { loading.value = false; return; }

    const { data } = await sb.from('articles').select(LIST_COLS).eq('Status', 'Опубликовано').order('created_at', { ascending: false });
    const rows = (data || []).map((a) => {
        const { avg, count } = ratingAvgOf(a.Rating);
        return { ...a, excerpt: excerptOf(a.Content), ratingAvg: avg, ratingCount: count, commentCount: Array.isArray(a.Comments) ? a.Comments.length : 0 };
    });
    articles.value = rows;

    await ensureUsers(rows.map((a) => a.Creator));
    if (myId.value) {
        const { data: mine } = await sb.from('articles_rating').select('article, rating').eq('author', myId.value);
        const map = {};
        for (const r of mine || []) map[r.article] = r.rating;
        myRatings.value = map;
    }

    loading.value = false;
    await nextTick();
    ready.value = true;
}

async function ensureUsers(ids) {
    const need = [...new Set(ids.filter((id) => id && !usersById.value[id]))];
    if (!need.length) return;
    const next = { ...usersById.value };
    for (let i = 0; i < need.length; i += 40) {
        const { data } = await sb.from('users').select('id, "Name", "Photo"').in('id', need.slice(i, i + 40));
        for (const u of data || []) next[u.id] = u;
    }
    usersById.value = next;
}

onMounted(() => {
    ensureFonts();
    applySeo();
    document.addEventListener('click', onDocClick);
    load();
});
onBeforeUnmount(() => document.removeEventListener('click', onDocClick));

function applySeo() {
    document.title = 'Статьи о кинезиологии — МитГуру';
    let m = document.head.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement('meta'); m.setAttribute('name', 'description'); document.head.appendChild(m); }
    m.setAttribute('content', 'Полезные статьи и материалы по прикладной кинезиологии от экспертов и практикующих специалистов.');
}
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
    --gold: #f0a641;
    --r-lg: 22px; --r-md: 14px; --r-pill: 999px;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --shadow-sm: 0 4px 16px -8px rgba(9, 23, 71, 0.18); --shadow-hov: 0 22px 46px -26px rgba(9, 23, 71, 0.34);
    --wrap: 1200px;
    background: var(--bg); color: var(--ink);
    font-family: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 17px; line-height: 1.55; -webkit-font-smoothing: antialiased; overflow-x: hidden;
}
.pd *, .pd *::before, .pd *::after { box-sizing: border-box; }
.pd-wrap { width: 100%; max-width: var(--wrap); margin-inline: auto; padding-inline: 40px; }
.pd-ic { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
[data-reveal] { opacity: 0; transform: translateY(18px); transition: opacity 0.6s var(--ease-out), transform 0.6s var(--ease-out); }
.pd.is-ready [data-reveal] { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { [data-reveal] { opacity: 1; transform: none; transition: none; } }

.pd-hero { padding: 48px 0 20px; }
.pd-hero__title { margin: 0; font-weight: 800; font-size: clamp(2rem, 4.6vw, 3rem); line-height: 1.04; letter-spacing: -0.03em; }
.pd-hero__sub { margin: 14px 0 0; color: var(--ink-2); font-size: 1.08rem; }
.pd-section { padding: 8px 0 80px; }

/* filters */
.pd-filters { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 28px; }
.pd-search { display: flex; align-items: center; gap: 10px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-pill); padding: 0 18px; height: 50px; flex: 1 1 320px; min-width: 220px; }
.pd-search:focus-within { border-color: var(--blue-soft); box-shadow: 0 0 0 4px var(--blue-tint); }
.pd-search .pd-ic { width: 18px; height: 18px; color: var(--ink-3); flex: none; }
.pd-search input { flex: 1; border: none; outline: none; background: transparent; font-family: inherit; font-size: 15px; color: var(--ink); min-width: 0; }

.pd-select { position: relative; flex: 0 0 240px; }
.pd-select__btn { width: 100%; height: 50px; display: flex; align-items: center; justify-content: space-between; gap: 10px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-pill); padding: 0 18px; font-family: inherit; font-size: 15px; color: var(--ink); cursor: pointer; }
.pd-select.is-open .pd-select__btn { border-color: var(--blue-soft); }
.pd-select__ph { color: var(--ink-3); }
.pd-select__chev { width: 18px; height: 18px; color: var(--ink-3); transition: transform 0.18s var(--ease-out); }
.pd-select.is-open .pd-select__chev { transform: rotate(180deg); }
.pd-select__menu { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 20; margin: 0; padding: 6px; list-style: none; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); box-shadow: var(--shadow-hov); }
.pd-select__menu button { width: 100%; text-align: left; border: none; background: transparent; border-radius: 9px; padding: 10px 12px; font-family: inherit; font-size: 0.95rem; color: var(--ink); cursor: pointer; }
@media (hover: hover) and (pointer: fine) { .pd-select__menu button:hover { background: var(--bg-tint); } }
.pd-select__menu button.is-on { background: var(--blue-tint); color: var(--blue-ink); font-weight: 600; }

.pd-reset { border: none; background: transparent; color: var(--blue-ink); font-family: inherit; font-size: 0.92rem; font-weight: 600; cursor: pointer; padding: 0 6px; }
.pd-reset:hover { text-decoration: underline; }

.pd-empty { padding: 60px 0; text-align: center; color: var(--ink-3); }

/* grid */
.pd-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
.pd-card { display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); overflow: hidden; text-decoration: none; color: inherit; transition: transform 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out), border-color 0.2s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .pd-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-hov); border-color: transparent; } }
.pd-card__cover { position: relative; aspect-ratio: 16 / 9; background: var(--bg-tint); overflow: hidden; }
.pd-card__cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pd-card__cat { position: absolute; top: 12px; left: 12px; background: rgba(255, 255, 255, 0.94); color: var(--blue-ink); border-radius: var(--r-pill); padding: 5px 12px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; backdrop-filter: blur(4px); }
.pd-card__body { display: flex; flex-direction: column; flex: 1; padding: 18px 18px 16px; }
.pd-card__title { margin: 0; font-weight: 800; font-size: 1.18rem; line-height: 1.24; letter-spacing: -0.02em; }
.pd-card__excerpt { margin: 9px 0 0; color: var(--ink-2); font-size: 0.92rem; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pd-card__spacer { flex: 1; min-height: 14px; }
.pd-card__author { display: flex; align-items: center; gap: 9px; }
.pd-card__ava { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex: none; }
.pd-card__ava--i { display: grid; place-items: center; background: var(--blue-tint); color: var(--blue-ink); font-weight: 700; font-size: 0.72rem; }
.pd-card__meta { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
.pd-card__meta b { font-weight: 600; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pd-card__meta span { color: var(--ink-3); font-size: 0.8rem; }
.pd-card__foot { display: flex; align-items: center; gap: 14px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); color: var(--ink-2); font-size: 0.86rem; font-weight: 600; }
.pd-card__stat { display: inline-flex; align-items: center; gap: 5px; }
.pd-card__stat .pd-ic { width: 16px; height: 16px; color: var(--ink-3); }
.pd-card__stat--cmt { margin-left: auto; }
.pd-star { width: 15px; height: 15px; fill: none; stroke: var(--ink-3); }
.pd-star--on { fill: var(--gold); stroke: var(--gold); }
.pd-card__mine { color: var(--blue-ink); font-size: 0.8rem; font-weight: 600; }

@media (max-width: 980px) { .pd-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 620px) {
    .pd-wrap { padding-inline: 22px; }
    .pd-grid { grid-template-columns: 1fr; }
    .pd-select { flex-basis: 100%; }
    .pd-search { flex-basis: 100%; }
}
</style>
