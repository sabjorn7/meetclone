<!--
  ArticlePage.vue — "/articles/:slug" in the MeetGuru promo (pd-*) brand language. Demo at
  /article-demo?slug=<slug|uuid>; the live WeWeb article page is untouched until go-live.

  Reproduces the WeWeb article page 1:1 (verified against public/data/4ecb4df0….json + the rich-text and
  PeerTube video elements + DB triggers):
    - Resolve slug-OR-uuid → one `articles` row (Title, Content, Image, Category, created_at, Rating[],
      video_id, Creator). Body `Content` is rendered exactly like the original: marked.parse() + v-html,
      with medium-zoom on images.
    - Video (most articles have one): PeerTube — poster from /api/v1/videos/<id>, click-to-play iframe
      https://video.meetgu.ru/videos/embed/<id>?title=0&warningTitle=0&peertubeLink=0&p2p=0.
    - Rating: 5 stars; average = mean(Rating[]) + count. Logged-in click → INSERT articles_rating
      {author,rating,article}; the add_rating_to_article trigger appends to articles.Rating. NEW: a
      "you already rated" gate (query articles_rating by author+article) prevents the original's double-count.
    - Comments (article_comments): threaded via Reply_to/replies; post + reply require auth; soft
      delete/restore (toggle `delete`) is SUPERADMIN-only. Reading is public.
    - Auth gating mirrors the original (isAuthenticated). Public page, no paywall.
  NEW improvements (approved): per-article <title>/description/OG tags, and the rating dedupe gate.
