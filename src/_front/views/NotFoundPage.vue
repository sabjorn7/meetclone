<!--
  NotFoundPage.vue — client-side 404 for the SPA catch-all route (router.js `catch-all-404`).
  Renders on in-app navigation to an unknown path. Direct hits / refresh on an unknown URL never boot
  the SPA (no server SPA-fallback by design), so those are handled separately by the static
  public/404.html served via nginx `error_page 404 /404.html;` — kept visually in sync with this page.
  Gets the shared AppHeader/AppFooter (this route is NOT in App.vue CHROME_EXCLUDE).
-->
<template>
    <main class="pd nf">
        <span class="nf__blob nf__blob--1" aria-hidden="true"></span>
        <span class="nf__blob nf__blob--2" aria-hidden="true"></span>
        <span class="nf__blob nf__blob--3" aria-hidden="true"></span>

        <div class="nf__inner">
            <img class="nf__img" src="/images/404-character.png" alt="" width="626" height="626" />
            <p class="nf__code">404</p>
            <h1 class="nf__title">Кажется, вы забрели не туда</h1>
            <p class="nf__sub">Такой страницы у нас нет — возможно, ссылка устарела или в адресе опечатка. Ничего страшного, вот куда можно вернуться.</p>
            <div class="nf__actions">
                <a class="nf-btn nf-btn--primary" href="/">На главную</a>
                <a class="nf-btn" href="/all_course">Каталог курсов</a>
            </div>
            <div class="nf__links">
                <a href="/articles">Статьи</a><span aria-hidden="true">·</span>
                <a href="/users">Сообщество</a><span aria-hidden="true">·</span>
                <a href="/clubs">Клубы</a>
            </div>
        </div>
    </main>
</template>

<script setup>
// No logic needed — a static informational page. The catch-all route's beforeEnter still handles the
// legacy ?article= / ?course= query-string redirects before this component ever renders.
</script>

<style scoped>
.nf {
    --ink: #091747; --ink-2: #5b6472; --ink-3: #98a0ad; --line: #e4e9f1;
    --blue: #2e70dd; --blue-soft: #5495f3; --blue-strong: #2360c6; --blue-ink: #1f5fc9;
    --bg: #ffffff; --bg-tint: #f1f6fd; --r-pill: 999px;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    position: relative; overflow: hidden; min-height: 72vh;
    display: grid; place-items: center; padding: 56px 24px 80px;
    background: var(--bg); color: var(--ink);
    font-family: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
}
.nf * { box-sizing: border-box; }

/* ambient blobs (echo the landing hero) */
.nf__blob { position: absolute; border-radius: 50%; filter: blur(46px); opacity: 0.5; z-index: 0; pointer-events: none; }
.nf__blob--1 { width: 340px; height: 340px; left: -80px; top: 4%; background: #dbe8ff; animation: nf-drift 15s var(--ease-out) infinite alternate; }
.nf__blob--2 { width: 300px; height: 300px; right: -70px; top: 28%; background: #ffe6d4; animation: nf-drift 18s var(--ease-out) infinite alternate-reverse; }
.nf__blob--3 { width: 260px; height: 260px; left: 30%; bottom: -90px; background: #e3f0ff; animation: nf-drift 21s var(--ease-out) infinite alternate; }
@keyframes nf-drift { from { transform: translate(0, 0); } to { transform: translate(26px, -22px); } }

.nf__inner { position: relative; z-index: 1; max-width: 560px; text-align: center; display: flex; flex-direction: column; align-items: center; }
.nf__img { width: clamp(160px, 34vw, 240px); height: auto; margin-bottom: 4px; animation: nf-float 5.5s ease-in-out infinite; }
@keyframes nf-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }

.nf__code { margin: 0; font-weight: 800; font-size: clamp(2.4rem, 8vw, 3.6rem); letter-spacing: 0.06em; color: var(--blue); line-height: 1; }
.nf__title { margin: 6px 0 0; font-weight: 700; font-size: clamp(1.4rem, 4vw, 2rem); letter-spacing: -0.02em; text-wrap: balance; }
.nf__sub { margin: 12px 0 0; color: var(--ink-2); font-size: 1.02rem; line-height: 1.55; max-width: 44ch; }

.nf__actions { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 26px; }
.nf-btn { font-weight: 600; font-size: 15px; color: var(--ink); background: #fff; border: 1px solid var(--line); border-radius: var(--r-pill); padding: 13px 24px; text-decoration: none; transition: border-color 0.16s var(--ease-out), background 0.16s var(--ease-out), transform 0.12s var(--ease-out); }
.nf-btn:active { transform: translateY(1px); }
.nf-btn--primary { background: var(--blue); color: #fff; border-color: transparent; }
@media (hover: hover) {
    .nf-btn:hover { border-color: var(--blue-soft); }
    .nf-btn--primary:hover { background: var(--blue-strong); border-color: transparent; }
}
.nf__links { display: flex; align-items: center; gap: 12px; margin-top: 22px; color: var(--ink-3); font-size: 0.92rem; }
.nf__links a { color: var(--blue-ink); text-decoration: none; }
.nf__links a:hover { text-decoration: underline; }

@media (prefers-reduced-motion: reduce) {
    .nf__img, .nf__blob { animation: none; }
}
</style>
