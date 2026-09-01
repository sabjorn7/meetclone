<!--
  ProfileEditPage.vue — "/profile" (account settings) in the MeetGuru promo (pd-*) brand language. Demo at
  /profile-edit-demo; the live WeWeb /profile is untouched until go-live. Gets the shared AppHeader/AppFooter.

  Faithful hand-written override of the WeWeb account-edit page (verified against its config):
    - photo upload → bucket `profile`, key `<uuid>.<ext>`, Photo = https://sb.meetgu.ru/storage/v1/object/public/profile//<key>;
      re-upload deletes the old object; red trash deletes the photo (no confirm).
    - one "Сохранить" UPDATE of Name/role/Description/username/city/socials, with username format + taken
      validation and required Name. role: «Специалист» is stored as «Ученик».
    - privacy checkboxes toggle users.hide.{buy,my} and users.send_notif immediately.
    - change password via supabaseAuth.updateUserPassword (verifies the old one).
    - «Мои подписки / Мои подписчики» (subscriptions table) inline. «Моя страница» → /profile_page?user=me.
      «Выйти» → signOut → /login. (The WeWeb email-change block was a no-op; intentionally omitted.)
-->
<template>
    <main class="pd" :class="{ 'is-ready': ready }">
        <div v-if="loading" class="pd-wrap pd-load">Загрузка…</div>
        <div v-else-if="!uid" class="pd-wrap pd-load">
            <p>Войдите, чтобы редактировать профиль.</p>
            <a href="/login" class="pd-btn">Войти</a>
        </div>

        <section v-else class="pd-section">
            <div class="pd-wrap">
                <!-- ── Identity card ─────────────────────────────── -->
                <div class="pd-idcard" data-reveal>
                    <div class="pd-ava">
                        <img v-if="user.Photo" :src="user.Photo" :alt="user.Name" class="pd-ava__img" />
                        <span v-else class="pd-ava__img pd-ava__img--i">{{ initials(user.Name) }}</span>
                        <button type="button" class="pd-ava__edit" :disabled="photoBusy" @click="pickPhoto" aria-label="Изменить фото">
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M4 7h3l2-2h6l2 2h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg>
                        </button>
                        <button v-if="user.Photo" type="button" class="pd-ava__del" :disabled="photoBusy" @click="deletePhoto" aria-label="Удалить фото">
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7"/></svg>
                        </button>
                        <input ref="fileEl" type="file" accept="image/*" hidden @change="onPhoto" />
                    </div>
                    <div class="pd-idcard__body">
                        <h1 class="pd-idcard__name">{{ user.Name || 'Профиль' }}</h1>
                        <p class="pd-idcard__email">{{ user.email }}</p>
                        <div class="pd-idcard__links">
                            <a :href="`/profile_page?user=${uid}`" class="pd-link">Моя страница →</a>
                            <button type="button" class="pd-link pd-link--muted" @click="logout">Выйти</button>
                        </div>
                    </div>
                </div>

                <!-- ── Account data ──────────────────────────────── -->
                <div class="pd-card" data-reveal>
                    <h2 class="pd-card__title">Учётные данные</h2>
                    <div class="pd-grid2">
                        <div class="pd-field">
                            <span class="pd-field__label">Вид аккаунта</span>
                            <select v-model="roleSel" class="pd-input pd-select">
                                <option v-for="r in ROLES" :key="r" :value="r">{{ r }}</option>
                            </select>
                            <span class="pd-field__help">Влияет на набор функций и возможностей.</span>
                        </div>
                        <div class="pd-field">
                            <span class="pd-field__label">Имя / название</span>
                            <input v-model="f.Name" class="pd-input" placeholder="Имя пользователя" @input="clearErr" />
                            <span class="pd-field__help">Его увидят все пользователи площадки.</span>
                        </div>
                        <div class="pd-field">
                            <span class="pd-field__label">Username</span>
                            <input v-model="f.username" class="pd-input" placeholder="username (необязательно)" @input="clearErr" />
                            <span class="pd-field__help">Латиница, цифры, дефис, подчёркивание, 3–20 символов. Даёт короткую ссылку на профиль.</span>
                        </div>
                        <div class="pd-field">
                            <span class="pd-field__label">Город</span>
                            <input v-model="f.city" class="pd-input" placeholder="Город" />
                            <span class="pd-field__help">Появится в профиле и в фильтре каталога специалистов.</span>
                        </div>
                        <div class="pd-field pd-field--full">
                            <span class="pd-field__label">О себе</span>
                            <textarea v-model="f.Description" class="pd-input pd-textarea" rows="5" placeholder="Расскажите о себе"></textarea>
                        </div>
                        <div class="pd-field"><span class="pd-field__label">ВКонтакте</span><input v-model="f.vk_url" class="pd-input" placeholder="Ссылка на VK" /></div>
                        <div class="pd-field"><span class="pd-field__label">YouTube</span><input v-model="f.youtube_url" class="pd-input" placeholder="Ссылка на YouTube" /></div>
                        <div class="pd-field"><span class="pd-field__label">WhatsApp</span><input v-model="f.whatsapp_url" class="pd-input" placeholder="Ссылка на WhatsApp" /></div>
                        <div class="pd-field"><span class="pd-field__label">Telegram</span><input v-model="f.telegram_url" class="pd-input" placeholder="Ссылка на Telegram" /></div>
                        <div class="pd-field"><span class="pd-field__label">Сайт</span><input v-model="f.website_url" class="pd-input" placeholder="Ссылка на сайт" /></div>
                        <div class="pd-field"><span class="pd-field__label">Запись к специалисту</span><input v-model="f.booking_url" class="pd-input" placeholder="Ссылка на запись" /></div>
                    </div>
                    <div class="pd-card__foot">
                        <button class="pd-btn" type="button" :disabled="saving" @click="save">{{ saving ? 'Сохранение…' : 'Сохранить' }}</button>
                        <span v-if="err" class="pd-msg pd-msg--err">{{ err }}</span>
                        <span v-else-if="saved" class="pd-msg pd-msg--ok">Сохранено ✓</span>
                    </div>
                </div>

                <!-- ── Privacy ───────────────────────────────────── -->
                <div class="pd-card" data-reveal>
                    <h2 class="pd-card__title">Настройки приватности</h2>
                    <label class="pd-check"><input type="checkbox" v-model="hideBuy" @change="toggleHide('buy', hideBuy)" /> <span>Скрыть пройденные курсы в публичном профиле</span></label>
                    <label class="pd-check"><input type="checkbox" v-model="hideMy" @change="toggleHide('my', hideMy)" /> <span>Скрыть созданные курсы в публичном профиле</span></label>
                    <label class="pd-check"><input type="checkbox" v-model="sendNotif" @change="toggleNotif" /> <span>Получать уведомления о новых сообщениях на почту</span></label>
                </div>

                <!-- ── Password ──────────────────────────────────── -->
                <div class="pd-card" data-reveal>
                    <h2 class="pd-card__title">Смена пароля</h2>
                    <form class="pd-grid2" @submit.prevent="changePw">
                        <div class="pd-field"><span class="pd-field__label">Старый пароль</span><input v-model="pwOld" type="password" class="pd-input" autocomplete="current-password" placeholder="Старый пароль" /></div>
                        <div class="pd-field"><span class="pd-field__label">Новый пароль</span><input v-model="pwNew" type="password" class="pd-input" autocomplete="new-password" placeholder="Новый пароль" /></div>
                        <div class="pd-field pd-field--full pd-card__foot">
                            <button class="pd-btn pd-btn--ghost" type="submit" :disabled="pwBusy || !pwOld || !pwNew">{{ pwBusy ? 'Меняем…' : 'Изменить пароль' }}</button>
                            <span v-if="pwMsg" class="pd-msg" :class="pwOk ? 'pd-msg--ok' : 'pd-msg--err'">{{ pwMsg }}</span>
                        </div>
                    </form>
                </div>

                <!-- ── Subscriptions ─────────────────────────────── -->
                <div class="pd-card" data-reveal>
                    <div class="pd-subs">
                        <div class="pd-subs__col">
                            <button type="button" class="pd-subs__head" @click="openSubs.following = !openSubs.following">
                                <b>Мои подписки</b> <span class="pd-subs__n">({{ following.length }})</span>
                                <span class="pd-subs__chev">{{ openSubs.following ? 'Скрыть ▲' : 'Показать ▼' }}</span>
                            </button>
                            <div v-if="openSubs.following" class="pd-subs__list">
                                <a v-for="u in following" :key="u.id" :href="`/profile_page?user=${u.id}`" class="pd-subs__item">
                                    <img v-if="u.Photo" :src="u.Photo" :alt="u.Name" /><span v-else class="pd-subs__i">{{ initials(u.Name) }}</span>
                                    <span class="pd-subs__name">{{ u.Name || 'Без имени' }}</span>
                                </a>
                                <p v-if="!following.length" class="pd-subs__empty">Вы пока ни на кого не подписаны.</p>
                            </div>
                        </div>
                        <div class="pd-subs__col">
                            <button type="button" class="pd-subs__head" @click="openSubs.followers = !openSubs.followers">
                                <b>Мои подписчики</b> <span class="pd-subs__n">({{ followers.length }})</span>
                                <span class="pd-subs__chev">{{ openSubs.followers ? 'Скрыть ▲' : 'Показать ▼' }}</span>
                            </button>
                            <div v-if="openSubs.followers" class="pd-subs__list">
                                <a v-for="u in followers" :key="u.id" :href="`/profile_page?user=${u.id}`" class="pd-subs__item">
                                    <img v-if="u.Photo" :src="u.Photo" :alt="u.Name" /><span v-else class="pd-subs__i">{{ initials(u.Name) }}</span>
                                    <span class="pd-subs__name">{{ u.Name || 'Без имени' }}</span>
                                </a>
                                <p v-if="!followers.length" class="pd-subs__empty">У вас пока нет подписчиков.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ── Blocked users (unblock) ───────────────────── -->
                <div v-if="blocked.length" class="pd-card" data-reveal>
                    <div class="pd-blk">
                        <div class="pd-blk__head"><b>Заблокированные</b> <span class="pd-subs__n">({{ blocked.length }})</span></div>
                        <p class="pd-blk__hint">Вы не видите сообщения и комментарии этих пользователей.</p>
                        <div class="pd-blk__list">
                            <div v-for="u in blocked" :key="u.id" class="pd-blk__item">
                                <img v-if="u.Photo" :src="u.Photo" :alt="u.Name" /><span v-else class="pd-subs__i">{{ initials(u.Name) }}</span>
                                <span class="pd-subs__name">{{ u.Name || 'Без имени' }}</span>
                                <button type="button" class="pd-blk__unblock" @click="unblock(u.id)">Разблокировать</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </main>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue';