-->
<template>
    <main class="pd" :class="{ 'is-ready': ready }">
        <div v-if="loading" class="pd-wrap pd-art__loading">Загрузка…</div>

        <div v-else-if="!article" class="pd-wrap pd-art__missing">
            <p>Статья не найдена.</p>
            <a href="/articles" class="pd-btn pd-btn--ghost">Все статьи</a>
        </div>

        <article v-else class="pd-art">
            <div class="pd-wrap pd-art__head">
                <a href="/articles" class="pd-art__back" data-reveal>
                    <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>
                    Все статьи
                </a>
                <span v-if="article.Category" class="pd-art__cat" data-reveal>{{ article.Category }}</span>
                <h1 class="pd-art__title" data-reveal>{{ article.Title }}</h1>
                <div class="pd-art__meta" data-reveal>
                    <span class="pd-art__author">
                        <img v-if="author?.Photo" class="pd-art__ava" :src="author.Photo" :alt="author.Name" />
                        <span v-else class="pd-art__ava pd-art__ava--i">{{ initials(author?.Name) }}</span>
                        <b>{{ author?.Name || 'Автор' }}</b>
                    </span>
                    <span class="pd-art__dot">·</span>
                    <span class="pd-art__date">{{ fmtDate(article.created_at) }}</span>
                    <span v-if="ratingCount" class="pd-art__dot">·</span>
                    <span v-if="ratingCount" class="pd-art__ratemini">
                        <svg viewBox="0 0 24 24" class="pd-star pd-star--on" aria-hidden="true"><path d="M12 2l3 6.5 7 .9-5 4.8 1.3 7L12 18l-6.6 3.2L6.7 14l-5-4.8 7-.9z"/></svg>
                        {{ ratingAvg }} <span class="pd-art__ratecount">({{ ratingCount }})</span>
                    </span>
                </div>
            </div>

            <!-- Video (PeerTube) OR cover image -->
            <div class="pd-wrap pd-art__mediawrap" data-reveal>
                <div v-if="article.video_id" class="pd-art__video" :class="{ 'is-started': videoStarted }">
                    <iframe
                        v-if="videoStarted" :src="videoEmbedUrl" title="Видео" frameborder="0" allowfullscreen
                        allow="autoplay; fullscreen; picture-in-picture"
                        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                    ></iframe>
                    <button v-else type="button" class="pd-art__poster" @click="videoStarted = true" aria-label="Смотреть видео">
                        <img v-if="posterUrl" :src="posterUrl" alt="" />
                        <span class="pd-art__play" aria-hidden="true">
                            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        </span>
                    </button>
                </div>
                <img v-else-if="article.Image" class="pd-art__cover" :src="article.Image" :alt="article.Title" />
            </div>

            <!-- Body (marked → v-html) -->
            <div class="pd-wrap">
                <div ref="bodyEl" class="pd-art__body" v-html="bodyHtml"></div>
            </div>

            <!-- Rating -->
            <div class="pd-wrap">
                <section class="pd-rate" data-reveal>
                    <div class="pd-rate__summary">
                        <span class="pd-rate__num">{{ ratingCount ? ratingAvg : '—' }}</span>
                        <span class="pd-stars" aria-hidden="true">
                            <span v-for="i in 5" :key="i" class="pd-stars__cell">
                                <svg viewBox="0 0 24 24" class="pd-star"><path d="M12 2l3 6.5 7 .9-5 4.8 1.3 7L12 18l-6.6 3.2L6.7 14l-5-4.8 7-.9z"/></svg>
                                <span class="pd-stars__fill" :style="{ width: fillPct(i, ratingAvgNum) + '%' }">
                                    <svg viewBox="0 0 24 24" class="pd-star pd-star--on"><path d="M12 2l3 6.5 7 .9-5 4.8 1.3 7L12 18l-6.6 3.2L6.7 14l-5-4.8 7-.9z"/></svg>
                                </span>
                            </span>
                        </span>
                        <span class="pd-rate__count">{{ ratingCount }} {{ plural(ratingCount, 'оценка', 'оценки', 'оценок') }}</span>
                    </div>

                    <div class="pd-rate__action">
                        <template v-if="!myId">
                            <a href="/login" class="pd-link">Войдите</a>, чтобы оценить статью
                        </template>
                        <template v-else-if="myRating">
                            <span class="pd-rate__mine">Ваша оценка: <b>{{ myRating }}</b> из 5</span>
                        </template>
                        <template v-else>
                            <span class="pd-rate__label">Оцените статью:</span>
                            <span class="pd-stars pd-stars--pick" @mouseleave="hoverStar = 0">
                                <button
                                    v-for="i in 5" :key="i" type="button" class="pd-stars__btn"
                                    :aria-label="`Оценка ${i}`" :disabled="ratingBusy"
                                    @mouseenter="hoverStar = i" @click="submitRating(i)"
                                >
                                    <svg viewBox="0 0 24 24" class="pd-star" :class="{ 'pd-star--on': (hoverStar || 0) >= i }"><path d="M12 2l3 6.5 7 .9-5 4.8 1.3 7L12 18l-6.6 3.2L6.7 14l-5-4.8 7-.9z"/></svg>
                                </button>
                            </span>
                        </template>
                    </div>
                </section>
            </div>

            <!-- Comments -->
            <div class="pd-wrap">
                <section class="pd-cmt">
                    <h2 class="pd-cmt__title">Комментарии <span v-if="topComments.length">({{ topComments.length }})</span></h2>

                    <form v-if="myId" class="pd-cmt__form" @submit.prevent="postComment()">
                        <textarea v-model="commentText" rows="2" placeholder="Написать комментарий…" aria-label="Комментарий" :disabled="posting"></textarea>
                        <button class="pd-btn" type="submit" :disabled="posting || !commentText.trim()">Отправить</button>
                    </form>
                    <p v-else class="pd-cmt__login"><a href="/login" class="pd-link">Войдите</a>, чтобы оставить комментарий.</p>

                    <p v-if="!topComments.length" class="pd-cmt__empty">Пока нет комментариев. Будьте первым!</p>

                    <ul class="pd-cmt__list">
                        <li v-for="c in topComments" :key="c.id" class="pd-cmt__item">
                            <div class="pd-cmt__row" :class="{ 'is-deleted': c.delete }">
                                <img v-if="usersById[c.creator]?.Photo" class="pd-cmt__ava" :src="usersById[c.creator].Photo" :alt="usersById[c.creator]?.Name" />
                                <span v-else class="pd-cmt__ava pd-cmt__ava--i">{{ initials(usersById[c.creator]?.Name) }}</span>
                                <div class="pd-cmt__body">
                                    <div class="pd-cmt__hd">
                                        <b>{{ usersById[c.creator]?.Name || 'Пользователь' }}</b>
                                        <span class="pd-cmt__time">{{ fmtDateTime(c.created_at) }}</span>
                                    </div>
                                    <p v-if="c.delete" class="pd-cmt__txt pd-cmt__txt--del">Комментарий удалён</p>
                                    <p v-else class="pd-cmt__txt">{{ c.text }}</p>
                                    <div class="pd-cmt__acts">
                                        <button v-if="myId && !c.delete" type="button" class="pd-cmt__act" @click="toggleReply(c.id)">Ответить</button>
                                        <button v-if="isSuperadmin" type="button" class="pd-cmt__act pd-cmt__act--mod" @click="toggleDelete(c)">{{ c.delete ? 'Восстановить' : 'Удалить' }}</button>
                                    </div>

                                    <form v-if="replyTo === c.id" class="pd-cmt__form pd-cmt__form--reply" @submit.prevent="postComment(c)">
                                        <textarea v-model="replyText" rows="2" placeholder="Ваш ответ…" aria-label="Ответ" :disabled="posting"></textarea>
                                        <div class="pd-cmt__replyacts">
                                            <button class="pd-btn pd-btn--sm" type="submit" :disabled="posting || !replyText.trim()">Ответить</button>
                                            <button class="pd-btn pd-btn--sm pd-btn--ghost" type="button" @click="replyTo = null">Отмена</button>
                                        </div>
                                    </form>

                                    <!-- replies -->
                                    <ul v-if="repliesOf(c.id).length" class="pd-cmt__replies">
                                        <li v-for="r in repliesOf(c.id)" :key="r.id" class="pd-cmt__item">
                                            <div class="pd-cmt__row" :class="{ 'is-deleted': r.delete }">
                                                <img v-if="usersById[r.creator]?.Photo" class="pd-cmt__ava" :src="usersById[r.creator].Photo" :alt="usersById[r.creator]?.Name" />
                                                <span v-else class="pd-cmt__ava pd-cmt__ava--i">{{ initials(usersById[r.creator]?.Name) }}</span>
                                                <div class="pd-cmt__body">
                                                    <div class="pd-cmt__hd">
                                                        <b>{{ usersById[r.creator]?.Name || 'Пользователь' }}</b>
                                                        <span class="pd-cmt__time">{{ fmtDateTime(r.created_at) }}</span>
                                                    </div>
                                                    <p v-if="r.delete" class="pd-cmt__txt pd-cmt__txt--del">Комментарий удалён</p>
                                                    <p v-else class="pd-cmt__txt">{{ r.text }}</p>
                                                    <div v-if="isSuperadmin" class="pd-cmt__acts">
                                                        <button type="button" class="pd-cmt__act pd-cmt__act--mod" @click="toggleDelete(r)">{{ r.delete ? 'Восстановить' : 'Удалить' }}</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </li>
                    </ul>
                </section>
            </div>
        </article>
    </main>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { marked } from 'marked';
