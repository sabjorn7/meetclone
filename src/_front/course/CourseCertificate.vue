<!--
  CourseCertificate.vue — course-completion certificate, Memphis style in MeetGuru brand colours
  (blue #2e70dd/#5495f3 + orange #f09157/#ff7a1a — the same two colours used across /course, /profile,
  promo). Organic blobs + playful decor as the background; clean text hierarchy on the white centre band.
  Presentational only. Props:
    name       — student full name
    course     — course title
    issuer     — who ran the course (course owner: school/org or author) — shown as author + signature
    issuerLogo — issuer logo URL (unused in this layout; kept for API compatibility)
    date       — issue date (already formatted, ru)
    certNo     — deterministic MG-XXXX-XXXX number
  Rendered at a FIXED design size (960×679, A4-landscape 297:210) so html2canvas captures it consistently.
-->
<template>
    <div ref="root" class="mgc">
        <!-- decorative background: all Memphis blobs + accents in one SVG so html2canvas rasterizes it cleanly -->
        <svg class="mgc__bg" viewBox="0 0 960 679" preserveAspectRatio="none" aria-hidden="true">
            <!-- top-left blue blob -->
            <path fill="#5495f3" d="M-40-40C120-55 236 25 205 150c-18 74 44 104 20 176-19 58 24 104-40 150-84 60-190 34-235-40V-40Z"/>
            <!-- top-left: graduation emblem (orange "head" circle wearing a blue mortarboard + orange tassel) -->
            <circle fill="#f09157" cx="250" cy="146" r="62"/>
            <path fill="#5495f3" d="M214 104q36-4 72 0l-6 20q-30 8-60 0Z"/>
            <polygon fill="#2e70dd" points="168,86 250,60 332,86 250,112"/>
            <circle fill="#ff7a1a" cx="250" cy="83" r="5"/>
            <path fill="none" stroke="#ff7a1a" stroke-width="3.5" stroke-linecap="round" d="M250 83l74-6v44"/>
            <circle fill="#ff7a1a" cx="324" cy="125" r="7.5"/>
            <!-- little dotted arc + cross accent -->
            <path stroke="#0e1630" stroke-width="6" stroke-linecap="round" d="M158 78l22 22M180 78l-22 22"/>
            <!-- top-right deep blue blob -->
            <path fill="#2e70dd" d="M600-40c120 30 150 128 268 138 92 8 132-36 172 40v-218H600Zm40 300c-70-30-108-96-70-150 30-42 92-30 150 6 44 28 96 10 150-20V210c-52 66-150 92-230 50Z"/>
            <!-- white lines on the blue blob -->
            <g stroke="#ffffff" stroke-width="4.5" stroke-linecap="round"><path d="M812 262h108"/><path d="M826 292h96"/><path d="M818 322h84"/></g>
            <!-- orange dot cluster, mid-right -->
            <g fill="#f09157"><circle cx="828" cy="452" r="6"/><circle cx="858" cy="440" r="3.5"/><circle cx="852" cy="474" r="4.5"/><circle cx="884" cy="462" r="3"/><circle cx="812" cy="480" r="3"/><circle cx="882" cy="430" r="2.5"/><circle cx="840" cy="500" r="2.5"/><circle cx="806" cy="452" r="2.5"/></g>
            <!-- left vertical bullet dots -->
            <g fill="#f09157"><circle cx="58" cy="516" r="5"/><circle cx="58" cy="546" r="5"/><circle cx="58" cy="576" r="5"/><circle cx="58" cy="606" r="5"/><circle cx="58" cy="636" r="5"/></g>
            <!-- bottom-left orange squiggle -->
            <path fill="none" stroke="#ff7a1a" stroke-width="6.5" stroke-linecap="round" d="M70 566c-22 16-14 40 6 46 22 7 30-18 8-26-20-7-40 16-30 40 8 20 34 22 52 10"/>
            <!-- bottom-centre blue zigzag -->
            <path fill="none" stroke="#5495f3" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" d="M430 648l22-30 22 30 22-30 22 30 22-30 22 30"/>
            <!-- bottom-right blobs: light-blue behind, orange front -->
            <path fill="#eaf1fe" d="M770 560c60-40 150-30 190 20 40 52 24 118-40 138-70 22-150-6-176-70-18-44-16-64 26-108Z"/>
            <path fill="#f09157" d="M900 596c48-14 70 34 46 70-22 34-78 30-96-8-14-30 8-50 50-62Z"/>
        </svg>

        <!-- content -->
        <div class="mgc__inner">
            <header class="mgc__top">
                <span class="mgc__word">meetguru<span class="mgc__dot">.</span></span>
                <div class="mgc__titlewrap">
                    <span class="mgc__vline"></span>
                    <div class="mgc__titlecol">
                        <h1 class="mgc__title">СЕРТИФИКАТ</h1>
                        <span class="mgc__kicker">О&nbsp;ПРОХОЖДЕНИИ&nbsp;КУРСА</span>
                    </div>
                </div>
            </header>

            <div class="mgc__main">
                <p class="mgc__sub">настоящим подтверждается, что</p>
                <p class="mgc__name">{{ name || 'Пользователь' }}</p>
                <span class="mgc__dotline"></span>
                <p class="mgc__line">успешно прошёл(а) курс</p>
                <p class="mgc__course">«{{ course || 'Курс' }}»</p>
            </div>

            <footer class="mgc__foot">
                <div class="mgc__col mgc__col--l">
                    <svg class="mgc__scribble" viewBox="0 0 210 46" aria-hidden="true">
                        <path d="M6 30c14-28 24-28 27-5 2 16 9 17 14 2 4-12 12-12 15 3 3 14 8 14 13-1 3-10 11-11 16 2 2 9 7 11 13 5 6-7 15-15 27-12 10 3 16 11 28 6 8-4 20-15 39-22"
                              fill="none" stroke="#0e1630" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span class="mgc__fline"></span>
                    <span class="mgc__flb">Автор курса</span>
                    <span class="mgc__flv">{{ issuer || 'МитГуру' }}</span>
                </div>
                <div class="mgc__col mgc__col--r">
                    <span class="mgc__fdate">{{ date }}</span>
                    <span class="mgc__fline"></span>
                    <span class="mgc__flb">Дата выдачи</span>
                    <span class="mgc__flv mgc__flv--no">№&nbsp;{{ certNo }}</span>
                </div>
            </footer>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';

