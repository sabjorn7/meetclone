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
                            <p class="pd-head__descr">Ваши курсы, статусы модерации и материалы. Нажмите на курс, чтобы отредактировать.</p>
                        </div>
                        <button type="button" class="pd-btn" @click="openCreate">
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
                        <button type="button" class="pd-chip pd-chip--gear" title="Управление папками" aria-label="Управление папками" @click="foldersOpen = true">
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                        </button>
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
                    <li v-for="c in visible" :key="c.id" class="pd-card pd-card--btn" tabindex="0" role="button" @click="openEdit(c)" @keydown.enter="openEdit(c)">
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
                            <template v-if="durationLabel(c)">
                                <span class="pd-dot" aria-hidden="true">·</span>
                                <span class="pd-meta-i">
                                    <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2.5"/></svg>
                                    {{ durationLabel(c) }}
                                </span>
                            </template>
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
                            <a v-if="c.slug" class="pd-card__link" :href="`/course/${c.slug}`" target="_blank" rel="noopener noreferrer" @click.stop>Открыть страницу →</a>
                        </div>
                    </li>
                </ul>
                <p v-else class="pd-empty" data-reveal>Ничего не найдено.</p>
            </div>
        </section>

        <!-- course create / edit modal (metadata only — no money) -->
        <div v-if="editing" class="pd-modal" @click.self="closeModal">
            <div class="pd-dialog" role="dialog" aria-modal="true">
                <div class="pd-dialog__head">
                    <h2 class="pd-dialog__title">{{ editing.isCreate ? 'Новый курс' : 'Редактирование курса' }}</h2>
                    <button type="button" class="pd-x" aria-label="Закрыть" @click="closeModal">
                        <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
                    </button>
                </div>

                <div v-if="!form" class="pd-dialog__body pd-dialog__body--load">Загрузка…</div>
                <div v-else class="pd-dialog__body">
                    <!-- moderation / publication (existing courses only) -->
                    <div v-if="!editing.isCreate" class="pd-modblock">
                        <div class="pd-modblock__row">
                            <span class="pd-modblock__lb">Статус</span>
                            <span class="pd-badge" :class="`pd-badge--${statusMeta(editing.ModStatus).cls}`">{{ statusMeta(editing.ModStatus).label }}</span>
                            <span class="pd-spacer"></span>
                            <button
                                v-if="nextStatusAction()" type="button"
                                class="pd-btn pd-btn--sm" :class="nextStatusAction().danger ? 'pd-btn--dangerghost' : 'pd-btn--ghost'"
                                :disabled="statusBusy" @click="setStatus(nextStatusAction().to)">
                                {{ statusBusy ? '…' : nextStatusAction().label }}
                            </button>
                        </div>
                        <p v-if="editing.ModStatus === 'Отправлено на модерацию'" class="pd-modblock__hint">Курс на проверке у модератора. Публикацию подтверждает администратор.</p>
                        <p v-if="modNote(editing)" class="pd-modblock__note">
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
                            Замечание модератора: {{ modNote(editing) }}
                        </p>
                    </div>

                    <label class="pd-field">
                        <span class="pd-field__lb">Название<b class="pd-req">*</b></span>
                        <input v-model="form.Title" type="text" class="pd-input" placeholder="Название курса" maxlength="200" />
                    </label>

                    <div class="pd-field">
                        <span class="pd-field__lb">Тип</span>
                        <div class="pd-seg">
                            <button v-for="cat in CATEGORIES" :key="cat" type="button" class="pd-seg__b" :class="{ 'is-on': form.Category === cat }" @click="form.Category = cat">{{ cat }}</button>
                        </div>
                    </div>

                    <label class="pd-field">
                        <span class="pd-field__lb">Описание</span>
                        <textarea v-model="form.Decription" class="pd-input pd-textarea" rows="3" placeholder="О чём этот курс" maxlength="4000"></textarea>
                    </label>

                    <label class="pd-field">
                        <span class="pd-field__lb">Чему научит</span>
                        <textarea v-model="form.WhatTeach" class="pd-input pd-textarea" rows="3" placeholder="Программа, навыки, результат" maxlength="8000"></textarea>
                    </label>

                    <label class="pd-field">
                        <span class="pd-field__lb">Для кого курс</span>
                        <textarea v-model="form.For" class="pd-input pd-textarea" rows="2" placeholder="Целевая аудитория" maxlength="2000"></textarea>
                    </label>

                    <label class="pd-field">
                        <span class="pd-field__lb">Папка</span>
                        <select v-model="form.folder" class="pd-input pd-select">
                            <option :value="null">Без папки</option>
                            <option v-for="f in folders" :key="f.id" :value="f.id">{{ f.title }}</option>
                        </select>
                    </label>

                    <!-- access & price -->
                    <div class="pd-money">
                        <span class="pd-money__h">Доступ и цена</span>
                        <label class="pd-check">
                            <input v-model="form.Free" type="checkbox" />
                            <span>Бесплатный курс</span>
                        </label>

                        <template v-if="!form.Free">
                            <div class="pd-row2">
                                <label class="pd-field">
                                    <span class="pd-field__lb">Цена, ₽</span>
                                    <input v-model.number="form.Price" type="number" min="0" step="100" class="pd-input" placeholder="0" />
                                </label>
                                <label class="pd-field">
                                    <span class="pd-field__lb">Старая цена, ₽ <em class="pd-opt">для скидки</em></span>
                                    <input v-model.number="form.old_price" type="number" min="0" step="100" class="pd-input" placeholder="—" />
                                </label>
                            </div>

                            <div class="pd-field">
                                <span class="pd-field__lb">Срок доступа</span>
                                <div class="pd-seg">
                                    <button v-for="d in DURATIONS" :key="d.v" type="button" class="pd-seg__b" :class="{ 'is-on': form.DurationLong === d.v }" @click="form.DurationLong = d.v">{{ d.label }}</button>
                                </div>
                            </div>

                            <label v-if="form.DurationLong !== 0" class="pd-field">
                                <span class="pd-field__lb">Цена продления, ₽ <em class="pd-opt">после окончания срока</em></span>
                                <input v-model.number="form.DurationPrice" type="number" min="0" step="100" class="pd-input" placeholder="0" />
                            </label>

                            <label class="pd-check">
                                <input v-model="form.Buy" type="checkbox" />
                                <span>Доступен к покупке</span>
                            </label>
                        </template>
                    </div>
                </div>

                <p v-if="editing && form && formError" class="pd-formerr">{{ formError }}</p>

                <div class="pd-dialog__foot">
                    <button v-if="!editing.isCreate" type="button" class="pd-btn pd-btn--danger" :disabled="!form" @click="confirmDelete = true">Удалить курс</button>
                    <span class="pd-spacer"></span>
                    <button type="button" class="pd-btn pd-btn--ghost" @click="closeModal">Отменить</button>
                    <button type="button" class="pd-btn" :disabled="saving || !form || !form.Title.trim()" @click="saveCourse">{{ saving ? 'Сохраняем…' : 'Сохранить' }}</button>
                </div>

                <!-- delete confirm overlay -->
                <div v-if="confirmDelete" class="pd-confirm">
                    <div class="pd-confirm__box">
                        <p class="pd-confirm__t">Удалить курс «{{ form.Title || 'без названия' }}»?</p>
                        <p class="pd-confirm__d">Действие необратимо. Уроки курса останутся в базе, но курс исчезнет из каталога.</p>
                        <div class="pd-confirm__foot">
                            <button type="button" class="pd-btn pd-btn--ghost" @click="confirmDelete = false">Отмена</button>
                            <button type="button" class="pd-btn pd-btn--danger" :disabled="deleting" @click="deleteCourse">{{ deleting ? 'Удаляем…' : 'Удалить' }}</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- folders management modal -->
        <div v-if="foldersOpen" class="pd-modal" @click.self="foldersOpen = false">
            <div class="pd-dialog pd-dialog--sm" role="dialog" aria-modal="true">
                <div class="pd-dialog__head">
                    <h2 class="pd-dialog__title">Папки</h2>
                    <button type="button" class="pd-x" aria-label="Закрыть" @click="foldersOpen = false">
                        <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
                    </button>
                </div>
                <div class="pd-dialog__body">
                    <div class="pd-newfolder">
                        <input v-model="newFolder" type="text" class="pd-input" placeholder="Новая папка" maxlength="80" @keydown.enter="createFolder" />
                        <button type="button" class="pd-btn" :disabled="folderBusy || !newFolder.trim()" @click="createFolder">Добавить</button>
                    </div>
                    <ul v-if="folders.length" class="pd-flist">
                        <li v-for="f in folders" :key="f.id" class="pd-frow">
                            <span class="pd-frow__t"><svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>{{ f.title }} <em>{{ folderCount(f.id) }}</em></span>
                            <button type="button" class="pd-frow__del" :disabled="folderBusy" aria-label="Удалить папку" @click="deleteFolder(f.id)">
                                <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>
                            </button>
                        </li>
                    </ul>
                    <p v-else class="pd-hint">Папок пока нет.</p>
                </div>
            </div>
        </div>
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

