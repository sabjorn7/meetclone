<!--
  ArticlesManagePage.vue — hand-written "Управление статьями" (replaces the WeWeb /articles_manage).
  Phase 1: list the author's articles + create/edit/submit-for-moderation/soft-delete, with a
  hand-written cover upload (fixes the WeWeb file-upload crash: jOe._removeEmptyFolders reading
  .replace of undefined) and a TipTap rich-text editor for the article body. Article PeerTube video
  is Phase 2.

  ACCESS: creator-only surface (same gate as the header nav / CoursesManagePage): role ∈
  {Спикер, Учебное заведение, admin}; guests → /login, non-creators → /.

  Model (public.articles): Title, Content (HTML, rendered by marked on the public ArticlePage),
  Image (cover URL, `profile` bucket — same as course covers), Category, Status (Черновик →
  На модерации → Опубликовано / Отправлено на доработку [+Edit_Comment] / Снято с публикации /
  Удалено[soft]), slug, Creator. Cover upload reuses CoursesManagePage's pattern verbatim
  (crypto.randomUUID key → storage.from('profile').upload) so no filename/path is ever undefined.
-->
<template>
    <main class="pd" ref="rootEl" :class="{ 'is-ready': ready }">
        <!-- ── HERO ───────────────────────────────────────────────── -->
        <header class="pd-hero">
            <div class="pd-wrap pd-hero__row">
                <div>
                    <h1 class="pd-hero__title">Управление статьями</h1>
                    <p class="pd-hero__sub">Создавайте и редактируйте материалы для сообщества. После модерации статья публикуется на сайте.</p>
                </div>
                <button class="pd-btn pd-btn--lg" type="button" @click="createArticle">Создать статью</button>
            </div>
        </header>

        <!-- ── LIST ───────────────────────────────────────────────── -->
        <section class="pd-section">
            <div class="pd-wrap">
                <p v-if="loadError" class="pd-alert pd-alert--err">{{ loadError }}</p>

                <div v-if="!articles.length && ready" class="pd-empty">
                    <p>У вас пока нет статей.</p>
                    <button class="pd-btn" type="button" @click="createArticle">Создать первую</button>
                </div>

                <div v-else class="pd-cards">
                    <article v-for="a in articles" :key="a.id" class="pd-card">
                        <div class="pd-card__cover">
                            <img v-if="a.Image" :src="a.Image" :alt="a.Title" loading="lazy" />
                            <span v-else class="pd-card__cover--none" aria-hidden="true">
                                <svg viewBox="0 0 24 24" class="pd-ic"><path d="M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5"/><circle cx="9" cy="9" r="1.6"/></svg>
                            </span>
                            <span class="pd-badge2" :class="statusClass(a.Status)">{{ a.Status || 'Черновик' }}</span>
                        </div>
                        <div class="pd-card__body">
                            <span v-if="a.Category" class="pd-card__cat">{{ a.Category }}</span>
                            <h3 class="pd-card__t">{{ a.Title || 'Без названия' }}</h3>
                            <p v-if="a.Status === 'Отправлено на доработку' && a.Edit_Comment" class="pd-feedback">
                                <b>Комментарий модератора:</b> {{ a.Edit_Comment }}
                            </p>
                            <div class="pd-card__foot">
                                <button class="pd-btn pd-btn--sm" type="button" @click="openArticle(a)">Редактировать</button>
                                <a v-if="a.slug && a.Status === 'Опубликовано'" class="pd-card__link" :href="`/articles/${a.slug}`" target="_blank" rel="noopener noreferrer">Открыть →</a>
                            </div>
                        </div>
                    </article>
                </div>
            </div>
        </section>

        <!-- ── EDITOR ─────────────────────────────────────────────── -->
        <div v-if="editing" class="pd-overlay" @click.self="closeEditor">
            <div class="pd-dialog" role="dialog" aria-modal="true" aria-label="Редактор статьи">
                <div class="pd-dialog__head">
                    <h2>{{ editing.isCreate ? 'Новая статья' : 'Редактирование статьи' }}</h2>
                    <button class="pd-iconbtn" type="button" aria-label="Закрыть" @click="closeEditor">
                        <svg viewBox="0 0 24 24" class="pd-ic"><path d="M6 6l12 12M18 6L6 18"/></svg>
                    </button>
                </div>

                <div class="pd-dialog__body">
                    <p v-if="!editable" class="pd-alert">Статья на модерации или опубликована — редактирование недоступно. Снимите с публикации/дождитесь ответа модератора.</p>
                    <p v-if="editing.Status === 'Отправлено на доработку' && editing.Edit_Comment" class="pd-feedback pd-feedback--block">
                        <b>Комментарий модератора:</b> {{ editing.Edit_Comment }}
                    </p>

                    <label class="pd-field">
                        <span class="pd-field__lb">Заголовок</span>
                        <input v-model.trim="form.Title" class="pd-input" type="text" maxlength="200" placeholder="Название статьи" :readonly="!editable" />
                    </label>

                    <label class="pd-field">
                        <span class="pd-field__lb">Категория</span>
                        <select v-model="form.Category" class="pd-input" :disabled="!editable">
                            <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
                        </select>
                    </label>

                    <!-- cover -->
                    <div class="pd-field">
                        <span class="pd-field__lb">Обложка</span>
                        <div v-if="form.Image" class="pd-cover">
                            <img :src="form.Image" alt="Обложка статьи" class="pd-cover__img" />
                            <div class="pd-cover__ctl">
                                <label class="pd-btn pd-btn--sm" :class="{ 'is-disabled': coverBusy || !editable }">
                                    {{ coverBusy ? 'Загрузка…' : 'Заменить' }}
                                    <input type="file" accept="image/*" class="pd-hidden-file" :disabled="coverBusy || !editable" @change="onCoverUpload" />
                                </label>
                                <button type="button" class="pd-btn pd-btn--sm pd-btn--dangerghost" :disabled="coverBusy || !editable" @click="removeCover">{{ coverBusy ? 'Удаляем…' : 'Удалить' }}</button>
                            </div>
                        </div>
                        <label v-else class="pd-upload" :class="{ 'is-disabled': coverBusy || !editable }">
                            <svg viewBox="0 0 24 24" class="pd-ic"><path d="M12 15V3m0 0l-4 4m4-4l4 4M5 21h14"/></svg>
                            {{ coverBusy ? 'Загрузка…' : 'Загрузить обложку' }}
                            <input type="file" accept="image/*" class="pd-hidden-file" :disabled="coverBusy || !editable" @change="onCoverUpload" />
                        </label>
                        <p v-if="coverError" class="pd-alert pd-alert--err">{{ coverError }}</p>
                    </div>

                    <!-- content (TipTap) -->
                    <div class="pd-field">
                        <span class="pd-field__lb">Текст статьи</span>
                        <div class="pd-rte" :class="{ 'is-ro': !editable }">
                            <div v-if="editor && editable" class="pd-rte__bar">
                                <button type="button" :class="{ 'is-on': editor.isActive('bold') }" @click="editor.chain().focus().toggleBold().run()" title="Жирный"><b>Ж</b></button>
                                <button type="button" :class="{ 'is-on': editor.isActive('italic') }" @click="editor.chain().focus().toggleItalic().run()" title="Курсив"><i>К</i></button>
                                <button type="button" :class="{ 'is-on': editor.isActive('heading', { level: 2 }) }" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" title="Заголовок">H2</button>
                                <button type="button" :class="{ 'is-on': editor.isActive('heading', { level: 3 }) }" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()" title="Подзаголовок">H3</button>
                                <button type="button" :class="{ 'is-on': editor.isActive('bulletList') }" @click="editor.chain().focus().toggleBulletList().run()" title="Список">•</button>
                                <button type="button" :class="{ 'is-on': editor.isActive('orderedList') }" @click="editor.chain().focus().toggleOrderedList().run()" title="Нумерованный">1.</button>
                                <button type="button" :class="{ 'is-on': editor.isActive('blockquote') }" @click="editor.chain().focus().toggleBlockquote().run()" title="Цитата">"</button>
                                <button type="button" :class="{ 'is-on': editor.isActive('link') }" @click="setLink" title="Ссылка">🔗</button>
                                <label class="pd-rte__img" :class="{ 'is-disabled': imgBusy }" title="Картинка в текст">
                                    🖼
                                    <input type="file" accept="image/*" class="pd-hidden-file" :disabled="imgBusy" @change="onInlineImage" />
                                </label>
                                <button type="button" @click="editor.chain().focus().undo().run()" title="Отменить">↶</button>
                                <button type="button" @click="editor.chain().focus().redo().run()" title="Повторить">↷</button>
                            </div>
                            <EditorContent :editor="editor" class="pd-rte__area" />
                        </div>
                    </div>

                    <p v-if="saveError" class="pd-alert pd-alert--err">{{ saveError }}</p>
                </div>

                <div class="pd-dialog__foot">
                    <button v-if="!editing.isCreate" class="pd-btn pd-btn--dangerghost" type="button" :disabled="busy" @click="confirmDelete">Удалить</button>
                    <span class="pd-spacer"></span>
                    <button class="pd-btn pd-btn--ghost" type="button" :disabled="busy" @click="closeEditor">Закрыть</button>
                    <button v-if="editable" class="pd-btn" type="button" :disabled="busy" @click="save(false)">{{ busy ? 'Сохранение…' : 'Сохранить черновик' }}</button>
                    <button v-if="editable" class="pd-btn pd-btn--primary" type="button" :disabled="busy" @click="save(true)">Отправить на модерацию</button>
                </div>

                <!-- delete confirm -->
                <div v-if="delConfirm" class="pd-overlay pd-overlay--nested" @click.self="delConfirm = false">
                    <div class="pd-dialog pd-dialog--sm" role="dialog" aria-modal="true">
                        <p>Удалить статью «{{ form.Title || 'без названия' }}»? Она пропадёт из списка и с сайта.</p>
                        <div class="pd-dialog__foot">
                            <button class="pd-btn pd-btn--ghost" type="button" :disabled="busy" @click="delConfirm = false">Отмена</button>
                            <button class="pd-btn pd-btn--danger" type="button" :disabled="busy" @click="doDelete">{{ busy ? 'Удаляем…' : 'Удалить' }}</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </main>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { getSupabase, readStoredSession, authCookieUser } from '@/_front/chrome/headerAccount.js';

