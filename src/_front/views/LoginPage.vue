<!--
  LoginPage.vue — "/login" in the MeetGuru promo (pd-*) brand language. Demo at /login-demo; the live
  WeWeb /login is untouched until go-live.

  Reproduces the WeWeb /login auth flow 1:1 (verified against public/data/90282a2b….json + the Supabase
  Auth plugin + the VK ID element):
    - Email/password  → wwLib.wwPlugins.supabaseAuth.signInEmail({email,password}) (same shared client,
      same storageKey/cookies), then read the user's `role`: admin → /superadmin, else → / (logged-in Home).
    - Errors are mapped to the same Russian copy (Invalid login credentials → «Неверно указан логин или пароль»).
    - "Забыли пароль?" → POST n8n webhook 9a75f556-… { email } (NOT Supabase reset), then a confirmation.
    - VK ID one-tap (@vkid/sdk 2.6.0, app 52010457, responseMode Callback, scope email) → on LOGIN_SUCCESS:
      wait 1500 → read cookie vkid_sdk:codeVerifier → wait 1500 → POST n8n auth_vk {authCode,DeviceId,
      codeVerifier} → {email,otp} → supabaseAuth.verifyOTP({type:'email',…}) → /.
    - "Зарегистрируйтесь" → /registration.
    - Onload: already logged in → / (bypass with ?preview=1 for previewing the demo while logged in).
  Nothing about the auth wiring is changed — only the presentation.
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
                    <h1 class="pd-auth__lead" data-reveal>Сообщество специалистов в&nbsp;сфере кинезиологии</h1>
                    <p class="pd-auth__leadsub" data-reveal>Курсы, клуб, живые трансляции и общение с преподавателями — в&nbsp;одном месте.</p>
                    <ul class="pd-auth__points" data-reveal>
                        <li><span class="pd-auth__pt"></span>Курсы от практикующих преподавателей</li>
                        <li><span class="pd-auth__pt"></span>Закрытый клуб и живые эфиры</li>
                        <li><span class="pd-auth__pt"></span>Прогресс и материалы всегда под рукой</li>
                    </ul>
                    <div class="pd-auth__art" data-reveal aria-hidden="true">
                        <img src="/images/login-key.png" alt="" />
                    </div>
                </div>
            </aside>

            <!-- ── Form panel ──────────────────────────────────── -->
            <section class="pd-auth__panel">
                <div class="pd-auth__card" data-reveal>
                    <!-- LOGIN VIEW -->
                    <template v-if="view === 'login'">
                        <h2 class="pd-auth__title">Войти на платформу</h2>
                        <p class="pd-auth__sub">Рады видеть вас снова</p>

                        <form class="pd-auth__form" @submit.prevent="submitLogin">
                            <label class="pd-field">
                                <span class="pd-field__label">Email</span>
                                <input v-model="email" type="email" autocomplete="email" placeholder="you@example.com" :disabled="loading" required />
                            </label>

                            <label class="pd-field">
                                <span class="pd-field__label">Пароль</span>
                                <span class="pd-field__wrap">
                                    <input :type="showPass ? 'text' : 'password'" v-model="password" autocomplete="current-password" placeholder="Ваш пароль" :disabled="loading" required />
                                    <button type="button" class="pd-field__eye" :aria-label="showPass ? 'Скрыть пароль' : 'Показать пароль'" @click="showPass = !showPass">
                                        <svg v-if="showPass" viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                                        <svg v-else viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M2 12s3.5-7 10-7c2 0 3.8.6 5.3 1.5M22 12s-3.5 7-10 7c-2 0-3.8-.6-5.3-1.5"/><path d="M4 4l16 16"/></svg>
                                    </button>
                                </span>
                            </label>

                            <p v-if="authError" class="pd-auth__err" role="alert">{{ authError }}</p>

                            <button class="pd-btn pd-btn--wide" type="submit" :disabled="loading">
                                {{ loading ? 'Входим…' : 'Войти' }}
                            </button>

                            <button type="button" class="pd-link pd-auth__forgot" @click="goReset">Забыли пароль?</button>
                        </form>

                        <div class="pd-auth__or"><span>или</span></div>

                        <!-- VK ID one-tap renders its own button into this container -->
                        <div class="pd-auth__vk">
                            <div ref="vkContainer" class="pd-auth__vkbox"></div>
                            <p v-if="vkError" class="pd-auth__err">Не удалось войти через VK. Попробуйте ещё раз или войдите по почте.</p>
                            <div v-if="vkBusy" class="pd-auth__vkbusy">Входим через VK…</div>
                        </div>

                        <p class="pd-auth__foot">
                            Ещё нет аккаунта?
                            <a href="/registration" class="pd-link">Зарегистрируйтесь</a>
                        </p>
                    </template>

                    <!-- RESET VIEW -->
                    <template v-else>
                        <button type="button" class="pd-auth__back" @click="view = 'login'">
                            <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>
                            Назад
                        </button>

                        <template v-if="!resetSent">
                            <h2 class="pd-auth__title">Восстановить пароль</h2>
                            <p class="pd-auth__sub">Введите адрес электронной почты, связанный с вашей учётной записью, и мы вышлем вам ссылку для сброса пароля.</p>
                            <form class="pd-auth__form" @submit.prevent="submitReset">
                                <label class="pd-field">
                                    <span class="pd-field__label">Почта</span>
                                    <input v-model="resetEmail" type="email" autocomplete="email" placeholder="you@example.com" :disabled="resetLoading" required />
                                </label>
                                <button class="pd-btn pd-btn--wide" type="submit" :disabled="resetLoading">
                                    {{ resetLoading ? 'Отправляем…' : 'Отправить' }}
                                </button>
                            </form>
                        </template>

                        <div v-else class="pd-auth__done">
                            <span class="pd-auth__doneic" aria-hidden="true">
                                <svg viewBox="0 0 24 24" class="pd-ic"><path d="M20 6L9 17l-5-5"/></svg>
                            </span>
                            <h2 class="pd-auth__title">Письмо отправлено</h2>
                            <p class="pd-auth__sub">Проверьте почту — мы прислали ссылку для сброса пароля. Не пришло? Загляните в спам.</p>
                            <button type="button" class="pd-btn pd-btn--wide pd-btn--ghost" @click="view = 'login'">Вернуться ко входу</button>
                        </div>
                    </template>
                </div>

                <p class="pd-auth__copy">© {{ year }} meetguru. Все права защищены.</p>
            </section>
        </div>
    </main>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { getSupabase, readStoredSession, isLikelyLoggedIn } from '@/_front/chrome/headerAccount.js';

