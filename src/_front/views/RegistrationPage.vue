<!--
  RegistrationPage.vue — "/registration" in the MeetGuru promo (pd-*) brand language. Demo at
  /registration-demo; the live WeWeb /registration stays untouched until go-live (verified live first).

  Reproduces the WeWeb /registration workflow 1:1 (decoded from public/data/75f669f5….json + the
  Supabase Auth plugin + the on_auth_user_created DB trigger):
    - Fields: email, password, confirm-password, role select («Кто вы?» → Специалист / Спикер /
      Учебное заведение). No name field (set later in the profile). Plus VK ID one-tap (same as /login).
    - Submit → supabaseAuth.signUp({ email, password, metadata:[{key:'nickname', value:
      role==='Специалист' ? 'Ученик' : role}], redirectPage: HOME }). The `nickname` is the ONLY place
      the role is carried: the DB trigger handle_new_auth_user() inserts public.users (id, email,
      role = raw_user_meta_data->>'nickname') — so this key/mapping is a hard contract (wrong → null role).
    - Then POST the n8n webhook 64277b75 { email, password } (query params) — server-side welcome/setup,
      preserved verbatim as a black box.
    - On success → /welcome (change-page 280224c6 in the WeWeb flow).
    - Errors mapped to the same Russian copy («User already registered» → «Данный аккаунт уже
      зарегистрирован»). Onload: already logged in → / (bypass with ?preview=1 for previewing).
  Nothing about the auth/trigger/webhook wiring is changed — only the presentation.
-->
<template>
    <main class="pd" :class="{ 'is-ready': ready }">
        <div class="pd-auth">
            <!-- ── Brand panel ─────────────────────────────────── -->
            <aside class="pd-auth__brand">
                <div class="pd-auth__brandinner">
                    <a href="/" class="pd-auth__logo" aria-label="МитГуру">
                        meet<span>guru</span><i>.</i>
                    </a>
                    <h1 class="pd-auth__lead" data-reveal>Присоединяйтесь к&nbsp;сообществу специалистов в&nbsp;сфере оздоровления</h1>
                    <p class="pd-auth__leadsub" data-reveal>Курсы, клуб, живые трансляции и&nbsp;общение с&nbsp;преподавателями — в&nbsp;одном месте.</p>
                    <ul class="pd-auth__points" data-reveal>
                        <li><span class="pd-auth__pt"></span>Доступ к&nbsp;курсам от практикующих преподавателей</li>
                        <li><span class="pd-auth__pt"></span>Закрытый клуб и&nbsp;живые эфиры</li>
                        <li><span class="pd-auth__pt"></span>Ваш профиль в&nbsp;каталоге специалистов</li>
                    </ul>
                    <div class="pd-auth__art" data-reveal aria-hidden="true">
                        <img src="/images/login-key.png" alt="" />
                    </div>
                </div>
            </aside>

            <!-- ── Form panel ──────────────────────────────────── -->
            <section class="pd-auth__panel">
                <div class="pd-auth__card" data-reveal>
                    <h2 class="pd-auth__title">Создать аккаунт</h2>
                    <p class="pd-auth__sub">Регистрация займёт меньше минуты</p>

                    <form class="pd-auth__form" @submit.prevent="submitRegister">
                        <label class="pd-field">
                            <span class="pd-field__label">Email</span>
                            <input v-model="email" type="email" autocomplete="email" placeholder="you@example.com" :disabled="loading" required />
                        </label>

                        <label class="pd-field">
                            <span class="pd-field__label">Кто вы?</span>
                            <span class="pd-field__wrap">
                                <select v-model="role" class="pd-select" :class="{ 'is-placeholder': !role }" :disabled="loading" required>
                                    <option value="" disabled>Выберите роль</option>
                                    <option v-for="r in ROLES" :key="r" :value="r">{{ r }}</option>
                                </select>
                                <span class="pd-field__chev" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" class="pd-ic"><path d="M6 9l6 6 6-6"/></svg>
                                </span>
                            </span>
                        </label>

                        <label class="pd-field">
                            <span class="pd-field__label">Пароль</span>
                            <span class="pd-field__wrap">
                                <input :type="showPass ? 'text' : 'password'" v-model="password" autocomplete="new-password" placeholder="Не менее 6 символов" :disabled="loading" required />
                                <button type="button" class="pd-field__eye" :aria-label="showPass ? 'Скрыть пароль' : 'Показать пароль'" @click="showPass = !showPass">
                                    <svg v-if="showPass" viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                                    <svg v-else viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M2 12s3.5-7 10-7c2 0 3.8.6 5.3 1.5M22 12s-3.5 7-10 7c-2 0-3.8-.6-5.3-1.5"/><path d="M4 4l16 16"/></svg>
                                </button>
                            </span>
                        </label>

                        <label class="pd-field">
                            <span class="pd-field__label">Повторите пароль</span>
                            <input :type="showPass ? 'text' : 'password'" v-model="password2" autocomplete="new-password" placeholder="Ещё раз тот же пароль" :disabled="loading" required />
                        </label>

                        <p v-if="authError" class="pd-auth__err" role="alert">{{ authError }}</p>

                        <button class="pd-btn pd-btn--wide" type="submit" :disabled="loading">
                            {{ loading ? 'Создаём аккаунт…' : 'Зарегистрироваться' }}
                        </button>
                    </form>

                    <div class="pd-auth__or"><span>или</span></div>

                    <!-- VK ID one-tap renders its own button into this container (same flow as /login) -->
                    <div class="pd-auth__vk">
                        <div ref="vkContainer" class="pd-auth__vkbox"></div>
                        <p v-if="vkError" class="pd-auth__err">Не удалось войти через VK. Попробуйте ещё раз или зарегистрируйтесь по почте.</p>
                        <div v-if="vkBusy" class="pd-auth__vkbusy">Входим через VK…</div>
                    </div>

                    <p class="pd-auth__foot">
                        Уже есть аккаунт?
                        <a href="/login" class="pd-link">Войти</a>
                    </p>
                </div>

                <p class="pd-auth__copy">© {{ year }} meetguru. Все права защищены.</p>
            </section>
        </div>
    </main>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { isLikelyLoggedIn } from '@/_front/chrome/headerAccount.js';

