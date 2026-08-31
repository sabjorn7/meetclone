<!--
  CoursesManagePage.vue — "/courses_manage" (creator course management) in the MeetGuru promo (pd-*)
  brand language. Hand-written rebuild of the WeWeb page, done in phases (see the redesign plan):

    PHASE 0 (this file, current) — scaffold + access gate + READ-ONLY course list. No writes.
      Later phases add: 1) metadata create/edit/delete, 2) pricing & moderation, 3) lessons,
      4) PeerTube video upload (reusing the proven uploader element), 5) grants/bans/chat.

  Demo at /courses-manage-demo; the live WeWeb page stays untouched until go-live. Gets the shared
  AppHeader/AppFooter.

  ACCESS: this is a creator-only surface (same gate the header nav uses).
    - guest → /login
    - logged in but not a creator (role ∉ {Спикер, Учебное заведение, admin}) → / (home)
    - creator → show only their own courses (owner = me)
-->
<template>
    <main class="pd" :class="{ 'is-ready': ready }">
        <div v-if="loading" class="pd-wrap pd-load">Загрузка…</div>

        <section v-else class="pd-section">
            <div class="pd-wrap">
                <header class="pd-head" data-reveal>
                    <div class="pd-head__row">
                        <div>
                            <h1 class="pd-head__title">Управление курсами</h1>
                            <p class="pd-head__descr">Ваши курсы, статусы модерации и материалы. Редактирование появится на следующем этапе.</p>
                        </div>
                        <!-- create lands in Phase 1; shown disabled so the layout is honest -->
                        <button type="button" class="pd-btn" disabled title="Скоро — на следующем этапе">
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
                            Добавить курс
                        </button>
                    </div>
                </header>

                <div class="pd-toolbar" data-reveal>
                    <div class="pd-search">
                        <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
                        <input v-model="search" type="search" placeholder="Поиск по названию" aria-label="Поиск по названию" />
                    </div>
                    <div class="pd-chips">
                        <button type="button" class="pd-chip" :class="{ 'is-on': filter === 'all' }" @click="filter = 'all'">Все <span class="pd-chip__n">{{ courses.length }}</span></button>
                        <button v-if="discountCount" type="button" class="pd-chip" :class="{ 'is-on': filter === 'discount' }" @click="filter = 'discount'">Скидки <span class="pd-chip__n">{{ discountCount }}</span></button>
                        <button v-if="fixCount" type="button" class="pd-chip pd-chip--warn" :class="{ 'is-on': filter === 'fix' }" @click="filter = 'fix'">Нужно исправить <span class="pd-chip__n">{{ fixCount }}</span></button>
                        <span v-if="folders.length" class="pd-chips__sep" aria-hidden="true"></span>
                        <button v-for="f in folders" :key="f.id" type="button" class="pd-chip" :class="{ 'is-on': filter === f.id }" @click="filter = f.id">
                            <svg viewBox="0 0 24 24" class="pd-ic pd-chip__ic" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                            {{ f.title }} <span class="pd-chip__n">{{ folderCount(f.id) }}</span>
                        </button>
                    </div>
                </div>

                <p class="pd-count" data-reveal>{{ visible.length }} {{ plural(visible.length, ['курс', 'курса', 'курсов']) }}</p>

                <ul v-if="visible.length" class="pd-grid" data-reveal>
                    <li v-for="c in visible" :key="c.id" class="pd-card">
                        <div class="pd-card__top">
                            <span class="pd-badge" :class="`pd-badge--${statusMeta(c.ModStatus).cls}`">{{ statusMeta(c.ModStatus).label }}</span>
                            <span v-if="hasDiscount(c)" class="pd-badge pd-badge--sale">Скидка</span>
                        </div>
                        <h2 class="pd-card__title">{{ c.Title || 'Без названия' }}</h2>
                        <div class="pd-card__meta">
                            <span class="pd-price">{{ priceLabel(c) }}</span>
                            <span class="pd-dot" aria-hidden="true">·</span>
                            <span class="pd-meta-i">
                                <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
                                {{ lessonCount(c) }} {{ plural(lessonCount(c), ['урок', 'урока', 'уроков']) }}
                            </span>
                            <span v-if="c.video_id" class="pd-dot" aria-hidden="true">·</span>
                            <span v-if="c.video_id" class="pd-meta-i pd-meta-i--ok">
                                <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M4 5h16v14H4zM10 9l5 3-5 3z"/></svg>
                                Тизер
                            </span>
                        </div>
                        <p v-if="modNote(c)" class="pd-card__note">
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
                            {{ modNote(c) }}
                        </p>
                        <div class="pd-card__foot">
                            <span v-if="folderTitle(c.folder)" class="pd-folder">
                                <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                                {{ folderTitle(c.folder) }}
                            </span>
                            <a v-if="c.slug" class="pd-card__link" :href="`/course/${c.slug}`" target="_blank" rel="noopener noreferrer">Открыть страницу →</a>
                        </div>
                    </li>
                </ul>
                <p v-else class="pd-empty" data-reveal>Ничего не найдено.</p>
            </div>
        </section>
    </main>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { getSupabase, readStoredSession, authCookieUser, loadUser } from '@/_front/chrome/headerAccount.js';

