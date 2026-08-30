<!--
  UsersPage.vue — "/users" (specialist directory) in the MeetGuru promo (pd-*) brand language. Demo at
  /users-demo; the live WeWeb page is untouched until go-live.

  Reframed from the WeWeb flat "all users + email" list into a SPECIALIST directory (specialists showcase
  their profile). Faithful to the data + nav:
    - users query (direct, paginated 50/page, sort created_at DESC). Default view = specialists
      (role in ['Спикер','Учебное заведение']); chips also allow Спикер / Учебное заведение / Все.
    - name search (case-insensitive). Server re-query on filter/search/page change (page → 1 on filter).
    - card: Photo (placeholder fallback), Name, role badge, Description (bio), course count, «Написать».
      Card → /profile_page?user=<id> (the live public profile). «Написать» → /chats?user=<id> (live chats
      deep-link that opens/creates the 1-on-1). Email is NOT shown (privacy — the WeWeb version exposed it).
    - empty: «Никто не найден». Heading «Сообщество кинезиологов». SEO title/desc reused.
-->
<template>
    <main class="pd" :class="{ 'is-ready': ready }">
        <header class="pd-hero">
            <div class="pd-wrap">
                <h1 class="pd-hero__title" data-reveal>Сообщество кинезиологов</h1>
                <p class="pd-hero__sub" data-reveal>Специалисты, спикеры и учебные заведения платформы МитГуру.</p>
            </div>
        </header>

        <section class="pd-section">
            <div class="pd-wrap">
                <div class="pd-filters" data-reveal>
                    <label class="pd-search">
                        <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
                        <input v-model="q" type="search" placeholder="Имя специалиста" aria-label="Поиск по имени" @input="onSearch" />
                    </label>
                    <div class="pd-chips">
                        <button
                            v-for="c in CHIPS" :key="c.key" type="button"
                            class="pd-chip" :class="{ 'is-on': roleKey === c.key }" @click="pickRole(c.key)"
                        >{{ c.label }}</button>
                    </div>
                </div>

                <p v-if="loading" class="pd-empty">Загрузка…</p>
                <p v-else-if="!users.length" class="pd-empty">Никто не найден</p>

                <template v-else>
                    <div class="pd-grid">
                        <a
                            v-for="u in users" :key="u.id"
                            class="pd-ucard" :href="`/profile_page?user=${u.id}`" data-reveal
                        >
                            <div class="pd-ucard__top">
                                <img v-if="u.Photo" class="pd-ucard__ava" :src="u.Photo" :alt="u.Name" loading="lazy" />
                                <span v-else class="pd-ucard__ava pd-ucard__ava--i">{{ initials(u.Name) }}</span>
                                <div class="pd-ucard__id">
                                    <b class="pd-ucard__name">{{ u.Name || 'Специалист' }}</b>
                                    <span v-if="roleLabel(u.role)" class="pd-ucard__role">{{ roleLabel(u.role) }}</span>
                                </div>
                            </div>
                            <p v-if="bioOf(u)" class="pd-ucard__bio">{{ bioOf(u) }}</p>
                            <div class="pd-ucard__spacer"></div>
                            <div class="pd-ucard__foot">
                                <span v-if="courseCount(u)" class="pd-ucard__stat">{{ courseCount(u) }} {{ plural(courseCount(u), 'курс', 'курса', 'курсов') }}</span>
                                <button v-if="myId && u.id !== myId" type="button" class="pd-ucard__write" @click.prevent="writeTo(u.id)">Написать</button>
                            </div>
                        </a>
                    </div>

                    <div v-if="totalPages > 1" class="pd-pager">
                        <button type="button" class="pd-pager__btn" :disabled="page <= 1" @click="goPage(page - 1)" aria-label="Назад">
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>
                        </button>
                        <span class="pd-pager__label">{{ page }} из {{ totalPages }}</span>
                        <button type="button" class="pd-pager__btn" :disabled="page >= totalPages" @click="goPage(page + 1)" aria-label="Вперёд">
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
                        </button>
                    </div>
                </template>
            </div>
        </section>
    </main>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { getSupabase, readStoredSession } from '@/_front/chrome/headerAccount.js';

const PER_PAGE = 50;
const SPECIALIST_ROLES = ['Спикер', 'Учебное заведение'];
const CHIPS = [
    { key: 'specialists', label: 'Специалисты' },
    { key: 'Спикер', label: 'Спикер' },
    { key: 'Учебное заведение', label: 'Учебное заведение' },
    { key: 'all', label: 'Все' },
];
const USER_COLS = 'id, "Name", "Photo", role, "Description", courses';

let sb = null;
let searchTimer = null;
const myId = ref(null);
const loading = ref(true);
const ready = ref(false);
const users = ref([]);
const totalPages = ref(1);
const page = ref(1);
const roleKey = ref('specialists');
const q = ref('');

function initials(name) {
    const p = (name || '').split(/\s+/).filter(Boolean);
    return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '·';
}
function roleLabel(role) {
    if (role === 'Спикер') return 'Спикер';
    if (role === 'Учебное заведение') return 'Учебное заведение';
    return '';
}
function bioOf(u) {
    const d = (u.Description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return d.length > 130 ? d.slice(0, 130).replace(/\S*$/, '').trim() + '…' : d;
}
function courseCount(u) { return Array.isArray(u.courses) ? u.courses.length : 0; }
function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
}

function writeTo(id) { window.location.href = `/chats?user=${id}`; }   // live chats deep-link (opens/creates the 1-on-1)