// ── Phase 1: metadata create / edit / delete (no money) ──────────────────────
const CATEGORIES = ['Запись семинара', 'Онлайн-курс'];
const DURATIONS = [{ v: 0, label: 'Бессрочный' }, { v: 6, label: '6 мес.' }, { v: 12, label: '12 мес.' }];
const editing = ref(null);         // the course being edited, or { isCreate: true }
const form = ref(null);            // { Title, Category, Decription, WhatTeach, For, folder }
const formLoading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const confirmDelete = ref(false);
const formError = ref('');
const foldersOpen = ref(false);    // folders-management modal
const newFolder = ref('');
const folderBusy = ref(false);

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
// Access duration (DurationLong is in MONTHS; 0 = lifetime). Only meaningful for paid courses —
// free courses are always accessible, so we don't show a period for them.
function durationLabel(c) {
    if (c.Free) return '';
    const d = num(c.DurationLong);
    return d ? `${d} мес.` : 'Бессрочный';
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

const COLS = 'id, "Title", "Free", "Price", old_price, "DurationPrice", "DurationLong", "Buy", "ModStatus", "Less_Id", folder, video_id, slug, "Edit_Comment", "Edit_Lessons_Comment", created_at';

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

// ── slug (Cyrillic → url-safe latin), mirrors the site's existing course slugs ──
const TRANSLIT = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
    к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
    х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};
