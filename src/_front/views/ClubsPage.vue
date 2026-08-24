<!--
  ClubsPage.vue — "/clubs" (MeetClub) in the MeetGuru promo (pd-*) brand language. Overrides the WeWeb
  clubs page. Content-only — the shared AppHeader/AppFooter come from App.vue.

  SCOPE (money-safe): this page is ONLY the catalog + "Мои подписки". Club subscriptions are RECURRING
  paid subscriptions (Prodamus recurring: club_subs.customer_id/end_date, clubs.sub_id) — that
  subscribe/pay/cancel flow lives on the /club detail page and is NOT touched here. Every card just
  routes to /club?club=<id> (the WeWeb club page reads ?club= to open a specific club), exactly like
  the WeWeb "Перейти". No club_subs writes happen on this page.
-->
<template>
    <main class="pd" :class="{ 'is-ready': ready }">
        <header class="pd-hero">
            <div class="pd-blob" aria-hidden="true"></div>
            <div class="pd-wrap">
                <span class="pd-badge" data-reveal><span class="pd-badge__dot" aria-hidden="true"></span>MeetClub</span>
                <h1 class="pd-hero__title" data-reveal>Клубы и подписки</h1>
                <p class="pd-hero__sub" data-reveal>Закрытые сообщества экспертов: обучение, разбор клинических случаев и поддержка. Подписка — на странице клуба.</p>
            </div>
        </header>

        <section class="pd-section pd-section--tint">
            <div class="pd-wrap">
                <div class="pd-tabs" role="tablist" data-reveal>
                    <button class="pd-tab" :class="{ 'is-on': tab === 'all' }" type="button" role="tab" :aria-selected="tab === 'all'" @click="tab = 'all'">
                        Все клубы <span class="pd-tab__n">{{ clubs.length }}</span>
                    </button>
                    <button class="pd-tab" :class="{ 'is-on': tab === 'my' }" type="button" role="tab" :aria-selected="tab === 'my'" @click="tab = 'my'">
                        Мои подписки <span class="pd-tab__n">{{ mySubs.length }}</span>
                    </button>
                </div>

                <!-- ── ВСЕ КЛУБЫ ─────────────────────────────────── -->
                <template v-if="tab === 'all'">
                    <div v-if="clubs.length" class="pd-cards pd-cards--clubs">
                        <article v-for="(c, i) in clubs" :key="c.id" class="pd-club" data-reveal :style="{ '--i': Math.min(i, 6) }">
                            <div class="pd-club__cover" :class="{ 'is-empty': !clubLogo(c) }">
                                <img v-if="clubLogo(c)" :src="clubLogo(c)" :alt="ownerName(c)" loading="lazy" />
                                <span v-else class="pd-club__cover-i">{{ initials(c) }}</span>
                            </div>
                            <div class="pd-club__body">
                                <span v-if="ownerName(c)" class="pd-club__label">{{ ownerName(c) }}</span>
                                <h3 class="pd-club__t">{{ c.title }}</h3>
                                <p v-if="c.short_descr" class="pd-club__d">{{ c.short_descr }}</p>
                                <div class="pd-club__foot">
                                    <span class="pd-club__subs">
                                        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3 3 0 0 1 0 5.5"/></svg>
                                        {{ subCount(c) }} {{ plural(subCount(c), ['подписчик', 'подписчика', 'подписчиков']) }}
                                    </span>
                                    <span class="pd-club__price">{{ money(c.price) }} ₽<span class="per">/мес</span></span>
                                </div>
                                <a class="pd-btn pd-btn--block" :href="clubHref(c)">Перейти</a>
                            </div>
                        </article>
                    </div>
                    <div v-else-if="!loading" class="pd-empty">
                        <img class="pd-empty__mascot" src="/images/minime-06.png" alt="" aria-hidden="true" width="626" height="626" />
                        <p>Пока нет доступных клубов.</p>
                    </div>
                </template>

                <!-- ── МОИ ПОДПИСКИ ──────────────────────────────── -->
                <template v-else>
                    <div v-if="mySubs.length" class="pd-cards pd-cards--clubs">
                        <article v-for="(s, i) in mySubs" :key="s.id" class="pd-club" data-reveal :style="{ '--i': Math.min(i, 6) }">
                            <div class="pd-club__cover" :class="{ 'is-empty': !clubLogo(s.club) }">
                                <img v-if="clubLogo(s.club)" :src="clubLogo(s.club)" :alt="ownerName(s.club)" loading="lazy" />
                                <span v-else class="pd-club__cover-i">{{ initials(s.club) }}</span>
                                <span class="pd-access is-active pd-club__cover-badge">{{ s.end_date ? 'Активна до ' + fmtDate(s.end_date) : 'Активна' }}</span>
                            </div>
                            <div class="pd-club__body">
                                <span v-if="ownerName(s.club)" class="pd-club__label">{{ ownerName(s.club) }}</span>
                                <h3 class="pd-club__t">{{ s.club.title }}</h3>
                                <p v-if="s.club.short_descr" class="pd-club__d">{{ s.club.short_descr }}</p>
                                <div class="pd-club__foot">
                                    <span class="pd-club__price">{{ money(s.club.price) }} ₽<span class="per">/мес</span></span>
                                </div>
                                <a class="pd-btn pd-btn--block" :href="clubHref(s.club)">Перейти в клуб</a>
                            </div>
                        </article>
                    </div>
                    <div v-else-if="!loading" class="pd-empty">
                        <img class="pd-empty__mascot" src="/images/minime-06.png" alt="" aria-hidden="true" width="626" height="626" />
                        <p>У вас пока нет активных подписок.</p>
                        <button class="pd-btn pd-btn--lg" type="button" @click="tab = 'all'">Смотреть клубы</button>
                    </div>
                </template>

                <p v-if="loading" class="pd-state">Загрузка…</p>
            </div>
        </section>
    </main>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { getSupabase, readStoredSession } from '@/_front/chrome/headerAccount.js';