defineProps({
    name: { type: String, default: '' },
    course: { type: String, default: '' },
    issuer: { type: String, default: '' },
    issuerLogo: { type: String, default: '' },
    date: { type: String, default: '' },
    certNo: { type: String, default: '' },
});
const root = ref(null);
defineExpose({ root });
</script>

<style scoped>
.mgc {
    --ink: #0e1630; --ink-2: #55607a; --blue: #2e70dd; --blue-soft: #5495f3; --orange: #f09157;
    width: 960px; height: 679px; /* A4 landscape 297:210 */
    background: #ffffff; color: var(--ink); position: relative; overflow: hidden;
    font-family: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
    box-sizing: border-box;
}
.mgc *, .mgc *::before, .mgc *::after { box-sizing: border-box; }
.mgc__bg { position: absolute; inset: 0; width: 100%; height: 100%; }

.mgc__inner { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; padding: 40px 150px 44px; text-align: center; }

/* header */
.mgc__top { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.mgc__word { font-weight: 800; font-size: 17px; letter-spacing: -0.01em; color: var(--ink); }
.mgc__dot { color: var(--blue); }
.mgc__titlewrap { display: inline-flex; align-items: stretch; gap: 16px; }
.mgc__vline { width: 3px; border-radius: 3px; background: var(--ink); }
.mgc__titlecol { display: flex; flex-direction: column; align-items: flex-start; gap: 7px; }
.mgc__title { margin: 0; font-weight: 800; font-size: 46px; line-height: 0.92; letter-spacing: 0.16em; padding-left: 0.16em; color: var(--ink); }
.mgc__kicker { align-self: stretch; background: var(--ink); color: #fff; font-weight: 700; font-size: 11px; letter-spacing: 0.34em; padding: 5px 0 5px 0.34em; text-align: center; }

/* main */
.mgc__main { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; }
.mgc__sub { margin: 0; font-size: 16px; font-weight: 600; color: var(--ink-2); letter-spacing: 0.01em; }
.mgc__name { margin: 20px 0 0; font-weight: 800; font-size: 50px; line-height: 1; letter-spacing: 0.04em; color: var(--ink); text-transform: uppercase; }
.mgc__dotline { display: block; width: 62%; max-width: 460px; height: 0; margin: 16px auto 0; border-bottom: 3px dotted var(--ink); opacity: 0.85; }
.mgc__line { margin: 26px 0 0; font-size: 15px; font-weight: 600; color: var(--ink-2); }
.mgc__course { margin: 8px 0 0; font-weight: 800; font-size: 24px; line-height: 1.25; color: var(--blue); max-width: 560px; }

/* footer: signature (left) + date/number (right), both on dotted rules */
.mgc__foot { display: flex; align-items: flex-end; justify-content: space-between; width: 100%; }
.mgc__col { display: flex; flex-direction: column; align-items: center; width: 230px; }
.mgc__scribble { width: 150px; height: 40px; }
.mgc__fdate { font-weight: 800; font-size: 17px; color: var(--ink); padding-bottom: 6px; }
.mgc__fline { width: 100%; height: 0; border-bottom: 2px dotted var(--ink); opacity: 0.55; margin-top: 2px; }
.mgc__flb { margin-top: 7px; font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-2); }
.mgc__flv { margin-top: 3px; font-size: 13px; font-weight: 700; color: var(--ink); max-width: 230px; line-height: 1.25; }
.mgc__flv--no { color: var(--orange); letter-spacing: 0.02em; }
</style>