const route = useRoute();

const view = ref('login');           // 'login' | 'reset'
const email = ref('');
const password = ref('');
const showPass = ref(false);
const loading = ref(false);
const authError = ref('');

const resetEmail = ref('');
const resetLoading = ref(false);
const resetSent = ref(false);

const vkContainer = ref(null);
const vkError = ref(false);
const vkBusy = ref(false);

const ready = ref(false);
const year = new Date().getFullYear();

const HOME = '/';
const SUPERADMIN = '/superadmin';
const N8N_RESET = 'https://n8n.meetgu.ru/webhook/9a75f556-acbe-4504-a821-41d551765df7';
const N8N_VK = 'https://n8n.meetgu.ru/webhook/auth_vk';

// Supabase error message → the exact Russian copy the WeWeb page shows (errors table).
const ERROR_MAP = {
    'Invalid login credentials': 'Неверно указан логин или пароль',
    'Email not confirmed': 'Почта не подтверждена. Проверьте письмо со ссылкой.',
    'Email and Password are required.': 'Введите почту и пароль',
};
function mapError(msg) { return ERROR_MAP[msg] || 'Не удалось войти. Проверьте данные и попробуйте ещё раз.'; }

/* ── email / password ───────────────────────────────────────────────────── */
async function submitLogin() {
    authError.value = '';
    const e = email.value.trim();
    const p = password.value;
    if (!e || !p) { authError.value = 'Введите почту и пароль'; return; }
    loading.value = true;
    try {
        await window.wwLib.wwPlugins.supabaseAuth.signInEmail({ email: e, password: p });
        // read the freshly-authenticated user's role (admin → superadmin, else home) — same as WeWeb
        let role = null;
        try {
            const sb = getSupabase();
            const myId = readStoredSession()?.user?.id;
            if (sb && myId) {
                const { data } = await sb.from('users').select('role').eq('id', myId).limit(1);
                role = data?.[0]?.role || null;
            }
        } catch (err) { /* role lookup failed → default to home */ }
        window.location.href = role === 'admin' ? SUPERADMIN : HOME;
    } catch (err) {
        authError.value = mapError(err?.message);
        loading.value = false;
    }
}

