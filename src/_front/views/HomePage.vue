<!--
  HomePage.vue — the logged-in home ("/") in the MeetGuru promo (pd-*) brand language. Overrides the
  WeWeb Home page. Content-only — the shared AppHeader/AppFooter come from App.vue.

  Preserves the WeWeb functionality 1:1 (only the visuals change):
    - Greeting "Здравствуйте, {users.Name}!"
    - "Вы смотрели недавно" — the last opened course (users.last_open)
    - "Ваши курсы" — user_course rows, each with an access badge (Доступ до … · осталось N дн. /
      Доступ истёк …) and a "Продлить" CTA for expired ones.
    - Access gate (verified from the WeWeb hc-gate): a course is EXPIRED when
        end_period && day(end_period) != day(created_at) && end_period < now && course.DurationLong != 0
      Active courses route to /my_courses (the lesson player + its gate live there, UNTOUCHED); expired
      courses route to /course/<slug||id> (the course page already offers "Продлить за X₽"). Home never
      opens a player itself, so the gate stays intact wherever it is enforced.
-->
<template>
    <main class="pd" :class="{ 'is-ready': ready }">
        <!-- ── HERO: greeting + recently-viewed ──────────────────── -->
        <header class="pd-hero">
            <div class="pd-blob" aria-hidden="true"></div>
            <div class="pd-wrap">
                <!-- Приветствие -->
                <div class="pd-hgreet">
                    <span class="pd-badge" data-reveal><span class="pd-badge__dot" aria-hidden="true"></span>Личный кабинет</span>
                    <h1 class="pd-hhero__title" data-reveal>Здравствуйте<template v-if="name">, {{ name }}</template>!</h1>
                    <p class="pd-hhero__sub" data-reveal>{{ courses.length ? 'Продолжайте обучение — ваши курсы ниже.' : 'Начните обучение: выберите курс в каталоге.' }}</p>
                    <a v-if="!courses.length" class="pd-btn pd-btn--lg" href="/all_course" data-reveal>Перейти в каталог</a>
                </div>

                <!-- Две одинаковые панели: недавнее + ближайшие мероприятия -->
                <div v-if="recent || upcoming.length" class="pd-hcards">
                    <aside v-if="recent" class="pd-panel pd-recent" data-reveal>
                        <div class="pd-panel__head"><span class="pd-panel__eyebrow">Вы смотрели недавно</span></div>
                        <div class="pd-recent__media" :class="{ 'is-empty': !recentEmbed }">
                            <iframe v-if="recentEmbed" :src="recentEmbed" title="Видео курса" frameborder="0" allow="fullscreen" allowfullscreen loading="lazy"></iframe>
                            <img v-else src="/images/minime-06.png" alt="" aria-hidden="true" />
                        </div>
                        <span class="pd-course__cat">{{ recent.course.Category || 'Курс' }}</span>
                        <h2 class="pd-recent__title">{{ recent.course.Title }}</h2>
                        <div class="pd-recent__foot">
                            <span class="pd-access" :class="recent.expired ? 'is-expired' : 'is-active'">{{ accessText(recent) }}</span>
                            <a v-if="recent.expired" class="pd-btn pd-btn--sm" :href="courseHref(recent.course)">Продлить</a>
                            <a v-else class="pd-btn pd-btn--sm" :href="watchHref(recent)">Продолжить</a>
                        </div>
                    </aside>

                    <section v-if="upcoming.length" class="pd-panel pd-evpanel" data-reveal>
                        <div class="pd-panel__head">
                            <span class="pd-panel__eyebrow">Ближайшие мероприятия</span>
                            <a class="pd-panel__link" href="/events">Все →</a>
                        </div>
                        <div class="pd-evlist">
                            <a v-for="ev in upcoming" :key="ev.id" class="pd-evrow" :href="eventHref(ev)">
                                <div class="pd-evrow__cover">
                                    <img v-if="ev.cover_url" :src="ev.cover_url" :alt="ev.title" loading="lazy" />
                                    <div v-else class="pd-evrow__cover--empty" aria-hidden="true">🗓</div>
                                </div>
                                <div class="pd-evrow__body">
                                    <h3 class="pd-evrow__t">{{ ev.title }}</h3>
                                    <div v-if="ev.speaker" class="pd-evrow__meta">
                                        <svg class="pd-evrow__ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></svg>
                                        <span>{{ ev.speaker }}</span>
                                    </div>
                                    <div class="pd-evrow__meta">
                                        <svg class="pd-evrow__ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                                        <span>{{ fmtEventDate(ev.starts_at) }}</span>
                                    </div>
                                    <div v-if="ev.location" class="pd-evrow__meta">
                                        <svg class="pd-evrow__ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
                                        <span>{{ ev.location }}</span>
                                    </div>
                                </div>
                            </a>
                        </div>
                    </section>
                </div>
            </div>
        </header>

        <!-- ── ВАШИ КУРСЫ ────────────────────────────────────────── -->
        <section class="pd-section pd-section--tint">
            <div class="pd-wrap">
                <div class="pd-head">
                    <h2 class="pd-h2" data-reveal>Ваши курсы</h2>
                    <p v-if="courses.length" class="pd-head__note" data-reveal>{{ courses.length }} {{ courseWord(courses.length) }} на платформе.</p>
                </div>

                <div v-if="courses.length" class="pd-cards pd-cards--my">
                    <component
                        :is="c.expired ? 'article' : 'a'"
                        v-for="(c, i) in courses"
                        :key="c.id"
                        class="pd-mycard"
                        :class="{ 'is-expired': c.expired }"
                        :href="c.expired ? null : watchHref(c)"
                        data-reveal
                        :style="{ '--i': Math.min(i, 7) }"
                    >
                        <span class="pd-course__cat">{{ c.course.Category || 'Курс' }}</span>
                        <h3 class="pd-mycard__t">{{ c.course.Title }}</h3>
                        <div class="pd-mycard__foot">
                            <span class="pd-access" :class="c.expired ? 'is-expired' : 'is-active'">{{ accessText(c) }}</span>
                            <a v-if="c.expired" class="pd-btn pd-btn--sm" :href="courseHref(c.course)">Продлить</a>
                            <span v-else class="pd-mycard__go" aria-hidden="true">Смотреть →</span>
                        </div>
                    </component>
                </div>

                <div v-else-if="!loading" class="pd-empty">
                    <img class="pd-empty__mascot" src="/images/minime-06.png" alt="" aria-hidden="true" width="626" height="626" />
                    <p>У вас пока нет курсов.</p>
                    <a class="pd-btn pd-btn--lg" href="/all_course">Выбрать курс</a>
                </div>

                <p v-if="loading" class="pd-state">Загрузка…</p>
            </div>
        </section>
    </main>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { getSupabase, readStoredSession } from '@/_front/chrome/headerAccount.js';