function slugify(str) {
    return String(str || '')
        .toLowerCase()
        .split('').map((ch) => (ch in TRANSLIT ? TRANSLIT[ch] : ch)).join('')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'kurs';
}
// Ensure the slug is unique across `course` (append -2, -3… on collision).
async function uniqueSlug(base, excludeId) {
    let slug = base, n = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        let q = sb.from('course').select('id').eq('slug', slug).limit(1);
        if (excludeId) q = q.neq('id', excludeId);
        const { data } = await q;
        if (!data || !data.length) return slug;
        n += 1; slug = `${base}-${n}`;
    }
}

function openCreate() {
    editing.value = { isCreate: true };
    form.value = {
        Title: '', Category: CATEGORIES[0], Decription: '', WhatTeach: '', For: '', folder: null,
        Free: false, Price: 0, old_price: 0, DurationLong: 0, DurationPrice: 0, Buy: true,
    };
    confirmDelete.value = false; formError.value = '';
}
async function openEdit(c) {
    editing.value = c;
    form.value = null; confirmDelete.value = false; formError.value = '';
    // the list rows are lightweight (COLS) and don't carry the long text fields — fetch them fresh
    // so the editor shows the true Category/Decription/WhatTeach/For and can't blank them on save.
    formLoading.value = true;
    try {
        const { data } = await sb.from('course')
            .select('"Title", "Category", "Decription", "WhatTeach", "For", folder, "Free", "Price", old_price, "DurationLong", "DurationPrice", "Buy"')
            .eq('id', c.id).limit(1);
        const full = data?.[0] || {};
        form.value = {
            Title: full.Title ?? c.Title ?? '', Category: full.Category || CATEGORIES[0],
            Decription: full.Decription || '', WhatTeach: full.WhatTeach || '', For: full.For || '', folder: full.folder || null,
            Free: !!full.Free, Price: num(full.Price), old_price: num(full.old_price),
            DurationLong: num(full.DurationLong), DurationPrice: num(full.DurationPrice), Buy: full.Buy !== false,
        };
    } catch (e) {
        formError.value = 'Не удалось загрузить курс.';
        form.value = { Title: c.Title || '', Category: CATEGORIES[0], Decription: '', WhatTeach: '', For: '', folder: c.folder || null,
            Free: !!c.Free, Price: num(c.Price), old_price: num(c.old_price), DurationLong: num(c.DurationLong), DurationPrice: num(c.DurationPrice), Buy: true };
    } finally {
        formLoading.value = false;
    }
}
function closeModal() { editing.value = null; form.value = null; }