import { getSupabase, readStoredSession, authCookieUser } from '@/_front/chrome/headerAccount.js';
import { listBlockedUserIds, unblockUser } from '@/_front/moderation/moderationApi.js';

const STORAGE_URL = 'https://sb.meetgu.ru/storage/v1/object/public/profile//';
const BUCKET = 'profile';
const ROLES = ['Специалист', 'Спикер', 'Учебное заведение'];
const COLS = 'id, "Name", "Photo", role, "Description", username, city, email, vk_url, youtube_url, whatsapp_url, telegram_url, website_url, booking_url, send_notif, hide';

let sb = null;
const uid = ref(null);
const loading = ref(true);
const ready = ref(false);
const user = reactive({});
const fileEl = ref(null);

const f = reactive({ Name: '', username: '', city: '', Description: '', vk_url: '', youtube_url: '', whatsapp_url: '', telegram_url: '', website_url: '', booking_url: '' });
const roleSel = ref('Специалист');
const saving = ref(false);
const err = ref('');
const saved = ref(false);
const photoBusy = ref(false);

const hideBuy = ref(false);
const hideMy = ref(false);
const sendNotif = ref(false);

const pwOld = ref('');
const pwNew = ref('');
const pwBusy = ref(false);
const pwMsg = ref('');
const pwOk = ref(false);