import { embedUrl } from '@/_front/streams/peertubeLive.js';
import { listPublishedEvents } from '@/_front/streams/eventsApi.js';

const name = ref('');
const courses = ref([]);   // [{ id, course, end_period, created_at, expired }]
const recent = ref(null);  // { course, end_period, created_at, expired } | null
const upcoming = ref([]);  // nearest 1–2 future published events (empty ⇒ block hidden)
const loading = ref(true);
const ready = ref(false);

const recentEmbed = computed(() => (recent.value?.course?.video_id ? embedUrl(recent.value.course.video_id) : ''));

function courseWord(n) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return 'курсов';
    if (b > 1 && b < 5) return 'курса';
    if (b === 1) return 'курс';
    return 'курсов';
}
function courseHref(course) { return `/course/${course?.slug || course?.id}`; }
// Active course → open THAT course on /my_courses (it reads ?course=<id> to deep-link into the player).
function watchHref(c) { return `/my_courses?course=${c.course?.id}`; }
function eventHref(ev) { return ev.slug ? `/event/${ev.slug}` : `/events?event=${ev.id}`; }
function fmtEventDate(d) {
    const x = new Date(d);
    if (isNaN(x)) return '';
    return x.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
        + ', ' + x.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

// day-level date string (matches the WeWeb formatDate DD.MM.YY comparison in the gate)
function dayKey(d) {
    const x = new Date(d);
    return isNaN(x) ? '' : `${x.getDate()}.${x.getMonth()}.${x.getFullYear()}`;
}
function fmtDate(d) {
    const x = new Date(d);
    return isNaN(x) ? '' : x.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// EXACT WeWeb hc-gate: expired when end_period exists, its day differs from created_at's day, it is in
// the past, AND the course's DurationLong != 0 (0 = lifetime, never expires).
function isExpired(uc, course) {
    const ep = uc?.end_period;
    if (!ep) return false;
    if (dayKey(ep) === dayKey(uc?.created_at)) return false;      // no real expiry set
    if (Number(course?.DurationLong) === 0) return false;         // lifetime
    return new Date(ep) < new Date();
}

// badge text: expired → "Доступ истёк {date}"; active with a real expiry → "Доступ до {date} · осталось
// N дн."; active lifetime / no real expiry → "Доступ открыт".
function accessText(c) {
    if (c.expired) return `Доступ истёк ${fmtDate(c.end_period)}`;
    const ep = c.end_period;
    const real = ep && dayKey(ep) !== dayKey(c.created_at) && Number(c.course?.DurationLong) !== 0;
    if (!real) return 'Доступ открыт';
    const days = Math.max(0, Math.ceil((new Date(ep) - new Date()) / 86400000));
    return `Доступ до ${fmtDate(ep)} · осталось ${days} ${pl(days, ['день', 'дня', 'дней'])}`;
}
function pl(n, f) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return f[2];
    if (b > 1 && b < 5) return f[1];
    if (b === 1) return f[0];
    return f[2];
}

async function load() {
    const sb = getSupabase();
    const uid = readStoredSession()?.user?.id;
    if (!sb || !uid) { loading.value = false; return; }

    const { data: urows } = await sb.from('users').select('"Name", last_open').eq('id', uid).limit(1);
    const user = urows?.[0] || {};
    name.value = (user.Name || '').split(/\s+/)[0] || user.Name || '';

    // the user's course enrollments (one row per course access window)
    const { data: ucs } = await sb.from('user_course')
        .select('id, course, end_period, created_at')
        .eq('user', uid)
        .order('created_at', { ascending: false });
    const rows = ucs || [];

    // fetch the course details for every referenced course (enrollments + last_open) in one query
    const ids = [...new Set([...rows.map((r) => r.course).filter(Boolean), user.last_open].filter(Boolean))];
    let byId = {};
    if (ids.length) {
        const { data: cs } = await sb.from('course')
            .select('id, "Title", "Category", slug, "DurationLong", video_id, owner, "ModStatus"')
            .in('id', ids);
        // Exclude hidden backing courses (paid streams 'Трансляции' / events 'Мероприятия', all
        // 'Черновик') so they don't appear as broken "courses" (slug=null) in «Ваши курсы».
        byId = Object.fromEntries((cs || []).filter((c) => c.ModStatus !== 'Черновик').map((c) => [c.id, c]));
    }

    // "Ваши курсы": dedupe to one entry per course (keep the newest enrollment window)
    const seen = new Set();
    const list = [];
    for (const r of rows) {
        const course = byId[r.course];
        if (!course || seen.has(r.course)) continue;
        seen.add(r.course);
        list.push({ id: r.id, course, end_period: r.end_period, created_at: r.created_at, expired: isExpired(r, course) });
    }
    courses.value = list;

    // "Вы смотрели недавно": the last opened course, carrying its access state if the user owns it
    if (user.last_open && byId[user.last_open]) {
        recent.value = list.find((x) => x.course.id === user.last_open)
            || { course: byId[user.last_open], end_period: null, created_at: null, expired: false };
    }

    // "Ближайшие мероприятия": nearest FUTURE published events (public — block hidden when none).
    // listPublishedEvents already sorts by starts_at ↑, so filtered future events are nearest-first.
    try {
        const evs = await listPublishedEvents(sb);
        const now = Date.now();
        upcoming.value = (evs || []).filter((e) => e.starts_at && new Date(e.starts_at).getTime() > now).slice(0, 2);
        // enrich with speaker names (listPublishedEvents doesn't return speaker_id)
        const ids = upcoming.value.map((e) => e.id);
        if (ids.length) {
            const { data: erows } = await sb.from('events').select('id, speaker_id').in('id', ids);
            const spkIds = [...new Set((erows || []).map((r) => r.speaker_id).filter(Boolean))];
            let nameById = {};
            if (spkIds.length) {
                const { data: us } = await sb.from('users').select('id, "Name"').in('id', spkIds);
                nameById = Object.fromEntries((us || []).map((u) => [u.id, u.Name]));
            }
            const spkByEvent = Object.fromEntries((erows || []).map((r) => [r.id, nameById[r.speaker_id] || '']));
            upcoming.value = upcoming.value.map((e) => ({ ...e, speaker: spkByEvent[e.id] || '' }));
        }
    } catch (e) { upcoming.value = []; }

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
    --orange: #f09157; --orange-ink: #c2410c;
    --green: #157a38; --green-tint: #e7f6ec; --red: #de0030; --red-tint: #fdecef;
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
.pd-section { padding: 64px 0 88px; }
.pd-section--tint { background: var(--bg-tint); }
.pd-state { text-align: center; color: var(--ink-2); font-size: 1.05rem; padding: 40px 0; }

[data-reveal] { opacity: 0; transform: translateY(20px); transition: opacity 0.6s var(--ease-out), transform 0.6s var(--ease-out); transition-delay: calc(var(--i, 0) * 45ms); }
.pd.is-ready [data-reveal] { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { [data-reveal] { opacity: 1; transform: none; transition: none; } }

.pd-btn { display: inline-block; font-family: inherit; font-weight: 600; font-size: 16px; color: #fff; background: var(--blue); border: none; border-radius: var(--r-pill); padding: 14px 26px; cursor: pointer; text-decoration: none; text-align: center; transition: transform 0.16s var(--ease-out), background 0.16s var(--ease-out), box-shadow 0.16s var(--ease-out); box-shadow: 0 10px 26px -12px rgba(46, 112, 221, 0.7); }
.pd-btn:active { transform: translateY(1px); }
@media (hover: hover) and (pointer: fine) { .pd-btn:hover { background: var(--blue-strong); transform: translateY(-2px); box-shadow: 0 16px 32px -14px rgba(46, 112, 221, 0.8); } }
.pd-btn--lg { padding: 16px 34px; font-size: 17px; }
.pd-btn--sm { padding: 9px 18px; font-size: 14px; box-shadow: none; }
@media (hover: hover) and (pointer: fine) { .pd-btn--sm:hover { transform: translateY(-1px); box-shadow: none; } }

.pd-h2 { margin: 0; font-weight: 700; font-size: clamp(1.9rem, 4vw, 3rem); line-height: 1.06; letter-spacing: -0.02em; }
.pd-head { margin-bottom: 30px; }
.pd-head__note { margin: 10px 0 0; color: var(--ink-2); }
.pd-course__cat { align-self: flex-start; padding: 5px 12px; border-radius: var(--r-pill); background: var(--blue-tint); color: var(--blue-ink); font-weight: 600; font-size: 12px; }

/* ── Hero ───────────────────────────────────────────────────────────────── */
.pd-hero { position: relative; padding: 58px 0 52px; overflow: hidden; }
.pd-blob { position: absolute; top: -200px; left: -160px; width: 600px; height: 600px; border-radius: 50%; background: radial-gradient(circle at 60% 60%, rgba(84, 149, 243, 0.2), rgba(84, 149, 243, 0.04) 60%, transparent 72%); pointer-events: none; z-index: 0; }
.pd-hgreet { position: relative; z-index: 1; }
.pd-hcards { position: relative; z-index: 1; margin-top: 34px; display: flex; flex-wrap: wrap; gap: 22px; align-items: stretch; }
.pd-hcards > * { flex: 0 1 460px; min-width: 0; }
.pd-badge { display: inline-flex; align-items: center; gap: 9px; padding: 8px 16px; border-radius: var(--r-pill); background: var(--blue-tint); color: var(--blue-ink); font-weight: 600; font-size: 14px; }
.pd-badge__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--orange); box-shadow: 0 0 0 4px rgba(240, 145, 87, 0.22); }
.pd-hhero__title { margin: 22px 0 0; font-weight: 800; font-size: clamp(2.1rem, 5vw, 3.6rem); line-height: 1.02; letter-spacing: -0.03em; }
.pd-hhero__sub { margin: 18px 0 0; max-width: 46ch; font-size: 1.14rem; color: var(--ink-2); }
.pd-hgreet .pd-btn { margin-top: 26px; }

/* shared card panel (recently-viewed + upcoming events) */
.pd-panel { display: flex; flex-direction: column; gap: 10px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 15px; box-shadow: var(--shadow); }
.pd-panel__head { display: flex; align-items: baseline; gap: 12px; }
.pd-panel__eyebrow { font-weight: 600; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--orange-ink); }
.pd-panel__link { margin-left: auto; color: var(--blue); font-weight: 600; font-size: 0.85rem; text-decoration: none; white-space: nowrap; }
.pd-panel__link:hover { text-decoration: underline; }
.pd-recent__media { position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: var(--r-md); overflow: hidden; background: var(--ink); }
.pd-recent__media iframe { position: absolute; inset: 0; width: 100%; height: 100%; }
.pd-recent__media.is-empty { background: var(--bg-tint); display: grid; place-items: center; }
.pd-recent__media.is-empty img { width: 96px; height: auto; }
.pd-recent__title { margin: 2px 0 0; font-weight: 700; font-size: 1.2rem; line-height: 1.24; letter-spacing: -0.01em; }
.pd-recent__foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 4px; }