async function saveCourse() {
    if (saving.value || !form.value) return;
    const title = form.value.Title.trim();
    if (!title) { formError.value = 'Введите название курса.'; return; }
    saving.value = true; formError.value = '';
    try {
        const isCreate = !!editing.value.isCreate;
        const slug = await uniqueSlug(slugify(title), isCreate ? null : editing.value.id);
        // money normalization: a free course carries no price; a lifetime course carries no renewal price.
        const free = !!form.value.Free;
        const durLong = num(form.value.DurationLong);
        const fields = {
            Title: title,
            Category: form.value.Category,
            Decription: form.value.Decription.trim(),
            WhatTeach: form.value.WhatTeach.trim(),
            For: form.value.For.trim(),
            folder: form.value.folder || null,
            slug,
            Free: free,
            Price: free ? 0 : num(form.value.Price),
            old_price: free ? 0 : num(form.value.old_price),
            DurationLong: free ? 0 : durLong,
            DurationPrice: free || durLong === 0 ? 0 : num(form.value.DurationPrice),
            Buy: free ? false : !!form.value.Buy,
        };
        if (isCreate) {
            // new courses always start as an unpublished draft; moderation is a separate action.
            const { data, error } = await sb.from('course')
                .insert({ ...fields, owner: myId.value, ModStatus: 'Черновик' })
                .select(COLS).limit(1);
            if (error) throw error;
            const row = data?.[0];
            if (row) courses.value = [row, ...courses.value];
            await appendUserCourse(row?.id);
        } else {
            // NB: self-hosted PostgREST rejects UPDATE .select().limit() with no .order() (PGRST109)
            // and rolls the whole mutation back — so no .limit() here (eq('id') already matches one row).
            const { data, error } = await sb.from('course').update(fields).eq('id', editing.value.id).select(COLS);
            if (error) throw error;
            const row = data?.[0];
            if (row) courses.value = courses.value.map((c) => (c.id === row.id ? row : c));
        }
        closeModal();
    } catch (e) {
        formError.value = `Не удалось сохранить: ${e?.message || 'ошибка'}`;
    } finally {
        saving.value = false;
    }
}

// ── moderation (creator side) ────────────────────────────────────────────────
// The creator can submit a course for moderation, withdraw it, or unpublish a live course.
// Only an admin (superadmin) sets «Опубликовано» — the creator never self-publishes.
const statusBusy = ref(false);
function nextStatusAction() {
    if (!editing.value || editing.value.isCreate) return null;
    switch (editing.value.ModStatus) {
        case 'Опубликовано': return { to: 'Снято с публикации', label: 'Снять с публикации', danger: true };
        case 'Отправлено на модерацию': return { to: 'Черновик', label: 'Отозвать с модерации', danger: false };
        default: return { to: 'Отправлено на модерацию', label: 'Отправить на модерацию', danger: false }; // Черновик / Снято / Доработка
    }
}
async function setStatus(to) {
    if (statusBusy.value || !editing.value || editing.value.isCreate) return;
    statusBusy.value = true; formError.value = '';
    try {
        const id = editing.value.id;
        // no .limit() — see the PGRST109 note in saveCourse
        const { data, error } = await sb.from('course').update({ ModStatus: to }).eq('id', id).select(COLS);
        if (error) throw error;
        const row = data?.[0];
        if (row) {
            courses.value = courses.value.map((c) => (c.id === row.id ? row : c));
            editing.value = { ...editing.value, ModStatus: to };
        }
    } catch (e) {
        formError.value = `Не удалось изменить статус: ${e?.message || 'ошибка'}`;
    } finally {
        statusBusy.value = false;
    }
}

async function deleteCourse() {
    if (deleting.value || editing.value?.isCreate) return;
    deleting.value = true; formError.value = '';
    try {
        const id = editing.value.id;
        const { error } = await sb.from('course').delete().eq('id', id);
        if (error) throw error;
        courses.value = courses.value.filter((c) => c.id !== id);
        await removeUserCourse(id);
        closeModal();
    } catch (e) {
        formError.value = `Не удалось удалить: ${e?.message || 'ошибка'}`;
    } finally {
        deleting.value = false; confirmDelete.value = false;
    }
}

// keep the legacy users.courses array in sync (secondary list; the real list is course.owner)
async function appendUserCourse(courseId) {
    if (!courseId) return;
    const { data } = await sb.from('users').select('courses').eq('id', myId.value).limit(1);
    const arr = Array.isArray(data?.[0]?.courses) ? data[0].courses : [];
    if (!arr.includes(courseId)) await sb.from('users').update({ courses: [...arr, courseId] }).eq('id', myId.value);
}
async function removeUserCourse(courseId) {
    const { data } = await sb.from('users').select('courses').eq('id', myId.value).limit(1);
    const arr = Array.isArray(data?.[0]?.courses) ? data[0].courses : [];
    if (arr.includes(courseId)) await sb.from('users').update({ courses: arr.filter((x) => x !== courseId) }).eq('id', myId.value);
}