const route = useRoute();

const ROLES = ['Специалист', 'Спикер', 'Учебное заведение'];

const email = ref('');
const role = ref('');
const password = ref('');
const password2 = ref('');
const showPass = ref(false);
const loading = ref(false);
const authError = ref('');

const vkContainer = ref(null);
const vkError = ref(false);
const vkBusy = ref(false);

const ready = ref(false);
const year = new Date().getFullYear();

const HOME = '/';
const WELCOME = '/welcome';
// NB: the WeWeb signUp passed `redirectPage: <Home UUID>`, which the auth plugin runs through
// wwLib.wwPageHelper.getPagePath(uuid) to build emailRedirectTo — that throws in this hand-written
// runtime and broke signUp. We deliberately DROP it: email confirmation is OFF (autoconfirm ON →
// signUp returns a session, no confirmation email is ever sent), so emailRedirectTo is dead anyway.
const N8N_SIGNUP_HOOK = 'https://n8n.meetgu.ru/webhook/64277b75-849f-45c6-81bc-64da11a7d530';
const N8N_VK = 'https://n8n.meetgu.ru/webhook/auth_vk';

// Supabase error message → the exact Russian copy the WeWeb page shows (errors table).
const ERROR_MAP = {
    'User already registered': 'Данный аккаунт уже зарегистрирован',
    'Password should be at least 6 characters.': 'Пароль должен быть не короче 6 символов',
    'Signup requires a valid password': 'Введите пароль',
    'Unable to validate email address: invalid format': 'Неверный формат почты',
};
function mapError(msg) { return ERROR_MAP[msg] || 'Не удалось создать аккаунт. Проверьте данные и попробуйте ещё раз.'; }

/* ── email / password sign-up ───────────────────────────────────────────────
   1:1 with the WeWeb workflow: signUp (metadata.nickname = role) → n8n webhook → /welcome.
   The DB trigger handle_new_auth_user() creates public.users(id,email,role=nickname). */