const CREATORS = ['Спикер', 'Учебное заведение', 'admin'];
const CATEGORIES = ['Общая практика', 'Остеопатия', 'Психология', 'Кинезиология', 'Обзоры PubMed'];
const BUCKET = 'profile';
const STORAGE_URL = 'https://sb.meetgu.ru/storage/v1/object/public/profile//';
const LIST_COLS = 'id, "Title", "Image", "Category", "Status", "Edit_Comment", slug, "Creator", created_at';
// statuses whose content the author may still edit (draft or bounced back for revision)
const EDITABLE = ['Черновик', 'Отправлено на доработку'];

const sb = getSupabase();
const rootEl = ref(null);
const ready = ref(false);
const myId = ref(null);
const articles = ref([]);
const loadError = ref('');

const editing = ref(null);       // the article row being edited (or {isCreate:true})
const form = reactive({ Title: '', Category: CATEGORIES[0], Image: '', Content: '' });
const busy = ref(false);
const saveError = ref('');
const coverBusy = ref(false);
const coverError = ref('');
const imgBusy = ref(false);
const delConfirm = ref(false);

const editable = computed(() => !!editing.value && (editing.value.isCreate || EDITABLE.includes(editing.value.Status)));

// ── TipTap editor (one instance; content swapped per article) ──────────────
const editor = useEditor({
    extensions: [
        StarterKit,
        Link.configure({ openOnClick: false, autolink: true }),
        Image.configure({ inline: false }),
    ],
    content: '',
    editable: true,
});