// ── folders ──────────────────────────────────────────────────────────────────
async function createFolder() {
    const title = newFolder.value.trim();
    if (!title || folderBusy.value) return;
    folderBusy.value = true;
    try {
        const priority = (folders.value.reduce((m, f) => Math.max(m, num(f.priority)), 0)) + 1;
        const { data, error } = await sb.from('course_folders')
            .insert({ title, creator: myId.value, priority }).select('id, title, priority').limit(1);
        if (error) throw error;
        if (data?.[0]) folders.value = [...folders.value, data[0]];
        newFolder.value = '';
    } catch (e) { /* surfaced by the disabled state; keep simple */ }
    finally { folderBusy.value = false; }
}
async function deleteFolder(id) {
    if (folderBusy.value) return;
    folderBusy.value = true;
    try {
        // clear the folder ref on any of this creator's courses first, then drop the folder
        await sb.from('course').update({ folder: null }).eq('folder', id).eq('owner', myId.value);
        const { error } = await sb.from('course_folders').delete().eq('id', id);
        if (error) throw error;
        folders.value = folders.value.filter((f) => f.id !== id);
        courses.value = courses.value.map((c) => (c.folder === id ? { ...c, folder: null } : c));
        if (filter.value === id) filter.value = 'all';
    } catch (e) { /* keep simple */ }
    finally { folderBusy.value = false; }
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

.pd-card--btn { cursor: pointer; text-align: left; font: inherit; color: inherit; }
.pd-card--btn:focus-visible { outline: 2px solid var(--blue-soft); outline-offset: 2px; }
.pd-chip--gear { padding: 7px 10px; color: var(--ink-3); }
.pd-chip--gear .pd-ic { width: 17px; height: 17px; }

/* buttons: danger + ghost variants (primary .pd-btn defined above) */
.pd-btn--ghost { background: var(--surface); color: var(--ink-2); border: 1px solid var(--line); }
.pd-btn--danger { background: var(--red); color: #fff; }
@media (hover: hover) and (pointer: fine) {
    .pd-btn--ghost:not(:disabled):hover { background: var(--bg-tint); color: var(--ink); }
    .pd-btn--danger:not(:disabled):hover { background: #c0002a; transform: translateY(-1px); }
}

/* modal + dialog */
.pd-modal { position: fixed; inset: 0; z-index: 1000; background: rgba(9, 23, 71, 0.42); display: grid; place-items: center; padding: 20px; overflow-y: auto; }
.pd-dialog { position: relative; width: 100%; max-width: 560px; background: var(--surface); border-radius: var(--r-lg); box-shadow: 0 30px 80px -30px rgba(9, 23, 71, 0.5); display: flex; flex-direction: column; max-height: calc(100vh - 40px); }
.pd-dialog--sm { max-width: 420px; }
.pd-dialog__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 22px 14px; border-bottom: 1px solid var(--line); }
.pd-dialog__title { margin: 0; font-weight: 800; font-size: 1.15rem; letter-spacing: -0.02em; }
.pd-x { border: 0; background: none; padding: 4px; cursor: pointer; color: var(--ink-3); border-radius: 8px; }
.pd-x .pd-ic { width: 20px; height: 20px; }
@media (hover: hover) and (pointer: fine) { .pd-x:hover { background: var(--bg-tint); color: var(--ink); } }
.pd-dialog__body { padding: 18px 22px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; }
.pd-dialog__body--load { padding: 48px 22px; text-align: center; color: var(--ink-3); }
.pd-dialog__foot { display: flex; align-items: center; gap: 10px; padding: 14px 22px 20px; border-top: 1px solid var(--line); }
.pd-spacer { flex: 1; }

.pd-field { display: flex; flex-direction: column; gap: 6px; }
.pd-field__lb { font-size: 0.86rem; font-weight: 600; color: var(--ink-2); }
.pd-req { color: var(--red); margin-left: 2px; }
.pd-input { width: 100%; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--surface); padding: 10px 13px; font-family: inherit; font-size: 0.96rem; color: var(--ink); }
.pd-input:focus { outline: none; border-color: var(--blue-soft); box-shadow: 0 0 0 3px var(--blue-tint); }
.pd-input::placeholder { color: var(--ink-3); }
.pd-textarea { resize: vertical; min-height: 62px; line-height: 1.5; }
.pd-select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2398a0ad' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; background-size: 18px; padding-right: 38px; cursor: pointer; }
.pd-seg { display: inline-flex; gap: 4px; background: var(--bg-tint); border-radius: var(--r-md); padding: 4px; }
.pd-seg__b { border: 0; background: none; border-radius: 9px; padding: 8px 16px; font-family: inherit; font-size: 0.9rem; font-weight: 600; color: var(--ink-2); cursor: pointer; transition: background 0.14s var(--ease-out), color 0.14s; }
.pd-seg__b.is-on { background: var(--surface); color: var(--blue-ink); box-shadow: var(--shadow-sm); }
.pd-hint { margin: 0; color: var(--ink-3); font-size: 0.85rem; }

/* moderation block */
.pd-modblock { background: var(--bg-tint); border: 1px solid var(--line); border-radius: var(--r-md); padding: 13px 15px; display: flex; flex-direction: column; gap: 9px; }
.pd-modblock__row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pd-modblock__lb { font-size: 0.86rem; font-weight: 600; color: var(--ink-2); }
.pd-modblock__hint { margin: 0; color: var(--ink-3); font-size: 0.83rem; }
.pd-modblock__note { display: flex; align-items: flex-start; gap: 7px; margin: 0; color: var(--orange); font-size: 0.85rem; line-height: 1.4; }
.pd-modblock__note .pd-ic { width: 15px; height: 15px; flex: none; margin-top: 2px; }
.pd-btn--sm { padding: 7px 14px; font-size: 0.86rem; }
.pd-btn--dangerghost { background: var(--surface); color: var(--red); border: 1px solid #f3c4cd; }
@media (hover: hover) and (pointer: fine) { .pd-btn--dangerghost:not(:disabled):hover { background: var(--red-tint); } }

/* access & price */
.pd-money { display: flex; flex-direction: column; gap: 14px; border-top: 1px solid var(--line); padding-top: 16px; }
.pd-money__h { font-size: 0.92rem; font-weight: 800; letter-spacing: -0.01em; }
.pd-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.pd-opt { font-style: normal; font-weight: 400; color: var(--ink-3); font-size: 0.82rem; }
.pd-check { display: inline-flex; align-items: center; gap: 9px; cursor: pointer; font-size: 0.95rem; font-weight: 600; color: var(--ink); user-select: none; }
.pd-check input { width: 18px; height: 18px; accent-color: var(--blue); cursor: pointer; flex: none; }
.pd-formerr { margin: 0; padding: 10px 22px; background: var(--red-tint); color: var(--red); font-size: 0.88rem; font-weight: 600; border-top: 1px solid var(--line); }

/* delete-confirm overlay (inside the dialog) */
.pd-confirm { position: absolute; inset: 0; background: rgba(255, 255, 255, 0.86); backdrop-filter: blur(2px); border-radius: var(--r-lg); display: grid; place-items: center; padding: 20px; }
.pd-confirm__box { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); box-shadow: 0 20px 50px -24px rgba(9, 23, 71, 0.4); padding: 22px; max-width: 400px; }
.pd-confirm__t { margin: 0 0 6px; font-weight: 800; font-size: 1.02rem; }
.pd-confirm__d { margin: 0 0 16px; color: var(--ink-2); font-size: 0.9rem; line-height: 1.5; }
.pd-confirm__foot { display: flex; justify-content: flex-end; gap: 10px; }

/* folders modal */
.pd-newfolder { display: flex; gap: 8px; }
.pd-newfolder .pd-btn { white-space: nowrap; }
.pd-flist { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.pd-frow { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: var(--bg-tint); border-radius: var(--r-md); padding: 9px 12px; }
.pd-frow__t { display: inline-flex; align-items: center; gap: 8px; font-size: 0.94rem; font-weight: 600; color: var(--ink); }
.pd-frow__t .pd-ic { width: 16px; height: 16px; color: var(--ink-3); }
.pd-frow__t em { color: var(--ink-3); font-style: normal; font-weight: 700; font-size: 0.82rem; }
.pd-frow__del { border: 0; background: none; padding: 5px; cursor: pointer; color: var(--ink-3); border-radius: 7px; }
.pd-frow__del .pd-ic { width: 17px; height: 17px; }
@media (hover: hover) and (pointer: fine) { .pd-frow__del:not(:disabled):hover { background: var(--red-tint); color: var(--red); } }

@media (max-width: 560px) {
    .pd-grid { grid-template-columns: 1fr; }
    .pd-dialog__foot { flex-wrap: wrap; }
}
</style>