const CREATORS = ['Спикер', 'Учебное заведение', 'admin'];

let sb = null;
const myId = ref(null);
const loading = ref(true);
const ready = ref(false);
const courses = ref([]);
const folders = ref([]);
const search = ref('');
const filter = ref('all'); // 'all' | 'discount' | 'fix' | <folder id>

const STATUS = {
    'Опубликовано': { label: 'Опубликовано', cls: 'live' },
    'Черновик': { label: 'Черновик', cls: 'draft' },
    'Снято с публикации': { label: 'Снято с публикации', cls: 'off' },
    'Отправлено на доработку': { label: 'На доработку', cls: 'fix' },
    'Отправлено на модерацию': { label: 'На модерации', cls: 'mod' },
};
function statusMeta(s) { return STATUS[s] || { label: s || 'Черновик', cls: 'draft' }; }

function num(v) { return Number(v || 0); }
function lessonCount(c) { return Array.isArray(c.Less_Id) ? c.Less_Id.length : 0; }
function hasDiscount(c) { return !c.Free && num(c.old_price) > num(c.Price) && num(c.Price) > 0; }
function needsFix(c) {
    return c.ModStatus === 'Отправлено на доработку'
        || !!(c.Edit_Comment && String(c.Edit_Comment).trim())
        || !!(c.Edit_Lessons_Comment && String(c.Edit_Lessons_Comment).trim());
}
function modNote(c) {
    return (c.Edit_Comment && String(c.Edit_Comment).trim())
        || (c.Edit_Lessons_Comment && String(c.Edit_Lessons_Comment).trim())
        || '';
}
function priceLabel(c) {
    if (c.Free) return 'Бесплатно';
    const p = num(c.Price);
    return p ? `${p.toLocaleString('ru-RU')} ₽` : 'Цена не указана';
}
function folderTitle(id) { return id ? (folders.value.find((f) => f.id === id)?.title || '') : ''; }
function folderCount(id) { return courses.value.filter((c) => c.folder === id).length; }
function plural(n, [one, few, many]) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
}

const discountCount = computed(() => courses.value.filter(hasDiscount).length);
const fixCount = computed(() => courses.value.filter(needsFix).length);

const visible = computed(() => {
    let list = courses.value;
    if (filter.value === 'discount') list = list.filter(hasDiscount);
    else if (filter.value === 'fix') list = list.filter(needsFix);
    else if (filter.value !== 'all') list = list.filter((c) => c.folder === filter.value);
    const q = search.value.trim().toLowerCase();
    if (q) list = list.filter((c) => (c.Title || '').toLowerCase().includes(q));
    return list;
});

const COLS = 'id, "Title", "Free", "Price", old_price, "DurationPrice", "DurationLong", "ModStatus", "Less_Id", folder, video_id, slug, "Edit_Comment", "Edit_Lessons_Comment", created_at';