const clubs = ref([]);        // active clubs (catalog)
const mySubs = ref([]);       // [{ id, end_date, club }] — the user's active subscriptions
const ownersById = ref({});
const subCountById = ref({}); // clubId -> number of active subscribers
const tab = ref('all');
const loading = ref(true);
const ready = ref(false);

function money(n) { return Number(n || 0).toLocaleString('ru-RU'); }
function plural(n, f) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return f[2];
    if (b > 1 && b < 5) return f[1];
    if (b === 1) return f[0];
    return f[2];
}
function fmtDate(d) {
    const x = new Date(d);
    return isNaN(x) ? '' : x.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
// The WeWeb /club page opens a specific club from ?club=<id> (get_club_bundle p_club) — same routing.
function clubHref(club) { return `/club?club=${club.id}`; }
function ownerOf(club) { return ownersById.value[club?.owner] || null; }
function ownerName(club) { return ownerOf(club)?.Name || ''; }
// clubs.label is the club's LOGO image URL; fall back to the owner's photo, then initials.
function clubLogo(club) { return club?.label || ownerOf(club)?.Photo || ''; }
function initials(club) {
    const n = ownerOf(club)?.Name || club?.title || '';
    const p = n.split(/\s+/).filter(Boolean);
    return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '·';
}
// subscriber count = active club_subs for the club (matches the WeWeb "N подписчиков"; the clubs.subs
// array is not the source of truth).
function subCount(club) { return subCountById.value[club?.id] || 0; }

async function load() {
    const sb = getSupabase();
    if (!sb) { loading.value = false; return; }
    const uid = readStoredSession()?.user?.id;

    const { data: cl } = await sb.from('clubs')
        .select('id, title, short_descr, label, price, subs, owner, active')
        .eq('active', true)
        .order('created_at', { ascending: false });
    clubs.value = cl || [];

    // subscriptions (money data is read-only here — never written)
    if (uid) {
        const { data: subs } = await sb.from('club_subs')
            .select('id, club, active, end_date')
            .eq('suber', uid)
            .eq('active', true);
        const byId = Object.fromEntries(clubs.value.map((c) => [c.id, c]));
        // pull any subscribed club that isn't in the active-catalog list (e.g. now-inactive club)
        const missing = [...new Set((subs || []).map((s) => s.club).filter((id) => id && !byId[id]))];
        if (missing.length) {
            const { data: extra } = await sb.from('clubs').select('id, title, short_descr, label, price, subs, owner').in('id', missing);
            for (const c of extra || []) byId[c.id] = c;
        }
        mySubs.value = (subs || []).map((s) => ({ id: s.id, end_date: s.end_date, club: byId[s.club] })).filter((s) => s.club);
    }

    // active subscriber counts per club (read-only). One query over the club column, counted client-side.
    const clubIds = clubs.value.map((c) => c.id);
    if (clubIds.length) {
        const { data: rows } = await sb.from('club_subs').select('club').eq('active', true).in('club', clubIds);
        const counts = {};
        for (const r of rows || []) counts[r.club] = (counts[r.club] || 0) + 1;
        subCountById.value = counts;
    }

    // owner avatars for all referenced clubs
    const ownerIds = [...new Set([...clubs.value, ...mySubs.value.map((s) => s.club)].map((c) => c?.owner).filter(Boolean))];
    if (ownerIds.length) {
        const { data: us } = await sb.from('users').select('id, "Name", "Photo"').in('id', ownerIds);
        ownersById.value = Object.fromEntries((us || []).map((u) => [u.id, u]));
    }

    loading.value = false;
    await nextTick();
    ready.value = true;
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
    --orange: #f09157; --orange-ink: #c2410c; --green: #157a38; --green-tint: #e7f6ec;
    --r-lg: 26px; --r-md: 16px; --r-pill: 999px;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --shadow: 0 14px 40px -20px rgba(9, 23, 71, 0.24); --shadow-sm: 0 4px 16px -8px rgba(9, 23, 71, 0.18);
    --wrap: 1200px;
    background: var(--bg); color: var(--ink);
    font-family: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 17px; line-height: 1.55; -webkit-font-smoothing: antialiased; overflow-x: hidden;
}
.pd *, .pd *::before, .pd *::after { box-sizing: border-box; }
.pd-wrap { width: 100%; max-width: var(--wrap); margin-inline: auto; padding-inline: 40px; }
.pd-section { padding: 56px 0 88px; }
.pd-section--tint { background: var(--bg-tint); }
.pd-state { text-align: center; color: var(--ink-2); font-size: 1.05rem; padding: 40px 0; }

[data-reveal] { opacity: 0; transform: translateY(20px); transition: opacity 0.6s var(--ease-out), transform 0.6s var(--ease-out); transition-delay: calc(var(--i, 0) * 50ms); }
.pd.is-ready [data-reveal] { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { [data-reveal] { opacity: 1; transform: none; transition: none; } }

.pd-btn { display: inline-block; font-family: inherit; font-weight: 600; font-size: 16px; color: #fff; background: var(--blue); border: none; border-radius: var(--r-pill); padding: 14px 26px; cursor: pointer; text-decoration: none; text-align: center; transition: transform 0.16s var(--ease-out), background 0.16s var(--ease-out), box-shadow 0.16s var(--ease-out); box-shadow: 0 10px 26px -12px rgba(46, 112, 221, 0.7); }
.pd-btn:active { transform: translateY(1px); }
@media (hover: hover) and (pointer: fine) { .pd-btn:hover { background: var(--blue-strong); transform: translateY(-2px); box-shadow: 0 16px 32px -14px rgba(46, 112, 221, 0.8); } }
.pd-btn--lg { padding: 16px 34px; font-size: 17px; }
.pd-btn--block { display: block; width: 100%; }

/* ── Hero ───────────────────────────────────────────────────────────────── */
.pd-hero { position: relative; padding: 56px 0 40px; overflow: hidden; }
.pd-blob { position: absolute; top: -200px; right: -160px; width: 600px; height: 600px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, rgba(84, 149, 243, 0.2), rgba(84, 149, 243, 0.05) 60%, transparent 72%); pointer-events: none; z-index: 0; }
.pd-hero > .pd-wrap { position: relative; z-index: 1; }
.pd-badge { display: inline-flex; align-items: center; gap: 9px; padding: 8px 16px; border-radius: var(--r-pill); background: var(--blue-tint); color: var(--blue-ink); font-weight: 600; font-size: 14px; }
.pd-badge__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--orange); box-shadow: 0 0 0 4px rgba(240, 145, 87, 0.22); }
.pd-hero__title { margin: 22px 0 0; font-weight: 800; font-size: clamp(2rem, 4.6vw, 3.4rem); line-height: 1.03; letter-spacing: -0.03em; }
.pd-hero__sub { margin: 18px 0 0; max-width: 58ch; font-size: 1.12rem; color: var(--ink-2); }