/* ── access badges ──────────────────────────────────────────────────────── */
.pd-access { font-weight: 600; font-size: 0.86rem; padding: 5px 11px; border-radius: var(--r-pill); }
.pd-access.is-active { color: var(--green); background: var(--green-tint); }
.pd-access.is-expired { color: var(--red); background: var(--red-tint); }

/* ── Ваши курсы grid ────────────────────────────────────────────────────── */
.pd-cards--my { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
.pd-mycard { display: flex; flex-direction: column; gap: 13px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); padding: 24px; text-decoration: none; color: inherit; transition: transform 0.22s var(--ease-out), box-shadow 0.22s var(--ease-out), border-color 0.22s var(--ease-out); }
a.pd-mycard { cursor: pointer; }
@media (hover: hover) and (pointer: fine) { a.pd-mycard:hover { transform: translateY(-4px); box-shadow: var(--shadow); border-color: rgba(46, 112, 221, 0.4); } }
.pd-mycard.is-expired { background: #fffafb; border-color: rgba(222, 0, 48, 0.18); }
.pd-mycard__t { margin: 0; font-weight: 600; font-size: 1.08rem; line-height: 1.28; letter-spacing: -0.01em; flex: 1; }
.pd-mycard__foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 2px; }
.pd-mycard__go { font-weight: 600; font-size: 0.92rem; color: var(--blue-ink); }
@media (hover: hover) and (pointer: fine) { a.pd-mycard:hover .pd-mycard__go { text-decoration: underline; } }