async function submitRegister() {
    authError.value = '';
    const e = email.value.trim();
    const p = password.value;
    const p2 = password2.value;
    if (!e || !p) { authError.value = 'Введите почту и пароль'; return; }
    if (!role.value) { authError.value = 'Выберите, кто вы'; return; }
    if (p.length < 6) { authError.value = 'Пароль должен быть не короче 6 символов'; return; }
    if (p !== p2) { authError.value = 'Пароли не совпадают'; return; }

    loading.value = true;
    try {
        // Специалист is the UI label for the «Ученик» role — the DB trigger reads `nickname` verbatim.
        const nickname = role.value === 'Специалист' ? 'Ученик' : role.value;
        await window.wwLib.wwPlugins.supabaseAuth.signUp({
            type: 'email',
            email: e,
            password: p,
            metadata: [{ key: 'nickname', value: nickname }],
        });
        // Server-side welcome/setup — preserved verbatim (POST with email+password as query params,
        // exactly like the WeWeb apiRequest step). Best-effort: a failure here must not strand a user
        // whose account (auth + public.users via trigger) already exists — proceed to /welcome anyway.
        try {
            const url = new URL(N8N_SIGNUP_HOOK);
            url.searchParams.set('email', e);
            url.searchParams.set('password', p);
            await fetch(url.toString(), { method: 'POST' });
        } catch (hookErr) { /* non-fatal — account already created */ }
        window.location.href = WELCOME;
    } catch (err) {
        console.error('[registration] signUp failed:', err);   // surface unmapped errors for diagnosis
        authError.value = mapError(err?.message);
        loading.value = false;
    }
}

/* ── VK ID one-tap (identical to LoginPage) ─────────────────────────────────── */
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
function readCookie(name) {
    const c = document.cookie.split(';').map((s) => s.trim()).find((s) => s.startsWith(name + '='));
    return c ? c.slice(name.length + 1) : null;
}

let vkScript = null;
function loadVkSdk() {
    if (window.VKIDSDK) { initVkOneTap(); return; }
    vkScript = document.createElement('script');
    vkScript.src = 'https://unpkg.com/@vkid/sdk@2.6.0/dist-sdk/umd/index.js';
    vkScript.async = true;
    vkScript.onload = initVkOneTap;
    vkScript.onerror = () => { vkError.value = true; };
    document.head.appendChild(vkScript);
}
function initVkOneTap() {
    const VKID = window.VKIDSDK;
    if (!VKID || !vkContainer.value) return;
    try {
        VKID.Config.init({
            app: 52010457,
            redirectUrl: 'https://app.meetgu.ru/login',
            responseMode: VKID.ConfigResponseMode.Callback,
            source: VKID.ConfigSource.LOWCODE,
            scope: 'email',
        });
        const oneTap = new VKID.OneTap({ showAgreements: true, skin: 'primary', buttonSkin: 'primary', buttonSize: 'large' });
        oneTap.render({ container: vkContainer.value, showAlternativeLogin: true })
            .on(VKID.WidgetEvents.ERROR, () => { vkError.value = true; })
            .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, (payload) => onVkSuccess(payload.code, payload.device_id));
    } catch (err) {
        vkError.value = true;
    }
}
async function onVkSuccess(code, deviceId) {
    vkError.value = false;
    vkBusy.value = true;
    try {
        await wait(1500);
        const codeVerifier = readCookie('vkid_sdk:codeVerifier');
        await wait(1500);
        const res = await fetch(N8N_VK, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ authCode: code, DeviceId: deviceId, codeVerifier }),
        }).then((r) => r.json());
        await window.wwLib.wwPlugins.supabaseAuth.verifyOTP({ type: 'email', email: res.email, token: res.otp });
        window.location.href = HOME;
    } catch (err) {
        vkError.value = true; vkBusy.value = false;
    }
}