async function fetchUsers() {
    if (!sb) return;
    loading.value = true;
    const from = (page.value - 1) * PER_PAGE;
    let query = sb.from('users').select(USER_COLS, { count: 'exact' });

    if (roleKey.value === 'specialists') query = query.in('role', SPECIALIST_ROLES);
    else if (roleKey.value !== 'all') query = query.eq('role', roleKey.value);

    const needle = q.value.trim();
    if (needle) query = query.ilike('Name', `%${needle}%`);

    const { data, count } = await query.order('created_at', { ascending: false }).range(from, from + PER_PAGE - 1);
    users.value = data || [];
    totalPages.value = Math.max(1, Math.ceil((count || 0) / PER_PAGE));
    loading.value = false;
}

function pickRole(key) { if (roleKey.value === key) return; roleKey.value = key; page.value = 1; fetchUsers(); }
function onSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { page.value = 1; fetchUsers(); }, 300);
}
function goPage(p) {
    if (p < 1 || p > totalPages.value) return;
    page.value = p;
    fetchUsers();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

onMounted(async () => {
    ensureFonts();
    applySeo();
    sb = getSupabase();
    myId.value = readStoredSession()?.user?.id || null;
    await fetchUsers();
    await nextTick();
    ready.value = true;
});

function applySeo() {
    document.title = 'Сообщество кинезиологов — МитГуру';
    let m = document.head.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement('meta'); m.setAttribute('name', 'description'); document.head.appendChild(m); }
    m.setAttribute('content', 'Познакомьтесь с участниками профессионального сообщества кинезиологов на платформе МитГуру.');
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
    --orange: #f09157;
    --r-lg: 22px; --r-md: 14px; --r-pill: 999px;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --shadow-sm: 0 4px 16px -8px rgba(9, 23, 71, 0.18); --shadow-hov: 0 22px 46px -26px rgba(9, 23, 71, 0.32);
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

.pd-filters { display: flex; flex-direction: column; gap: 14px; margin-bottom: 28px; }
.pd-search { display: flex; align-items: center; gap: 10px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-pill); padding: 0 18px; height: 50px; max-width: 420px; }
.pd-search:focus-within { border-color: var(--blue-soft); box-shadow: 0 0 0 4px var(--blue-tint); }
.pd-search .pd-ic { width: 18px; height: 18px; color: var(--ink-3); flex: none; }
.pd-search input { flex: 1; border: none; outline: none; background: transparent; font-family: inherit; font-size: 15px; color: var(--ink); min-width: 0; }
.pd-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.pd-chip { border: 1px solid var(--line); background: var(--surface); border-radius: var(--r-pill); padding: 8px 16px; font-family: inherit; font-size: 0.9rem; font-weight: 600; color: var(--ink-2); cursor: pointer; transition: background 0.14s var(--ease-out), color 0.14s, border-color 0.14s; }
@media (hover: hover) and (pointer: fine) { .pd-chip:hover { border-color: var(--blue-soft); color: var(--ink); } }
.pd-chip.is-on { background: var(--blue); border-color: var(--blue); color: #fff; }

.pd-empty { padding: 60px 0; text-align: center; color: var(--ink-3); }

.pd-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.pd-ucard { display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 20px; text-decoration: none; color: inherit; transition: transform 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out), border-color 0.2s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .pd-ucard:hover { transform: translateY(-4px); box-shadow: var(--shadow-hov); border-color: transparent; } }
.pd-ucard__top { display: flex; align-items: center; gap: 14px; }
.pd-ucard__ava { width: 62px; height: 62px; border-radius: 50%; object-fit: cover; flex: none; }
.pd-ucard__ava--i { display: grid; place-items: center; background: var(--blue-tint); color: var(--blue-ink); font-weight: 700; font-size: 1.1rem; }
.pd-ucard__id { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.pd-ucard__name { font-weight: 700; font-size: 1.08rem; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pd-ucard__role { align-self: flex-start; background: var(--blue-tint); color: var(--blue-ink); border-radius: var(--r-pill); padding: 3px 11px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; }
.pd-ucard__bio { margin: 14px 0 0; color: var(--ink-2); font-size: 0.92rem; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.pd-ucard__spacer { flex: 1; min-height: 16px; }
.pd-ucard__foot { display: flex; align-items: center; gap: 12px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--line); }
.pd-ucard__stat { color: var(--ink-2); font-size: 0.86rem; font-weight: 600; }
.pd-ucard__write { margin-left: auto; border: 1px solid var(--line); background: var(--surface); color: var(--blue-ink); border-radius: var(--r-pill); padding: 7px 16px; font-family: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: background 0.14s, border-color 0.14s; }
@media (hover: hover) and (pointer: fine) { .pd-ucard__write:hover { background: var(--blue-tint); border-color: var(--blue-soft); } }

.pd-pager { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 40px; }
.pd-pager__btn { width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid var(--line); background: var(--surface); border-radius: 50%; color: var(--ink); cursor: pointer; transition: background 0.14s, border-color 0.14s; }
.pd-pager__btn .pd-ic { width: 20px; height: 20px; }
.pd-pager__btn:disabled { opacity: 0.4; cursor: default; }
@media (hover: hover) and (pointer: fine) { .pd-pager__btn:not(:disabled):hover { background: var(--blue-tint); border-color: var(--blue-soft); } }
.pd-pager__label { font-weight: 600; color: var(--ink-2); font-size: 0.95rem; min-width: 80px; text-align: center; }

@media (max-width: 980px) { .pd-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 620px) {
    .pd-wrap { padding-inline: 22px; }
    .pd-grid { grid-template-columns: 1fr; }
    .pd-search { max-width: none; }
}
</style>