function statusClass(s) {
    return {
        'is-draft': s === 'Черновик' || !s,
        'is-mod': s === 'На модерации',
        'is-pub': s === 'Опубликовано',
        'is-fix': s === 'Отправлено на доработку',
        'is-off': s === 'Снято с публикации' || s === 'Удалено',
    };
}

// ── slug (Cyrillic → url-safe latin), mirrors the site's article slugs ──────
const TR = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };
function slugify(str) {
    return (str || '').toLowerCase().split('').map((ch) => (TR[ch] !== undefined ? TR[ch] : ch)).join('')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'article';
}
async function uniqueSlug(base, excludeId) {
    let slug = base, n = 1;
    for (let i = 0; i < 50; i++) {
        let q = sb.from('articles').select('id').eq('slug', slug).limit(1);
        if (excludeId) q = q.neq('id', excludeId);
        const { data } = await q;
        if (!data || !data.length) return slug;
        n += 1; slug = `${base}-${n}`;
    }
    return `${base}-${Date.now()}`;
}

// ── data ────────────────────────────────────────────────────────────────────
async function loadList() {
    const { data, error } = await sb.from('articles').select(LIST_COLS)
        .eq('Creator', myId.value).neq('Status', 'Удалено').order('created_at', { ascending: false });
    if (error) { loadError.value = 'Не удалось загрузить статьи.'; return; }
    articles.value = data || [];
}