/* ── Tabs ───────────────────────────────────────────────────────────────── */
.pd-tabs { display: flex; gap: 10px; margin-bottom: 26px; flex-wrap: wrap; }
.pd-tab { display: inline-flex; align-items: center; gap: 8px; font-family: inherit; font-weight: 600; font-size: 15px; color: var(--ink-2); background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-pill); padding: 10px 20px; cursor: pointer; transition: color 0.16s var(--ease-out), background 0.16s var(--ease-out), border-color 0.16s var(--ease-out); }
.pd-tab__n { font-size: 12px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
@media (hover: hover) and (pointer: fine) { .pd-tab:hover { border-color: var(--blue-soft); color: var(--ink); } }
.pd-tab.is-on { background: var(--blue); border-color: var(--blue); color: #fff; }
.pd-tab.is-on .pd-tab__n { color: rgba(255, 255, 255, 0.75); }

/* ── Club cards ─────────────────────────────────────────────────────────── */
.pd-cards--clubs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; }
.pd-club { display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); overflow: hidden; transition: transform 0.22s var(--ease-out), box-shadow 0.22s var(--ease-out), border-color 0.22s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .pd-club:hover { transform: translateY(-4px); box-shadow: var(--shadow); border-color: rgba(46, 112, 221, 0.4); } }
.pd-club__cover { position: relative; width: 100%; aspect-ratio: 16 / 9; background: var(--blue-tint); }
.pd-club__cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pd-club__cover.is-empty { display: grid; place-items: center; }
.pd-club__cover-i { font-weight: 800; font-size: 2.2rem; color: var(--blue-ink); }
.pd-club__cover-badge { position: absolute; top: 12px; left: 12px; background: rgba(255, 255, 255, 0.94); box-shadow: 0 2px 10px -2px rgba(9, 23, 71, 0.3); }
.pd-club__body { display: flex; flex-direction: column; gap: 12px; padding: 20px 24px 24px; flex: 1; }
.pd-club__label { align-self: flex-start; padding: 5px 12px; border-radius: var(--r-pill); border: 1px solid var(--blue-soft); color: var(--blue-ink); font-weight: 600; font-size: 12px; }
.pd-access { padding: 5px 12px; border-radius: var(--r-pill); font-weight: 600; font-size: 12px; }
.pd-access.is-active { color: var(--green); background: var(--green-tint); }
.pd-club__t { margin: 0; font-weight: 700; font-size: 1.2rem; line-height: 1.24; letter-spacing: -0.01em; }
.pd-club__d { margin: 0; color: var(--ink-2); font-size: 1rem; line-height: 1.45; flex: 1; }
.pd-club__foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.pd-club__subs { display: inline-flex; align-items: center; gap: 8px; color: var(--ink-3); font-size: 0.9rem; }
.pd-club__subs svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.pd-club__price { font-weight: 700; font-size: 1.1rem; color: var(--orange-ink); white-space: nowrap; }
.pd-club__price .per { font-weight: 500; font-size: 0.82rem; color: var(--ink-3); }
.pd-club__body .pd-btn { margin-top: 4px; }

/* ── Empty ──────────────────────────────────────────────────────────────── */
.pd-empty { text-align: center; padding: 30px 0; color: var(--ink-2); }
.pd-empty__mascot { display: block; width: 130px; height: auto; margin: 0 auto 16px; }
.pd-empty p { margin: 0 0 20px; font-size: 1.1rem; }

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 960px) { .pd-cards--clubs { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 900px) { .pd-wrap { padding-inline: 22px; } .pd-section { padding: 44px 0 64px; } }
@media (max-width: 620px) { .pd-cards--clubs { grid-template-columns: minmax(0, 1fr); } }
</style>