const following = ref([]);
const followers = ref([]);
const blocked = ref([]);   // users this user has blocked (UGC moderation, Apple 1.2) — with unblock
const openSubs = reactive({ following: false, followers: false });

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;

function initials(name) {
    const p = (name || '').split(/\s+/).filter(Boolean);
    return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '·';
}
function clearErr() { err.value = ''; }

async function load() {
    sb = getSupabase();
    uid.value = readStoredSession()?.user?.id || authCookieUser()?.id || null;
    if (!sb || !uid.value) { loading.value = false; return; }

    const { data } = await sb.from('users').select(COLS).eq('id', uid.value).limit(1);
    const row = data?.[0];
    if (row) {
        Object.assign(user, row);
        for (const k of Object.keys(f)) f[k] = row[k] || '';
        roleSel.value = row.role === 'Ученик' ? 'Специалист' : (ROLES.includes(row.role) ? row.role : 'Специалист');
        sendNotif.value = !!row.send_notif;
        hideBuy.value = !!(row.hide && row.hide.buy);
        hideMy.value = !!(row.hide && row.hide.my);
    }
    loadSubs();
    loading.value = false;
    await nextTick();
    ready.value = true;
}

async function loadSubs() {
    const [{ data: subs }, { data: fol }] = await Promise.all([
        sb.from('subscriptions').select('target').eq('subscriber', uid.value).order('created_at', { ascending: false }),
        sb.from('subscriptions').select('subscriber').eq('target', uid.value).order('created_at', { ascending: false }),
    ]);
    following.value = await usersByIds((subs || []).map((r) => r.target));
    followers.value = await usersByIds((fol || []).map((r) => r.subscriber));
    try { blocked.value = await usersByIds(await listBlockedUserIds(uid.value)); } catch (e) { /* non-fatal */ }
}
async function unblock(id) {
    try {
        await unblockUser(uid.value, id);
        blocked.value = blocked.value.filter((u) => u.id !== id);
    } catch (e) { /* keep row on failure */ }
}
async function usersByIds(ids) {
    const uniq = [...new Set(ids.filter(Boolean))];
    if (!uniq.length) return [];
    const { data } = await sb.from('users').select('id, "Name", "Photo"').in('id', uniq);
    const byId = new Map((data || []).map((u) => [u.id, u]));
    return uniq.map((id) => byId.get(id)).filter(Boolean);
}