function openArticle(a) {
    editing.value = { ...a };
    form.Title = a.Title || '';
    form.Category = CATEGORIES.includes(a.Category) ? a.Category : CATEGORIES[0];
    form.Image = a.Image || '';
    form.Content = a.Content || '';
    saveError.value = ''; coverError.value = '';
    // load the full Content (list query omits it), then set the editor
    loadContent(a.id);
}
async function loadContent(id) {
    const { data } = await sb.from('articles').select('Content').eq('id', id).limit(1);
    const html = data?.[0]?.Content || '';
    form.Content = html;
    editor.value?.commands.setContent(html || '<p></p>');
    editor.value?.setEditable(editable.value);
}

async function createArticle() {
    if (busy.value) return;
    busy.value = true; saveError.value = '';
    try {
        const { data, error } = await sb.from('articles')
            .insert({ Title: '', Content: '', Image: '', Category: CATEGORIES[0], Status: 'Черновик', Creator: myId.value })
            .select(LIST_COLS).limit(1);
        if (error) throw error;
        const row = data?.[0];
        if (!row) throw new Error('no row');
        // keep users.articles in sync (legacy consumers read it)
        appendToUserArticles(row.id);
        articles.value = [row, ...articles.value];
        openArticle(row);
    } catch (e) { saveError.value = 'Не удалось создать статью.'; }
    finally { busy.value = false; }
}

async function appendToUserArticles(articleId) {
    try {
        const { data } = await sb.from('users').select('articles').eq('id', myId.value).limit(1);
        const arr = Array.isArray(data?.[0]?.articles) ? data[0].articles : [];
        if (!arr.includes(articleId)) await sb.from('users').update({ articles: [...arr, articleId] }).eq('id', myId.value);
    } catch (_) { /* non-fatal */ }
}

async function save(submit) {
    if (busy.value || !editable.value) return;
    if (!form.Title.trim()) { saveError.value = 'Укажите заголовок.'; return; }
    busy.value = true; saveError.value = '';
    try {
        const html = editor.value ? editor.value.getHTML() : form.Content;
        const patch = { Title: form.Title.trim(), Content: html, Category: form.Category };
        // ensure a stable slug (generate once when empty)
        if (!editing.value.slug) patch.slug = await uniqueSlug(slugify(form.Title), editing.value.id);
        if (submit) patch.Status = 'На модерации';
        const { error } = await sb.from('articles').update(patch).eq('id', editing.value.id);
        if (error) throw error;
        Object.assign(editing.value, patch);
        patchListRow(editing.value.id, { Title: patch.Title, Category: patch.Category, slug: patch.slug ?? editing.value.slug, Status: patch.Status ?? editing.value.Status, Image: form.Image });
        if (submit) { closeEditor(); }
        else { editor.value?.setEditable(editable.value); }
    } catch (e) { saveError.value = 'Не удалось сохранить.'; }
    finally { busy.value = false; }
}

function patchListRow(id, patch) {
    articles.value = articles.value.map((a) => (a.id === id ? { ...a, ...patch } : a));
}

function confirmDelete() { delConfirm.value = true; }
async function doDelete() {
    if (busy.value) return;
    busy.value = true;
    try {
        const { error } = await sb.from('articles').update({ Status: 'Удалено' }).eq('id', editing.value.id);
        if (error) throw error;
        articles.value = articles.value.filter((a) => a.id !== editing.value.id);
        delConfirm.value = false; closeEditor();
    } catch (e) { saveError.value = 'Не удалось удалить.'; busy.value = false; return; }
    busy.value = false;
}