async function load() {
    sb = getSupabase();
    myId.value = readStoredSession()?.user?.id || authCookieUser()?.id || null;
    if (!myId.value) { window.location.href = '/login'; return; }
    if (!sb) { loading.value = false; return; }

    // creator-only gate (mirrors the header nav)
    const me = await loadUser(sb);
    if (!me || !CREATORS.includes(me.role)) { window.location.href = '/'; return; }

    const [{ data: cs }, { data: fs }] = await Promise.all([
        sb.from('course').select(COLS).eq('owner', myId.value).order('created_at', { ascending: false }).limit(2000),
        sb.from('course_folders').select('id, title, priority').eq('creator', myId.value).order('priority', { ascending: true }),
    ]);
    courses.value = cs || [];
    folders.value = fs || [];

    loading.value = false;
    await nextTick();
    ready.value = true;
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
    --gold: #f0a641; --green: #157a38; --green-tint: #e5f4ea; --red: #de0030; --red-tint: #fdeaee;
    --orange: #c9660a; --orange-tint: #fdefe0; --grey-tint: #eef1f6;
    --r-lg: 18px; --r-md: 12px; --r-pill: 999px;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --shadow-sm: 0 4px 16px -8px rgba(9, 23, 71, 0.18);
    --wrap: 1160px;
    background: var(--bg); color: var(--ink);
    font-family: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 16px; line-height: 1.5; -webkit-font-smoothing: antialiased; overflow-x: hidden;
}
.pd *, .pd *::before, .pd *::after { box-sizing: border-box; }
.pd-wrap { width: 100%; max-width: var(--wrap); margin-inline: auto; padding-inline: 24px; }
.pd-ic { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
[data-reveal] { opacity: 0; transform: translateY(14px); transition: opacity 0.5s var(--ease-out), transform 0.5s var(--ease-out); }
.pd.is-ready [data-reveal] { opacity: 1; transform: none; }
.pd.is-ready [data-reveal]:nth-child(2) { transition-delay: 0.05s; }
.pd.is-ready [data-reveal]:nth-child(3) { transition-delay: 0.08s; }
@media (prefers-reduced-motion: reduce) { [data-reveal] { opacity: 1; transform: none; transition: none; } }

.pd-section { padding: 34px 0 90px; }
.pd-load { padding: 90px 24px; text-align: center; color: var(--ink-2); }

.pd-head { margin-bottom: 22px; }
.pd-head__row { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.pd-head__title { margin: 0; font-weight: 800; font-size: clamp(1.6rem, 3.2vw, 2.2rem); line-height: 1.1; letter-spacing: -0.025em; }
.pd-head__descr { margin: 8px 0 0; color: var(--ink-2); font-size: 1rem; max-width: 60ch; }

.pd-btn { display: inline-flex; align-items: center; gap: 8px; border: none; border-radius: var(--r-pill); background: var(--blue); color: #fff; font-family: inherit; font-weight: 700; font-size: 0.95rem; padding: 11px 22px; cursor: pointer; text-decoration: none; transition: background 0.15s var(--ease-out), transform 0.15s var(--ease-out); white-space: nowrap; }
.pd-btn .pd-ic { width: 18px; height: 18px; }
.pd-btn:disabled { opacity: 0.45; cursor: not-allowed; }
@media (hover: hover) and (pointer: fine) { .pd-btn:not(:disabled):hover { background: var(--blue-strong); transform: translateY(-1px); } }

.pd-toolbar { display: flex; flex-direction: column; gap: 14px; margin-bottom: 16px; }
.pd-search { display: flex; align-items: center; gap: 9px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-pill); padding: 10px 16px; max-width: 420px; }
.pd-search .pd-ic { width: 18px; height: 18px; color: var(--ink-3); flex: none; }
.pd-search input { border: 0; outline: none; background: none; font-family: inherit; font-size: 0.96rem; color: var(--ink); width: 100%; }
.pd-search input::placeholder { color: var(--ink-3); }

.pd-chips { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pd-chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line); background: var(--surface); border-radius: var(--r-pill); padding: 7px 14px; cursor: pointer; font-family: inherit; font-size: 0.9rem; font-weight: 600; color: var(--ink-2); transition: background 0.14s var(--ease-out), border-color 0.14s, color 0.14s; }
.pd-chip__ic { width: 15px; height: 15px; }
.pd-chip__n { font-size: 0.8rem; color: var(--ink-3); font-weight: 700; }
.pd-chip.is-on { background: var(--blue); border-color: var(--blue); color: #fff; }
.pd-chip.is-on .pd-chip__n { color: rgba(255, 255, 255, 0.8); }
.pd-chip--warn { color: var(--orange); border-color: #f3d3ac; background: var(--orange-tint); }
.pd-chip--warn.is-on { background: var(--orange); border-color: var(--orange); color: #fff; }
.pd-chip--warn.is-on .pd-chip__n { color: rgba(255, 255, 255, 0.85); }
@media (hover: hover) and (pointer: fine) { .pd-chip:not(.is-on):hover { border-color: var(--blue-soft); color: var(--blue-ink); } }
.pd-chips__sep { width: 1px; align-self: stretch; background: var(--line); margin: 2px 4px; }

.pd-count { margin: 0 0 14px; color: var(--ink-3); font-size: 0.88rem; font-weight: 600; }

.pd-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 14px; }
.pd-card { display: flex; flex-direction: column; gap: 10px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 18px; transition: border-color 0.15s var(--ease-out), box-shadow 0.15s; }
@media (hover: hover) and (pointer: fine) { .pd-card:hover { border-color: #d3dced; box-shadow: var(--shadow-sm); } }
.pd-card__top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pd-badge { display: inline-flex; align-items: center; border-radius: var(--r-pill); padding: 3px 11px; font-size: 0.76rem; font-weight: 700; letter-spacing: 0.01em; }
.pd-badge--live { background: var(--green-tint); color: var(--green); }
.pd-badge--draft { background: var(--grey-tint); color: var(--ink-2); }
.pd-badge--off { background: var(--red-tint); color: var(--red); }
.pd-badge--fix { background: var(--orange-tint); color: var(--orange); }
.pd-badge--mod { background: var(--blue-tint); color: var(--blue-ink); }
.pd-badge--sale { background: var(--gold); color: #4a2c00; }
.pd-card__title { margin: 0; font-weight: 700; font-size: 1.02rem; line-height: 1.3; letter-spacing: -0.01em; }
.pd-card__meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: var(--ink-2); font-size: 0.9rem; }
.pd-price { font-weight: 700; color: var(--ink); }
.pd-dot { color: var(--ink-3); }
.pd-meta-i { display: inline-flex; align-items: center; gap: 5px; }
.pd-meta-i .pd-ic { width: 15px; height: 15px; color: var(--ink-3); }
.pd-meta-i--ok { color: var(--green); }
.pd-meta-i--ok .pd-ic { color: var(--green); }
.pd-card__note { display: flex; align-items: flex-start; gap: 7px; margin: 0; background: var(--orange-tint); color: var(--orange); border-radius: var(--r-md); padding: 8px 11px; font-size: 0.85rem; line-height: 1.4; }
.pd-card__note .pd-ic { width: 15px; height: 15px; flex: none; margin-top: 2px; }
.pd-card__foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: auto; padding-top: 4px; flex-wrap: wrap; }
.pd-folder { display: inline-flex; align-items: center; gap: 5px; color: var(--ink-3); font-size: 0.84rem; font-weight: 600; }
.pd-folder .pd-ic { width: 15px; height: 15px; }
.pd-card__link { color: var(--blue-ink); font-weight: 700; font-size: 0.86rem; text-decoration: none; white-space: nowrap; }
@media (hover: hover) and (pointer: fine) { .pd-card__link:hover { text-decoration: underline; } }

.pd-empty { color: var(--ink-3); text-align: center; padding: 50px 0; }

@media (max-width: 560px) {
    .pd-grid { grid-template-columns: 1fr; }
}
</style>