onMounted(() => {
    ensureFonts();
    // The physical /registration shell inherits the empty WeWeb title → the home fallback «МитГуру —
    // моя страница». Set a proper tab title client-side (the shell HTML can't be changed per-route here).
    document.title = 'Регистрация — МитГуру';
    // already-logged-in guard (the WeWeb page redirects home onload). ?preview=1 stays for previewing.
    if (route.query.preview !== '1' && isLikelyLoggedIn()) { window.location.replace(HOME); return; }
    loadVkSdk();
    nextTick(() => { ready.value = true; });
});

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
    --orange: #f09157; --red: #de0030;
    --r-lg: 26px; --r-md: 14px; --r-pill: 999px;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --shadow: 0 24px 70px -34px rgba(9, 23, 71, 0.4); --shadow-sm: 0 4px 16px -8px rgba(9, 23, 71, 0.18);
    background: var(--bg); color: var(--ink);
    font-family: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 17px; line-height: 1.55; -webkit-font-smoothing: antialiased;
}
.pd *, .pd *::before, .pd *::after { box-sizing: border-box; }
.pd-ic { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
[data-reveal] { opacity: 0; transform: translateY(16px); transition: opacity 0.6s var(--ease-out), transform 0.6s var(--ease-out); }
.pd.is-ready [data-reveal] { opacity: 1; transform: none; }
.pd.is-ready [data-reveal]:nth-child(2) { transition-delay: 0.06s; }
.pd.is-ready [data-reveal]:nth-child(3) { transition-delay: 0.12s; }
@media (prefers-reduced-motion: reduce) { [data-reveal] { opacity: 1; transform: none; transition: none; } }

/* ── Shell ──────────────────────────────────────────────────────────────── */
.pd-auth { display: grid; grid-template-columns: 1.02fr 1fr; min-height: 100dvh; }

/* Brand panel */
.pd-auth__brand { position: relative; overflow: hidden; background: linear-gradient(155deg, #0b1e52 0%, #143a86 52%, #2360c6 100%); color: #fff; display: flex; }
.pd-auth__brand::before { content: ''; position: absolute; width: 460px; height: 460px; right: -140px; top: -120px; border-radius: 50%; background: radial-gradient(circle, rgba(240,145,87,0.5), transparent 62%); }
.pd-auth__brand::after { content: ''; position: absolute; width: 520px; height: 520px; left: -180px; bottom: -200px; border-radius: 50%; background: radial-gradient(circle, rgba(84,149,243,0.42), transparent 62%); }
.pd-auth__brandinner { position: relative; z-index: 1; margin: auto; width: 100%; max-width: 480px; padding: 56px 60px; }
.pd-auth__logo { display: inline-block; font-weight: 800; font-size: 1.7rem; letter-spacing: -0.03em; color: #fff; text-decoration: none; }
.pd-auth__logo span { color: #cfe0ff; }
.pd-auth__logo i { color: var(--orange); font-style: normal; }
.pd-auth__lead { margin: 42px 0 0; font-weight: 800; font-size: clamp(1.7rem, 2.9vw, 2.4rem); line-height: 1.1; letter-spacing: -0.025em; }
.pd-auth__leadsub { margin: 16px 0 0; color: rgba(255, 255, 255, 0.82); font-size: 1.06rem; max-width: 32ch; }
.pd-auth__points { list-style: none; margin: 30px 0 0; padding: 0; display: flex; flex-direction: column; gap: 13px; }
.pd-auth__points li { display: flex; align-items: center; gap: 12px; color: rgba(255, 255, 255, 0.92); font-size: 0.98rem; }
.pd-auth__pt { width: 8px; height: 8px; border-radius: 50%; background: var(--orange); flex: none; box-shadow: 0 0 0 4px rgba(240, 145, 87, 0.22); }
.pd-auth__art { width: 300px; max-width: 100%; margin: 36px 0 0; }
.pd-auth__art img { display: block; width: 100%; height: auto; }

/* Form panel */
.pd-auth__panel { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px; gap: 20px; }
.pd-auth__card { width: 100%; max-width: 400px; }
.pd-auth__title { margin: 0; font-weight: 800; font-size: 1.7rem; letter-spacing: -0.02em; }
.pd-auth__sub { margin: 8px 0 0; color: var(--ink-2); font-size: 0.98rem; }

.pd-auth__form { display: flex; flex-direction: column; gap: 16px; margin-top: 26px; }
.pd-field { display: flex; flex-direction: column; gap: 7px; }
.pd-field__label { font-size: 0.85rem; font-weight: 600; color: var(--ink-2); }
.pd-field__wrap { position: relative; display: flex; }
.pd-field input, .pd-select { width: 100%; border: 1px solid var(--line); background: var(--bg-tint); border-radius: var(--r-md); padding: 13px 16px; font-family: inherit; font-size: 1rem; color: var(--ink); outline: none; transition: border-color 0.15s var(--ease-out), background 0.15s var(--ease-out); }
.pd-field__wrap input { padding-right: 48px; }
.pd-field input::placeholder { color: var(--ink-3); }
.pd-field input:focus, .pd-select:focus { border-color: var(--blue-soft); background: var(--surface); box-shadow: 0 0 0 4px var(--blue-tint); }
.pd-field input:disabled, .pd-select:disabled { opacity: 0.6; }
.pd-field__eye { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 34px; height: 34px; display: grid; place-items: center; border: none; background: transparent; color: var(--ink-3); cursor: pointer; border-radius: 8px; }
.pd-field__eye .pd-ic { width: 19px; height: 19px; }
@media (hover: hover) and (pointer: fine) { .pd-field__eye:hover { color: var(--ink); } }

/* Role select (native, styled) */
.pd-select { appearance: none; -webkit-appearance: none; padding-right: 44px; cursor: pointer; }
.pd-select.is-placeholder { color: var(--ink-3); }
.pd-field__chev { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: var(--ink-3); pointer-events: none; display: grid; place-items: center; }
.pd-field__chev .pd-ic { width: 20px; height: 20px; }

.pd-auth__err { margin: 2px 0 0; color: var(--red); font-size: 0.88rem; font-weight: 500; }

.pd-btn { border: none; border-radius: var(--r-pill); background: var(--blue); color: #fff; font-family: inherit; font-weight: 700; font-size: 1rem; padding: 14px 22px; cursor: pointer; transition: background 0.15s var(--ease-out), transform 0.15s var(--ease-out); }
.pd-btn--wide { width: 100%; }
.pd-btn--ghost { background: var(--surface); color: var(--ink-2); border: 1px solid var(--line); }
.pd-btn:disabled { opacity: 0.6; cursor: default; }
@media (hover: hover) and (pointer: fine) {
    .pd-btn:not(:disabled):hover { background: var(--blue-strong); transform: translateY(-1px); }
    .pd-btn--ghost:not(:disabled):hover { background: var(--bg-tint); color: var(--ink); }
    .pd-btn:active { transform: translateY(0); }
}

.pd-link { border: none; background: transparent; color: var(--blue-ink); font-family: inherit; font-size: 0.92rem; font-weight: 600; cursor: pointer; padding: 0; text-decoration: none; }
.pd-link:hover { text-decoration: underline; }

.pd-auth__or { display: flex; align-items: center; gap: 14px; margin: 22px 0; color: var(--ink-3); font-size: 0.82rem; }
.pd-auth__or::before, .pd-auth__or::after { content: ''; height: 1px; background: var(--line); flex: 1; }

.pd-auth__vk { min-height: 44px; }
.pd-auth__vkbox { width: 100%; }
.pd-auth__vkbusy { margin-top: 10px; text-align: center; color: var(--ink-2); font-size: 0.9rem; }

.pd-auth__foot { margin: 24px 0 0; text-align: center; color: var(--ink-2); font-size: 0.94rem; }

.pd-auth__copy { color: var(--ink-3); font-size: 0.8rem; }

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 900px) {
    .pd-auth { grid-template-columns: 1fr; }
    .pd-auth__brand { min-height: auto; }
    .pd-auth__brandinner { max-width: 560px; padding: 40px 32px 36px; margin: 0 auto; }
    .pd-auth__lead { margin-top: 22px; font-size: clamp(1.4rem, 5.6vw, 1.9rem); }
    .pd-auth__leadsub { max-width: none; }
    .pd-auth__points { display: none; }
    .pd-auth__art { display: none; }
    .pd-auth__panel { padding: 34px 22px 48px; }
}
@media (max-width: 900px) and (min-width: 561px) {
    .pd-auth__lead { max-width: 24ch; }
}
</style>