import mediumZoom from 'medium-zoom';
import { getSupabase, readStoredSession } from '@/_front/chrome/headerAccount.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PEERTUBE = 'https://video.meetgu.ru';
const ART_COLS = 'id, created_at, "Title", "Content", "Image", "Category", "Publish_date", "Status", "Rating", video_id, "Creator"';
const CMT_COLS = 'id, created_at, text, delete, "Reply_to", replies, article, creator';

const route = useRoute();
let sb = null;

const myId = ref(null);
const isSuperadmin = ref(false);
const loading = ref(true);
const ready = ref(false);

const article = ref(null);
const author = ref(null);
const comments = ref([]);
const usersById = ref({});
const myRating = ref(null);

const bodyEl = ref(null);
const posterUrl = ref('');
const videoStarted = ref(false);

const commentText = ref('');
const replyTo = ref(null);
const replyText = ref('');
const posting = ref(false);

const hoverStar = ref(0);
const ratingBusy = ref(false);

/* ── derived ────────────────────────────────────────────────────────────── */
const bodyHtml = computed(() => (article.value?.Content ? marked.parse(article.value.Content) : ''));
const ratingAvgNum = computed(() => {
    const r = article.value?.Rating;
    if (!Array.isArray(r) || !r.length) return 0;
    return r.reduce((a, b) => a + Number(b || 0), 0) / r.length;
});
const ratingAvg = computed(() => (Math.round(ratingAvgNum.value * 100) / 100).toString().replace('.', ','));
const ratingCount = computed(() => (Array.isArray(article.value?.Rating) ? article.value.Rating.length : 0));
const videoEmbedUrl = computed(() => {
    if (!article.value?.video_id) return '';
    const p = new URLSearchParams({ title: '0', warningTitle: '0', peertubeLink: '0', p2p: '0' });
    return `${PEERTUBE}/videos/embed/${article.value.video_id}?${p.toString()}`;
});
const topComments = computed(() => comments.value.filter((c) => !c.Reply_to));
function repliesOf(id) { return comments.value.filter((c) => c.Reply_to === id); }