/* ── password reset (n8n webhook) ───────────────────────────────────────── */
function goReset() { authError.value = ''; resetSent.value = false; resetEmail.value = email.value; view.value = 'reset'; }
async function submitReset() {
    const e = resetEmail.value.trim();
    if (!e) return;
    resetLoading.value = true;
    try {
        await fetch(N8N_RESET, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e }) });
        resetEmail.value = '';
        resetSent.value = true;
    } catch (err) {
        resetSent.value = true; // the WeWeb flow always confirms; keep parity
    } finally { resetLoading.value = false; }
}

/* ── VK ID one-tap ──────────────────────────────────────────────────────── */
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
    // already-logged-in guard (the WeWeb page redirects home onload). ?preview=1 stays for previewing.
    if (route.query.preview !== '1' && isLikelyLoggedIn()) { window.location.replace(HOME); return; }
    loadVkSdk();
    nextTick(() => { ready.value = true; });
});
onBeforeUnmount(() => { /* VK SDK left in place; nothing to tear down */ });

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
.pd-auth__lead { margin: 42px 0 0; font-weight: 800; font-size: clamp(1.8rem, 3vw, 2.5rem); line-height: 1.08; letter-spacing: -0.025em; }
.pd-auth__leadsub { margin: 16px 0 0; color: rgba(255, 255, 255, 0.82); font-size: 1.06rem; max-width: 30ch; }
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
.pd-field input { width: 100%; border: 1px solid var(--line); background: var(--bg-tint); border-radius: var(--r-md); padding: 13px 16px; font-family: inherit; font-size: 1rem; color: var(--ink); outline: none; transition: border-color 0.15s var(--ease-out), background 0.15s var(--ease-out); }
.pd-field__wrap input { padding-right: 48px; }
.pd-field input::placeholder { color: var(--ink-3); }
.pd-field input:focus { border-color: var(--blue-soft); background: var(--surface); box-shadow: 0 0 0 4px var(--blue-tint); }
.pd-field input:disabled { opacity: 0.6; }
.pd-field__eye { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 34px; height: 34px; display: grid; place-items: center; border: none; background: transparent; color: var(--ink-3); cursor: pointer; border-radius: 8px; }
.pd-field__eye .pd-ic { width: 19px; height: 19px; }
@media (hover: hover) and (pointer: fine) { .pd-field__eye:hover { color: var(--ink); } }

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
.pd-auth__forgot { align-self: center; margin-top: 2px; }

.pd-auth__or { display: flex; align-items: center; gap: 14px; margin: 22px 0; color: var(--ink-3); font-size: 0.82rem; }
.pd-auth__or::before, .pd-auth__or::after { content: ''; height: 1px; background: var(--line); flex: 1; }

.pd-auth__vk { min-height: 44px; }
.pd-auth__vkbox { width: 100%; }
.pd-auth__vkbusy { margin-top: 10px; text-align: center; color: var(--ink-2); font-size: 0.9rem; }

.pd-auth__foot { margin: 24px 0 0; text-align: center; color: var(--ink-2); font-size: 0.94rem; }

.pd-auth__back { display: inline-flex; align-items: center; gap: 4px; border: none; background: transparent; color: var(--ink-2); font-family: inherit; font-size: 0.92rem; font-weight: 600; cursor: pointer; padding: 0; margin-bottom: 18px; }
.pd-auth__back .pd-ic { width: 18px; height: 18px; }
@media (hover: hover) and (pointer: fine) { .pd-auth__back:hover { color: var(--ink); } }

.pd-auth__done { text-align: center; }
.pd-auth__doneic { display: grid; place-items: center; width: 58px; height: 58px; margin: 0 auto 18px; border-radius: 50%; background: #e7f6ed; color: #157a38; }
.pd-auth__doneic .pd-ic { width: 28px; height: 28px; stroke-width: 2.4; }

.pd-auth__copy { color: var(--ink-3); font-size: 0.8rem; }

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 900px) {
    .pd-auth { grid-template-columns: 1fr; }
    .pd-auth__brand { min-height: auto; }
    .pd-auth__brandinner { max-width: 560px; padding: 40px 32px 36px; margin: 0 auto; }
    .pd-auth__lead { margin-top: 22px; font-size: clamp(1.5rem, 6vw, 2rem); }
    .pd-auth__leadsub { max-width: none; }
    .pd-auth__points { display: none; }
    .pd-auth__art { display: none; }
    .pd-auth__panel { padding: 34px 22px 48px; }
}
@media (max-width: 900px) and (min-width: 561px) {
    .pd-auth__lead { max-width: 22ch; }
}
</style>