/* ── save account data (one UPDATE, mirrors the WeWeb validation) ────────── */
async function save() {
    err.value = ''; saved.value = false;
    const username = f.username.trim();
    if (username && !USERNAME_RE.test(username)) { err.value = 'Только латиница, цифры, дефис и подчёркивание, 3–20 символов'; return; }
    if (!f.Name.trim()) { err.value = 'Заполните имя пользователя'; return; }
    saving.value = true;
    try {
        if (username && username !== (user.username || '')) {
            const { data: taken } = await sb.from('users').select('id').ilike('username', username).neq('id', uid.value).limit(1);
            if (taken && taken.length) { err.value = 'Этот username уже занят'; saving.value = false; return; }
        }
        const role = roleSel.value === 'Специалист' ? 'Ученик' : roleSel.value;
        const patch = {
            Name: f.Name.trim(), role, Description: f.Description, username: username || null, city: f.city.trim() || null,
            vk_url: f.vk_url, youtube_url: f.youtube_url, whatsapp_url: f.whatsapp_url, telegram_url: f.telegram_url,
            website_url: f.website_url, booking_url: f.booking_url,
        };
        const { error } = await sb.from('users').update(patch).eq('id', uid.value);
        if (error) throw error;
        Object.assign(user, patch);
        saved.value = true; setTimeout(() => { saved.value = false; }, 2500);
    } catch (e) { err.value = 'Не удалось сохранить. Попробуйте ещё раз.'; } finally { saving.value = false; }
}

/* ── photo ──────────────────────────────────────────────────────────────── */
function pickPhoto() { fileEl.value?.click(); }
async function onPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    photoBusy.value = true;
    try {
        if (user.Photo) { try { await sb.storage.from(BUCKET).remove([user.Photo.split('/').pop()]); } catch (_) { /* ignore */ } }
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const key = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await sb.storage.from(BUCKET).upload(key, file, { upsert: false });
        if (upErr) throw upErr;
        const url = STORAGE_URL + key;
        await sb.from('users').update({ Photo: url }).eq('id', uid.value);
        user.Photo = url;
    } catch (e2) { err.value = 'Не удалось загрузить фото.'; } finally { photoBusy.value = false; }
}
async function deletePhoto() {
    if (!user.Photo) return;
    photoBusy.value = true;
    try {
        try { await sb.storage.from(BUCKET).remove([user.Photo.split('/').pop()]); } catch (_) { /* ignore */ }
        await sb.from('users').update({ Photo: null }).eq('id', uid.value);
        user.Photo = null;
    } finally { photoBusy.value = false; }
}

/* ── privacy toggles (immediate) ────────────────────────────────────────── */
async function toggleNotif() {
    await sb.from('users').update({ send_notif: sendNotif.value }).eq('id', uid.value);
    user.send_notif = sendNotif.value;
}
async function toggleHide(key, val) {
    const hide = { ...(user.hide || {}), [key]: val };
    await sb.from('users').update({ hide }).eq('id', uid.value);
    user.hide = hide;
}