/* ── helpers ────────────────────────────────────────────────────────────── */
function initials(name) {
    const p = (name || '').split(/\s+/).filter(Boolean);
    return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '·';
}
function fmtDate(iso) { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function fmtDateTime(iso) { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function fillPct(i, avg) { return Math.min(Math.max(avg - (i - 1), 0), 1) * 100; }
function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
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

/* ── load ───────────────────────────────────────────────────────────────── */
async function load() {
    sb = getSupabase();
    myId.value = readStoredSession()?.user?.id || null;
    if (!sb) { loading.value = false; return; }

    const key = route.query.slug || route.params.slug || '';
    if (!key) { loading.value = false; return; }

    let q = sb.from('articles').select(ART_COLS);
    q = UUID_RE.test(key) ? q.eq('id', key) : q.eq('slug', key);
    const { data } = await q.limit(1);
    article.value = data?.[0] || null;
    if (!article.value) { loading.value = false; return; }

    applySeo();

    // author + video poster in parallel with comments
    const jobs = [];
    if (article.value.Creator) {
        jobs.push(sb.from('users').select('id, "Name", "Photo"').eq('id', article.value.Creator).limit(1).then(({ data: u }) => { author.value = u?.[0] || null; }));
    }
    if (article.value.video_id) jobs.push(loadPoster(article.value.video_id));
    jobs.push(loadComments());
    if (myId.value) {
        jobs.push(sb.from('users').select('superadmin').eq('id', myId.value).limit(1).then(({ data: u }) => { isSuperadmin.value = !!u?.[0]?.superadmin; }));
        jobs.push(sb.from('articles_rating').select('rating').eq('author', myId.value).eq('article', article.value.id).limit(1).then(({ data: r }) => { myRating.value = r?.[0]?.rating ?? null; }));
    }
    await Promise.all(jobs);

    loading.value = false;
    await nextTick();
    ready.value = true;
    // marked → v-html done; wire image zoom + fix relative/lazy images
    nextTick(() => { if (bodyEl.value) { try { mediumZoom(bodyEl.value.querySelectorAll('img'), { background: 'rgba(9,23,71,0.9)' }); } catch (e) { /* noop */ } } });
}

async function loadComments() {
    const { data } = await sb.from('article_comments').select(CMT_COLS).eq('article', article.value.id).order('created_at', { ascending: true });
    comments.value = data || [];
    await ensureUsers(comments.value.map((c) => c.creator));
}

async function loadPoster(uuid) {
    try {
        const res = await fetch(`${PEERTUBE}/api/v1/videos/${uuid}`);
        if (!res.ok) return;
        const d = await res.json();
        if (d.thumbnailPath) posterUrl.value = `${PEERTUBE}${d.thumbnailPath}`;
        else if (d.previewPath) posterUrl.value = `${PEERTUBE}${d.previewPath}`;
    } catch (e) { /* no poster */ }
}

/* ── rating (INSERT; trigger appends to articles.Rating). Dedupe gate: block if already rated. ── */
async function submitRating(n) {
    if (!myId.value || myRating.value || ratingBusy.value || !article.value) return;
    ratingBusy.value = true;
    try {
        const { error } = await sb.from('articles_rating').insert({ author: myId.value, rating: n, article: article.value.id });
        if (error) throw error;
        myRating.value = n;
        // reflect the new score locally (trigger already appended server-side)
        const cur = Array.isArray(article.value.Rating) ? article.value.Rating : [];
        article.value = { ...article.value, Rating: [...cur, n] };
    } catch (e) { /* leave unrated on failure */ } finally { ratingBusy.value = false; }
}

/* ── comments: post / reply / moderate ──────────────────────────────────── */
function toggleReply(id) { replyTo.value = replyTo.value === id ? null : id; replyText.value = ''; }

async function postComment(parent = null) {
    if (!myId.value || posting.value) return;
    const text = (parent ? replyText.value : commentText.value).trim();
    if (!text) return;
    posting.value = true;
    try {
        const row = { text, article: article.value.id, creator: myId.value };
        if (parent) row.Reply_to = parent.id;
        const { data } = await sb.from('article_comments').insert(row).select(CMT_COLS).limit(1);
        const created = data?.[0];
        if (created) {
            comments.value = [...comments.value, created];
            await ensureUsers([myId.value]);
            if (parent) {
                const replies = [...(parent.replies || []), created.id];
                await sb.from('article_comments').update({ replies }).eq('id', parent.id);
                comments.value = comments.value.map((c) => (c.id === parent.id ? { ...c, replies } : c));
                replyText.value = ''; replyTo.value = null;
            } else {
                commentText.value = '';
            }
        }
    } catch (e) { /* keep the text on failure */ } finally { posting.value = false; }
}

// superadmin-only soft delete/restore toggle
async function toggleDelete(c) {
    if (!isSuperadmin.value) return;
    const next = !c.delete;
    comments.value = comments.value.map((x) => (x.id === c.id ? { ...x, delete: next } : x));
    await sb.from('article_comments').update({ delete: next }).eq('id', c.id);
}

/* ── SEO: per-article title + description + OG (NEW) ─────────────────────── */
function setMeta(selector, attr, value) {
    let el = document.head.querySelector(selector);
    if (!el) {
        el = document.createElement('meta');
        const [, k, v] = selector.match(/\[(name|property)="(.+)"\]/) || [];
        if (k && v) el.setAttribute(k, v);
        document.head.appendChild(el);
    }
    el.setAttribute(attr, value);
}
function applySeo() {
    const a = article.value;
    const title = a.Title ? `${a.Title} | MeetGuru` : 'Статья | MeetGuru';
    document.title = title;
    // description = first ~160 chars of the body, stripped of markdown/html
    const plain = (a.Content || '').replace(/<[^>]+>/g, ' ').replace(/[#>*_`~\-]+/g, ' ').replace(/\s+/g, ' ').trim();
    const desc = plain.slice(0, 160) + (plain.length > 160 ? '…' : '');
    setMeta('meta[name="description"]', 'content', desc);
    setMeta('meta[property="og:title"]', 'content', a.Title || 'Статья');
    setMeta('meta[property="og:description"]', 'content', desc);
    setMeta('meta[property="og:type"]', 'content', 'article');
    if (a.Image) setMeta('meta[property="og:image"]', 'content', a.Image);
    setMeta('meta[name="twitter:card"]', 'content', a.Image ? 'summary_large_image' : 'summary');
    setMeta('meta[name="twitter:title"]', 'content', a.Title || 'Статья');
    setMeta('meta[name="twitter:description"]', 'content', desc);
    if (a.Image) setMeta('meta[name="twitter:image"]', 'content', a.Image);
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
    --orange: #f09157; --gold: #f0a641; --red: #de0030;
    --r-lg: 24px; --r-md: 14px; --r-pill: 999px;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --shadow-sm: 0 4px 16px -8px rgba(9, 23, 71, 0.18); --shadow: 0 20px 50px -28px rgba(9, 23, 71, 0.3);
    --wrap: 760px;
    background: var(--bg); color: var(--ink);
    font-family: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 18px; line-height: 1.6; -webkit-font-smoothing: antialiased; overflow-x: hidden;
}
.pd *, .pd *::before, .pd *::after { box-sizing: border-box; }
.pd-wrap { width: 100%; max-width: var(--wrap); margin-inline: auto; padding-inline: 24px; }
.pd-ic { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
[data-reveal] { opacity: 0; transform: translateY(16px); transition: opacity 0.6s var(--ease-out), transform 0.6s var(--ease-out); }
.pd.is-ready [data-reveal] { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { [data-reveal] { opacity: 1; transform: none; transition: none; } }

.pd-art__loading, .pd-art__missing { padding: 90px 24px; text-align: center; color: var(--ink-2); }
.pd-art__missing .pd-btn { margin-top: 16px; display: inline-block; text-decoration: none; }

/* ── Head ───────────────────────────────────────────────────────────────── */
.pd-art__head { padding: 40px 24px 0; }
.pd-art__back { display: inline-flex; align-items: center; gap: 4px; color: var(--ink-2); text-decoration: none; font-weight: 600; font-size: 0.92rem; }
.pd-art__back .pd-ic { width: 18px; height: 18px; }
.pd-art__back:hover { color: var(--blue-ink); }
.pd-art__cat { display: inline-block; margin: 22px 0 0; padding: 5px 13px; background: var(--blue-tint); color: var(--blue-ink); border-radius: var(--r-pill); font-size: 0.8rem; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; }
.pd-art__title { margin: 16px 0 0; font-weight: 800; font-size: clamp(1.9rem, 4.4vw, 2.8rem); line-height: 1.1; letter-spacing: -0.025em; }
.pd-art__meta { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin: 22px 0 0; color: var(--ink-2); font-size: 0.95rem; }
.pd-art__author { display: inline-flex; align-items: center; gap: 9px; }
.pd-art__author b { font-weight: 600; color: var(--ink); }
.pd-art__ava { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; }
.pd-art__ava--i { display: grid; place-items: center; background: var(--blue-tint); color: var(--blue-ink); font-weight: 700; font-size: 0.75rem; }
.pd-art__dot { color: var(--ink-3); }
.pd-art__ratemini { display: inline-flex; align-items: center; gap: 5px; font-weight: 600; color: var(--ink); }
.pd-art__ratemini .pd-star { width: 16px; height: 16px; }
.pd-art__ratecount { color: var(--ink-3); font-weight: 500; }

/* ── Media ──────────────────────────────────────────────────────────────── */
.pd-art__mediawrap { margin-top: 30px; }
.pd-art__cover { width: 100%; height: auto; border-radius: var(--r-lg); display: block; box-shadow: var(--shadow); }
.pd-art__video { position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: var(--r-lg); overflow: hidden; background: #0b1e52; box-shadow: var(--shadow); }
.pd-art__video iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.pd-art__poster { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; padding: 0; cursor: pointer; background: #0b1e52; display: grid; place-items: center; }
.pd-art__poster img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.pd-art__play { position: relative; width: 74px; height: 74px; border-radius: 50%; background: rgba(255, 255, 255, 0.92); display: grid; place-items: center; box-shadow: 0 10px 30px -8px rgba(0, 0, 0, 0.5); transition: transform 0.16s var(--ease-out); }
.pd-art__play svg { width: 34px; height: 34px; fill: var(--blue); margin-left: 3px; }
@media (hover: hover) and (pointer: fine) { .pd-art__poster:hover .pd-art__play { transform: scale(1.08); } }

/* ── Body (marked → v-html) ─────────────────────────────────────────────── */
.pd-art__body { margin: 40px 0 0; font-size: 1.09rem; line-height: 1.75; color: #22304f; }
.pd-art__body :deep(h1), .pd-art__body :deep(h2), .pd-art__body :deep(h3), .pd-art__body :deep(h4) { color: var(--ink); font-weight: 800; letter-spacing: -0.02em; line-height: 1.22; margin: 1.8em 0 0.6em; }
.pd-art__body :deep(h1) { font-size: 1.75rem; }
.pd-art__body :deep(h2) { font-size: 1.5rem; }
.pd-art__body :deep(h3) { font-size: 1.28rem; }
.pd-art__body :deep(h4) { font-size: 1.12rem; }
.pd-art__body :deep(p) { margin: 0 0 1.15em; }
.pd-art__body :deep(a) { color: var(--blue-ink); text-decoration: underline; text-underline-offset: 2px; }
.pd-art__body :deep(ul), .pd-art__body :deep(ol) { margin: 0 0 1.15em; padding-left: 1.4em; }
.pd-art__body :deep(li) { margin: 0.35em 0; }
.pd-art__body :deep(img) { max-width: 100%; height: auto; border-radius: var(--r-md); margin: 1.2em 0; cursor: zoom-in; }
.pd-art__body :deep(blockquote) { margin: 1.4em 0; padding: 16px 22px; color: var(--ink-2); background: var(--bg-tint); border-radius: var(--r-md); font-style: italic; }
.pd-art__body :deep(blockquote p:last-child) { margin-bottom: 0; }
.pd-art__body :deep(code) { background: var(--bg-tint); padding: 2px 6px; border-radius: 6px; font-size: 0.9em; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.pd-art__body :deep(pre) { background: #0b1e52; color: #e8eefc; padding: 16px 18px; border-radius: var(--r-md); overflow-x: auto; margin: 1.4em 0; }
.pd-art__body :deep(pre code) { background: none; padding: 0; color: inherit; }
.pd-art__body :deep(hr) { border: none; border-top: 1px solid var(--line); margin: 2em 0; }
.pd-art__body :deep(table) { width: 100%; border-collapse: collapse; margin: 1.4em 0; font-size: 0.96rem; }
.pd-art__body :deep(th), .pd-art__body :deep(td) { border: 1px solid var(--line); padding: 9px 12px; text-align: left; }
.pd-art__body :deep(th) { background: var(--bg-tint); font-weight: 700; }

/* ── Stars (shared) ─────────────────────────────────────────────────────── */
.pd-star { width: 22px; height: 22px; fill: none; stroke: var(--ink-3); stroke-width: 1.4; stroke-linejoin: round; }
.pd-star--on { fill: var(--gold); stroke: var(--gold); }
.pd-stars { position: relative; display: inline-flex; }
.pd-stars__cell { position: relative; display: inline-block; width: 22px; height: 22px; }
.pd-stars__cell .pd-star { position: absolute; inset: 0; }
.pd-stars__fill { position: absolute; inset: 0; overflow: hidden; }
.pd-stars__fill .pd-star { width: 22px; height: 22px; }

/* ── Rating block ───────────────────────────────────────────────────────── */
.pd-rate { margin: 44px 0 0; padding: 24px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; }
.pd-rate__summary { display: flex; align-items: center; gap: 12px; }
.pd-rate__num { font-weight: 800; font-size: 1.8rem; letter-spacing: -0.02em; }
.pd-rate__count { color: var(--ink-3); font-size: 0.9rem; }
.pd-rate__action { display: flex; align-items: center; gap: 10px; color: var(--ink-2); font-size: 0.95rem; }
.pd-rate__label { font-weight: 500; }
.pd-rate__mine { color: var(--ink); }
.pd-stars--pick { gap: 2px; }
.pd-stars__btn { border: none; background: transparent; padding: 2px; cursor: pointer; line-height: 0; }
.pd-stars__btn .pd-star { transition: fill 0.1s, stroke 0.1s; }
.pd-stars__btn:disabled { cursor: default; }

/* ── Comments ───────────────────────────────────────────────────────────── */
.pd-cmt { margin: 48px 0 90px; }
.pd-cmt__title { font-weight: 800; font-size: 1.5rem; letter-spacing: -0.02em; margin: 0 0 20px; }
.pd-cmt__title span { color: var(--ink-3); font-weight: 700; }
.pd-cmt__form { display: flex; flex-direction: column; gap: 10px; margin-bottom: 26px; }
.pd-cmt__form textarea { width: 100%; border: 1px solid var(--line); background: var(--bg-tint); border-radius: var(--r-md); padding: 13px 16px; font-family: inherit; font-size: 1rem; line-height: 1.5; color: var(--ink); outline: none; resize: vertical; min-height: 60px; }
.pd-cmt__form textarea:focus { border-color: var(--blue-soft); background: var(--surface); }
.pd-cmt__form .pd-btn { align-self: flex-start; }
.pd-cmt__form--reply { margin: 12px 0 4px; }
.pd-cmt__replyacts { display: flex; gap: 8px; }
.pd-cmt__login, .pd-cmt__empty { color: var(--ink-2); }
.pd-cmt__login { padding: 14px 16px; background: var(--bg-tint); border-radius: var(--r-md); margin-bottom: 24px; }
.pd-cmt__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 22px; }
.pd-cmt__row { display: flex; gap: 12px; }
.pd-cmt__row.is-deleted { opacity: 0.65; }
.pd-cmt__ava { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex: none; }
.pd-cmt__ava--i { display: grid; place-items: center; background: var(--blue-tint); color: var(--blue-ink); font-weight: 700; font-size: 0.85rem; }
.pd-cmt__body { flex: 1; min-width: 0; }
.pd-cmt__hd { display: flex; align-items: baseline; gap: 10px; }
.pd-cmt__hd b { font-weight: 700; font-size: 0.98rem; }
.pd-cmt__time { color: var(--ink-3); font-size: 0.82rem; }
.pd-cmt__txt { margin: 4px 0 0; line-height: 1.55; white-space: pre-wrap; word-break: break-word; }
.pd-cmt__txt--del { color: var(--ink-3); font-style: italic; }
.pd-cmt__acts { display: flex; gap: 14px; margin-top: 7px; }
.pd-cmt__act { border: none; background: transparent; padding: 0; color: var(--ink-3); font-family: inherit; font-size: 0.86rem; font-weight: 600; cursor: pointer; }
.pd-cmt__act:hover { color: var(--blue-ink); }
.pd-cmt__act--mod:hover { color: var(--red); }
.pd-cmt__replies { list-style: none; margin: 16px 0 0; padding: 0 0 0 20px; border-left: 2px solid var(--line); display: flex; flex-direction: column; gap: 18px; }

.pd-link { color: var(--blue-ink); font-weight: 600; text-decoration: none; }
.pd-link:hover { text-decoration: underline; }
.pd-btn { border: none; border-radius: var(--r-pill); background: var(--blue); color: #fff; font-family: inherit; font-weight: 700; font-size: 0.95rem; padding: 11px 22px; cursor: pointer; transition: background 0.15s var(--ease-out), transform 0.15s var(--ease-out); }
.pd-btn--sm { padding: 8px 16px; font-size: 0.88rem; }
.pd-btn--ghost { background: var(--surface); color: var(--ink-2); border: 1px solid var(--line); }
.pd-btn:disabled { opacity: 0.55; cursor: default; }
@media (hover: hover) and (pointer: fine) {
    .pd-btn:not(:disabled):hover { background: var(--blue-strong); transform: translateY(-1px); }
    .pd-btn--ghost:not(:disabled):hover { background: var(--bg-tint); color: var(--ink); }
}

@media (max-width: 560px) {
    .pd { font-size: 17px; }
    .pd-art__head { padding-top: 26px; }
    .pd-rate { flex-direction: column; align-items: flex-start; }
}
</style>