function closeEditor() { editing.value = null; delConfirm.value = false; }

// ── cover upload (hand-written — fixes the WeWeb crash) ─────────────────────
async function onCoverUpload(e) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || !editing.value || coverBusy.value || !editable.value) return;
    coverBusy.value = true; coverError.value = '';
    try {
        if (form.Image) { try { await sb.storage.from(BUCKET).remove([form.Image.split('/').pop()]); } catch (_) { /* ignore */ } }
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const key = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await sb.storage.from(BUCKET).upload(key, file, { upsert: false });
        if (upErr) throw upErr;
        const url = STORAGE_URL + key;
        const { error } = await sb.from('articles').update({ Image: url }).eq('id', editing.value.id);
        if (error) throw error;
        form.Image = url;
        patchListRow(editing.value.id, { Image: url });
    } catch (e2) { coverError.value = 'Не удалось загрузить обложку.'; }
    finally { coverBusy.value = false; }
}
async function removeCover() {
    if (!editing.value || coverBusy.value || !form.Image || !editable.value) return;
    coverBusy.value = true; coverError.value = '';
    try {
        try { await sb.storage.from(BUCKET).remove([form.Image.split('/').pop()]); } catch (_) { /* ignore */ }
        const { error } = await sb.from('articles').update({ Image: null }).eq('id', editing.value.id);
        if (error) throw error;
        form.Image = '';
        patchListRow(editing.value.id, { Image: '' });
    } catch (e) { coverError.value = 'Не удалось удалить обложку.'; }
    finally { coverBusy.value = false; }
}

// ── inline image in the article body ────────────────────────────────────────
async function onInlineImage(e) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || imgBusy.value || !editor.value) return;
    imgBusy.value = true;
    try {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const key = `${crypto.randomUUID()}.${ext}`;
        const { error } = await sb.storage.from(BUCKET).upload(key, file, { upsert: false });
        if (error) throw error;
        editor.value.chain().focus().setImage({ src: STORAGE_URL + key }).run();
    } catch (_) { coverError.value = 'Не удалось вставить картинку.'; }
    finally { imgBusy.value = false; }
}