/* ── Empty ──────────────────────────────────────────────────────────────── */
.pd-empty { text-align: center; padding: 20px 0; color: var(--ink-2); }
.pd-empty__mascot { display: block; width: 130px; height: auto; margin: 0 auto 16px; }
.pd-empty p { margin: 0 0 20px; font-size: 1.1rem; }

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 980px) {
    .pd-cards--my { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 720px) { .pd-hcards > * { max-width: none; flex-basis: 100%; } }
@media (max-width: 900px) { .pd-wrap { padding-inline: 22px; } .pd-section { padding: 48px 0 64px; } }
@media (max-width: 560px) { .pd-cards--my { grid-template-columns: minmax(0, 1fr); } }

/* Ближайшие мероприятия — event rows inside the panel */
.pd-evpanel { }
.pd-evlist { display: flex; flex-direction: column; gap: 10px; margin-top: 2px; }
.pd-evrow { display: flex; align-items: center; gap: 12px; padding: 8px; border: 1px solid var(--line); border-radius: 12px; text-decoration: none; color: inherit; transition: border-color 0.18s var(--ease-out), box-shadow 0.18s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .pd-evrow:hover { border-color: rgba(46, 112, 221, 0.4); box-shadow: var(--shadow-sm); } }
.pd-evrow__cover { flex: 0 0 108px; aspect-ratio: 16 / 9; border-radius: 8px; overflow: hidden; background: var(--bg-tint); }
.pd-evrow__cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pd-evrow__cover--empty { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 22px; }
.pd-evrow__body { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.pd-evrow__t { margin: 0 0 2px; font-weight: 600; font-size: 0.92rem; line-height: 1.22; letter-spacing: -0.01em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pd-evrow__meta { display: flex; align-items: center; gap: 6px; color: var(--ink-2); font-size: 0.8rem; overflow: hidden; }
.pd-evrow__meta span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pd-evrow__ic { flex: none; width: 14px; height: 14px; stroke: var(--ink-3); fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
</style>