/* ── password ───────────────────────────────────────────────────────────── */
async function changePw() {
    if (!pwOld.value || !pwNew.value || pwBusy.value) return;
    pwBusy.value = true; pwMsg.value = '';
    try {
        await window.wwLib.wwPlugins.supabaseAuth.updateUserPassword({ oldPassword: pwOld.value, newPassword: pwNew.value });
        pwOk.value = true; pwMsg.value = 'Пароль изменён';
        pwOld.value = ''; pwNew.value = '';
    } catch (e) {
        pwOk.value = false;
        pwMsg.value = /Invalid login|credentials/i.test(e?.message || '') ? 'Неверный старый пароль' : 'Не удалось изменить пароль';
    } finally { pwBusy.value = false; }
}

function logout() {
    try { window.wwLib.wwPlugins.supabaseAuth.signOut(); } catch (e) { /* ignore */ }
    window.location.href = '/login';
}

onMounted(() => { ensureFonts(); document.title = 'Профиль — МитГуру'; load(); });

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
    --green: #157a38; --red: #de0030;
    --r-lg: 22px; --r-md: 12px; --r-pill: 999px;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --shadow-sm: 0 4px 16px -8px rgba(9, 23, 71, 0.18); --shadow: 0 18px 44px -26px rgba(9, 23, 71, 0.3);
    --wrap: 960px;
    background: var(--bg); color: var(--ink);
    font-family: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 17px; line-height: 1.55; -webkit-font-smoothing: antialiased; overflow-x: hidden;
}
.pd *, .pd *::before, .pd *::after { box-sizing: border-box; }
.pd-wrap { width: 100%; max-width: var(--wrap); margin-inline: auto; padding-inline: 24px; }
.pd-ic { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
[data-reveal] { opacity: 0; transform: translateY(16px); transition: opacity 0.5s var(--ease-out), transform 0.5s var(--ease-out); }
.pd.is-ready [data-reveal] { opacity: 1; transform: none; }
.pd.is-ready [data-reveal]:nth-child(2) { transition-delay: 0.05s; }
.pd.is-ready [data-reveal]:nth-child(3) { transition-delay: 0.1s; }
@media (prefers-reduced-motion: reduce) { [data-reveal] { opacity: 1; transform: none; transition: none; } }

.pd-section { padding: 40px 0 90px; }
.pd-load { padding: 90px 24px; text-align: center; color: var(--ink-2); }

.pd-idcard { display: flex; align-items: center; gap: 22px; background: linear-gradient(135deg, #0b1e52, #2360c6); color: #fff; border-radius: var(--r-lg); padding: 24px 28px; margin-bottom: 22px; }
.pd-ava { position: relative; flex: none; }
.pd-ava__img { width: 92px; height: 92px; border-radius: 50%; object-fit: cover; display: block; border: 3px solid rgba(255, 255, 255, 0.25); }
.pd-ava__img--i { display: grid; place-items: center; background: rgba(255, 255, 255, 0.16); color: #fff; font-weight: 700; font-size: 1.7rem; }
.pd-ava__edit, .pd-ava__del { position: absolute; width: 32px; height: 32px; border-radius: 50%; border: 2px solid #fff; display: grid; place-items: center; cursor: pointer; }
.pd-ava__edit { bottom: -2px; right: -2px; background: var(--blue); color: #fff; }
.pd-ava__del { bottom: -2px; left: -2px; background: #fff; color: var(--red); }
.pd-ava__edit .pd-ic, .pd-ava__del .pd-ic { width: 16px; height: 16px; }
.pd-ava__edit:disabled, .pd-ava__del:disabled { opacity: 0.6; cursor: default; }
.pd-idcard__name { margin: 0; font-weight: 800; font-size: 1.6rem; letter-spacing: -0.02em; }
.pd-idcard__email { margin: 4px 0 0; color: rgba(255, 255, 255, 0.8); font-size: 0.95rem; }
.pd-idcard__links { display: flex; gap: 18px; margin-top: 12px; }
.pd-idcard__links .pd-link { color: #fff; }
.pd-idcard__links .pd-link--muted { color: rgba(255, 255, 255, 0.7); }

.pd-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 26px 28px; margin-bottom: 20px; box-shadow: var(--shadow-sm); }
.pd-card__title { margin: 0 0 20px; font-weight: 800; font-size: 1.25rem; letter-spacing: -0.02em; }
.pd-card__foot { display: flex; align-items: center; gap: 14px; margin-top: 22px; }

.pd-grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 20px; }
.pd-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.pd-field--full { grid-column: 1 / -1; }
.pd-field__label { font-size: 0.82rem; font-weight: 600; color: var(--ink-2); }
.pd-field__help { font-size: 0.76rem; color: var(--ink-3); line-height: 1.4; }
.pd-input { width: 100%; border: 1px solid var(--line); background: var(--bg-tint); border-radius: var(--r-md); padding: 12px 15px; font-family: inherit; font-size: 0.98rem; color: var(--ink); outline: none; transition: border-color 0.15s, background 0.15s, box-shadow 0.15s; }
.pd-input:focus { border-color: var(--blue-soft); background: var(--surface); box-shadow: 0 0 0 4px var(--blue-tint); }
.pd-textarea { resize: vertical; min-height: 96px; line-height: 1.5; }
.pd-select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235b6472' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; background-size: 18px; padding-right: 42px; cursor: pointer; }

.pd-btn { border: none; border-radius: var(--r-pill); background: var(--blue); color: #fff; font-family: inherit; font-weight: 700; font-size: 0.98rem; padding: 12px 26px; cursor: pointer; transition: background 0.15s var(--ease-out), transform 0.15s var(--ease-out); text-decoration: none; display: inline-block; }
.pd-btn--ghost { background: var(--surface); color: var(--ink-2); border: 1px solid var(--line); }
.pd-btn:disabled { opacity: 0.55; cursor: default; }
@media (hover: hover) and (pointer: fine) {
    .pd-btn:not(:disabled):hover { background: var(--blue-strong); transform: translateY(-1px); }
    .pd-btn--ghost:not(:disabled):hover { background: var(--bg-tint); color: var(--ink); }
}
.pd-link { border: none; background: transparent; color: var(--blue-ink); font-family: inherit; font-size: 0.94rem; font-weight: 600; cursor: pointer; padding: 0; text-decoration: none; }
.pd-link:hover { text-decoration: underline; }
.pd-msg { font-size: 0.9rem; font-weight: 500; }
.pd-msg--err { color: var(--red); }
.pd-msg--ok { color: var(--green); }

.pd-check { display: flex; align-items: center; gap: 12px; padding: 11px 0; cursor: pointer; font-size: 0.96rem; color: var(--ink); }
.pd-check input { width: 20px; height: 20px; accent-color: var(--blue); cursor: pointer; flex: none; }
.pd-check + .pd-check { border-top: 1px solid var(--line); }

.pd-subs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 26px; }
.pd-subs__head { display: flex; align-items: center; gap: 8px; width: 100%; border: none; background: transparent; padding: 0 0 12px; font-family: inherit; font-size: 1.05rem; color: var(--ink); cursor: pointer; }
.pd-subs__head b { font-weight: 700; }
.pd-subs__n { color: var(--ink-3); font-weight: 600; }
.pd-subs__chev { margin-left: auto; font-size: 0.82rem; font-weight: 600; color: var(--blue-ink); }
.pd-subs__list { display: flex; flex-direction: column; gap: 6px; max-height: 340px; overflow-y: auto; }
.pd-subs__item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--r-md); text-decoration: none; color: inherit; }
@media (hover: hover) and (pointer: fine) { .pd-subs__item:hover { background: var(--bg-tint); } }
.pd-subs__item img, .pd-subs__i { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; flex: none; }
.pd-subs__i { display: grid; place-items: center; background: var(--blue-tint); color: var(--blue-ink); font-weight: 700; font-size: 0.8rem; }
.pd-subs__name { font-weight: 600; font-size: 0.94rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pd-subs__empty { color: var(--ink-3); font-size: 0.9rem; }
.pd-blk__head { font-size: 1.05rem; }
.pd-blk__hint { color: var(--ink-3); font-size: 0.88rem; margin: 4px 0 12px; }
.pd-blk__list { display: flex; flex-direction: column; gap: 6px; max-height: 340px; overflow-y: auto; }
.pd-blk__item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--r-md); }
.pd-blk__item img, .pd-blk__item .pd-subs__i { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; flex: none; }
.pd-blk__unblock { margin-left: auto; border: 1px solid var(--line); background: var(--surface); color: var(--blue-ink); font-family: inherit; font-weight: 600; font-size: 0.84rem; padding: 6px 12px; border-radius: var(--r-pill); cursor: pointer; white-space: nowrap; }
@media (hover: hover) and (pointer: fine) { .pd-blk__unblock:hover { background: var(--bg-tint); } }

@media (max-width: 720px) {
    .pd-grid2, .pd-subs { grid-template-columns: 1fr; }
    .pd-idcard { flex-direction: column; text-align: center; }
    .pd-idcard__links { justify-content: center; }
}
</style>