function setLink() {
    if (!editor.value) return;
    const prev = editor.value.getAttributes('link').href || '';
    const url = window.prompt('Ссылка (URL):', prev);
    if (url === null) return;
    if (url === '') { editor.value.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor.value.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
}

// ── mount: access gate ──────────────────────────────────────────────────────
onMounted(async () => {
    if (!sb) { window.location.href = '/'; return; }
    myId.value = readStoredSession()?.user?.id || authCookieUser()?.id || null;
    if (!myId.value) { window.location.href = '/login'; return; }
    const { data } = await sb.from('users').select('role').eq('id', myId.value).limit(1);
    const me = data?.[0];
    if (!me || !CREATORS.includes(me.role)) { window.location.href = '/'; return; }
    await loadList();
    ready.value = true;
});
onBeforeUnmount(() => { editor.value?.destroy(); });
</script>

<style scoped>
.pd {
    --bg: #ffffff; --bg-tint: #f1f6fd; --surface: #ffffff; --ink: #091747; --ink-2: #5b6472; --ink-3: #98a0ad; --line: #e4e9f1;
    --blue: #2e70dd; --blue-soft: #5495f3; --blue-strong: #2360c6; --blue-ink: #1f5fc9; --blue-tint: #eaf1fe;
    --orange: #f09157; --danger: #dc2626; --ok: #16a34a; --mod: #d97706;
    --r-lg: 26px; --r-md: 16px; --r-pill: 999px; --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --shadow: 0 14px 40px -20px rgba(9, 23, 71, 0.24); --shadow-sm: 0 4px 16px -8px rgba(9, 23, 71, 0.18); --wrap: 1100px;
    background: var(--bg); color: var(--ink); font-family: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 16px; line-height: 1.5; -webkit-font-smoothing: antialiased; min-height: 60vh;
}
.pd *, .pd *::before, .pd *::after { box-sizing: border-box; }
.pd-wrap { width: 100%; max-width: var(--wrap); margin-inline: auto; padding-inline: 32px; }
.pd-section { padding: 8px 0 80px; }

.pd-hero { padding: 40px 0 28px; }
.pd-hero__row { display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
.pd-hero__title { margin: 0; font-weight: 700; font-size: clamp(1.7rem, 4vw, 2.6rem); letter-spacing: -0.02em; }
.pd-hero__sub { margin: 8px 0 0; color: var(--ink-2); max-width: 60ch; }

.pd-btn { font-family: inherit; font-weight: 600; font-size: 15px; color: var(--ink); background: #fff; border: 1px solid var(--line); border-radius: var(--r-pill); padding: 11px 20px; cursor: pointer; transition: background 0.16s var(--ease-out), border-color 0.16s var(--ease-out), transform 0.12s var(--ease-out); display: inline-flex; align-items: center; gap: 8px; text-decoration: none; }
.pd-btn:active { transform: translateY(1px); }
@media (hover: hover) { .pd-btn:hover { border-color: var(--blue-soft); } }
.pd-btn--lg { padding: 14px 26px; font-size: 16px; }
.pd-btn--sm { padding: 8px 14px; font-size: 13px; }
.pd-btn--primary, .pd-btn--danger { color: #fff; border-color: transparent; }
.pd-btn--primary { background: var(--blue); } .pd-btn--primary:hover { background: var(--blue-strong); }
.pd-btn--danger { background: var(--danger); }
.pd-btn--ghost { background: none; border-color: transparent; color: var(--ink-2); }
.pd-btn--dangerghost { background: none; border-color: var(--line); color: var(--danger); }
.pd-btn:disabled, .pd-btn.is-disabled { opacity: 0.55; cursor: default; pointer-events: none; }
.pd-iconbtn { display: grid; place-items: center; width: 38px; height: 38px; border: none; background: none; border-radius: 50%; cursor: pointer; color: var(--ink-2); }
.pd-iconbtn:hover { background: var(--bg-tint); }
.pd-ic { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.pd-spacer { flex: 1; }

.pd-empty { text-align: center; padding: 60px 0; color: var(--ink-2); display: grid; gap: 16px; justify-items: center; }
.pd-alert { margin: 0 0 14px; padding: 12px 16px; border-radius: var(--r-md); background: var(--bg-tint); color: var(--ink-2); font-size: 0.94rem; }
.pd-alert--err { background: #fef2f2; color: var(--danger); }

/* cards */
.pd-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 22px; }
.pd-card { background: #fff; border: 1px solid var(--line); border-radius: var(--r-lg); overflow: hidden; display: flex; flex-direction: column; }
.pd-card__cover { position: relative; aspect-ratio: 16/9; background: var(--bg-tint); }
.pd-card__cover img { width: 100%; height: 100%; object-fit: cover; }
.pd-card__cover--none { position: absolute; inset: 0; display: grid; place-items: center; color: var(--ink-3); }
.pd-card__cover--none .pd-ic { width: 40px; height: 40px; }
.pd-badge2 { position: absolute; top: 10px; left: 10px; padding: 4px 11px; border-radius: var(--r-pill); font-size: 12px; font-weight: 700; background: #fff; box-shadow: var(--shadow-sm); }
.pd-badge2.is-draft { color: var(--ink-2); } .pd-badge2.is-mod { color: var(--mod); } .pd-badge2.is-pub { color: var(--ok); } .pd-badge2.is-fix { color: var(--orange); } .pd-badge2.is-off { color: var(--ink-3); }
.pd-card__body { padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
.pd-card__cat { font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--blue-ink); }
.pd-card__t { margin: 0; font-weight: 700; font-size: 1.1rem; line-height: 1.25; }
.pd-feedback { margin: 0; font-size: 0.88rem; color: var(--orange); background: #fff7ed; border-radius: 12px; padding: 8px 12px; }
.pd-feedback--block { margin-bottom: 14px; }
.pd-card__foot { margin-top: auto; padding-top: 8px; display: flex; align-items: center; gap: 14px; }
.pd-card__link { color: var(--blue-ink); text-decoration: none; font-weight: 600; font-size: 0.9rem; }

/* overlay / dialog */
.pd-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(9, 23, 71, 0.45); display: grid; place-items: center; padding: 20px; overflow-y: auto; }
.pd-overlay--nested { z-index: 210; background: rgba(9, 23, 71, 0.35); }
.pd-dialog { width: 100%; max-width: 760px; background: #fff; border-radius: var(--r-lg); box-shadow: var(--shadow); display: flex; flex-direction: column; max-height: calc(100vh - 40px); }
.pd-dialog--sm { max-width: 420px; padding: 24px; gap: 16px; }
.pd-dialog__head { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--line); }
.pd-dialog__head h2 { margin: 0; font-size: 1.2rem; font-weight: 700; }
.pd-dialog__body { padding: 22px 24px; overflow-y: auto; display: grid; gap: 18px; }
.pd-dialog__foot { display: flex; align-items: center; gap: 12px; padding: 16px 24px; border-top: 1px solid var(--line); flex-wrap: wrap; }

.pd-field { display: grid; gap: 7px; }
.pd-field__lb { font-weight: 600; font-size: 0.9rem; color: var(--ink-2); }
.pd-input { font-family: inherit; font-size: 1rem; color: var(--ink); background: #fff; border: 1px solid var(--line); border-radius: var(--r-md); padding: 12px 14px; }
.pd-input:focus { outline: none; border-color: var(--blue-soft); box-shadow: 0 0 0 3px rgba(84, 149, 243, 0.18); }
.pd-hidden-file { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

.pd-cover { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
.pd-cover__img { width: 220px; aspect-ratio: 16/9; object-fit: cover; border-radius: var(--r-md); border: 1px solid var(--line); }
.pd-cover__ctl { display: flex; gap: 10px; flex-wrap: wrap; }
.pd-upload { display: inline-flex; align-items: center; gap: 10px; padding: 14px 20px; border: 1px dashed var(--line); border-radius: var(--r-md); color: var(--ink-2); cursor: pointer; font-weight: 600; width: fit-content; }
.pd-upload:hover { border-color: var(--blue-soft); color: var(--blue-ink); }

/* TipTap RTE */
.pd-rte { border: 1px solid var(--line); border-radius: var(--r-md); overflow: hidden; }
.pd-rte.is-ro { opacity: 0.75; }
.pd-rte__bar { display: flex; flex-wrap: wrap; gap: 2px; padding: 8px; border-bottom: 1px solid var(--line); background: var(--bg-tint); }
.pd-rte__bar button, .pd-rte__img { min-width: 32px; height: 32px; display: inline-grid; place-items: center; border: none; background: none; border-radius: 8px; cursor: pointer; font-size: 14px; color: var(--ink); padding: 0 7px; }
.pd-rte__bar button:hover, .pd-rte__img:hover { background: #fff; }
.pd-rte__bar button.is-on { background: var(--blue); color: #fff; }
.pd-rte__img.is-disabled { opacity: 0.5; pointer-events: none; }
.pd-rte__area { padding: 4px 14px; max-height: 46vh; overflow-y: auto; }
.pd-rte__area :deep(.ProseMirror) { outline: none; min-height: 180px; line-height: 1.6; }
.pd-rte__area :deep(.ProseMirror h2) { font-size: 1.4rem; margin: 1em 0 0.4em; }
.pd-rte__area :deep(.ProseMirror h3) { font-size: 1.15rem; margin: 1em 0 0.4em; }
.pd-rte__area :deep(.ProseMirror p) { margin: 0.6em 0; }
.pd-rte__area :deep(.ProseMirror img) { max-width: 100%; border-radius: 10px; }
.pd-rte__area :deep(.ProseMirror blockquote) { border-left: 3px solid var(--blue-soft); padding-left: 14px; color: var(--ink-2); margin: 0.8em 0; }
.pd-rte__area :deep(.ProseMirror a) { color: var(--blue-ink); }
.pd-rte__area :deep(.ProseMirror-focused) { outline: none; }

@media (max-width: 700px) {
    .pd-wrap { padding-inline: 18px; }
    .pd-cover__img { width: 100%; }
}
</style>
