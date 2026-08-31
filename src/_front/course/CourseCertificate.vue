<!--
  CourseCertificate.vue — course-completion certificate. Left decorative Memphis panel (all shapes live
  here, in MeetGuru brand blue #2e70dd/#5495f3 + orange #f09157/#ff7a1a), clean left-aligned text on the
  right. Presentational only. Props:
    name       — student full name
    course     — course title
    issuer     — course owner (school/org or author) — shown as author + signature
    issuerLogo — kept for API compatibility (unused in this layout)
    date       — issue date (already formatted, ru)
    certNo     — deterministic MG-XXXX-XXXX number
  Rendered at a FIXED design size (960×679, A4-landscape 297:210) so html2canvas captures it consistently.
-->
<template>
    <div ref="root" class="mgc">
        <!-- left decorative panel: every Memphis shape lives here so the text side stays clean -->
        <div class="mgc__panel">
            <svg class="mgc__art" viewBox="0 0 300 659" preserveAspectRatio="none" aria-hidden="true">
                <!-- top hatch -->
                <g stroke="#0e1630" stroke-width="2" stroke-linecap="round"><path d="M42 92l46 46"/><path d="M50 86l46 46"/><path d="M58 80l46 46"/><path d="M66 74l46 46"/><path d="M74 68l46 46"/></g>
                <!-- blue edge bar, orange + blue vertical bars -->
                <rect x="-10" y="188" width="86" height="32" rx="6" fill="#2e70dd"/>
                <rect x="150" y="24" width="44" height="196" rx="22" fill="#f09157"/>
                <rect x="206" y="42" width="26" height="118" rx="13" fill="#5495f3"/>
                <rect x="150" y="244" width="74" height="26" rx="6" fill="#cfe0fb"/>
                <!-- outline circle + filled tint circle -->
                <circle cx="112" cy="336" r="46" fill="none" stroke="#0e1630" stroke-width="2"/>
                <circle cx="150" cy="356" r="32" fill="#bcd4f7"/>
                <!-- blue hook (mid) -->
                <path d="M58 470V408q0-26 26-26h60" fill="none" stroke="#5495f3" stroke-width="38" stroke-linecap="round"/>
                <!-- orange hook (bottom) -->
                <path d="M46 632V556q0-32 34-32h74" fill="none" stroke="#f09157" stroke-width="48" stroke-linecap="round"/>
                <!-- accents: small blue circle, tint bar, orange rect, vertical lines, bottom hatch -->
                <circle cx="244" cy="452" r="15" fill="#2e70dd"/>
                <rect x="-10" y="548" width="74" height="28" rx="6" fill="#cfe0fb"/>
                <rect x="196" y="596" width="58" height="44" rx="6" fill="#ff7a1a"/>
                <g stroke="#0e1630" stroke-width="2" stroke-linecap="round"><path d="M28 582v70"/><path d="M38 582v70"/></g>
                <g stroke="#0e1630" stroke-width="2" stroke-linecap="round"><path d="M150 540l40 40"/><path d="M158 534l40 40"/><path d="M166 528l40 40"/><path d="M174 522l40 40"/></g>
            </svg>
        </div>

        <!-- content -->
        <div class="mgc__body">
            <span class="mgc__word">meetguru<span class="mgc__dot">.</span></span>

            <h1 class="mgc__title">СЕРТИФИКАТ</h1>
            <div class="mgc__kicker">О&nbsp;ПРОХОЖДЕНИИ&nbsp;КУРСА</div>
            <span class="mgc__dots"></span>

            <p class="mgc__pre">настоящим подтверждается, что</p>
            <p class="mgc__name"><span class="mgc__hl">{{ name || 'Пользователь' }}</span></p>

            <p class="mgc__pre mgc__pre--2">успешно прошёл(а) курс</p>
            <p class="mgc__course">«{{ course || 'Курс' }}»</p>

            <footer class="mgc__foot">
                <div class="mgc__sig">
                    <span class="mgc__circle" aria-hidden="true"></span>
                    <svg class="mgc__scribble" viewBox="0 0 190 44" aria-hidden="true">
                        <path d="M6 28c12-26 22-26 25-4 2 15 8 16 13 2 4-11 11-11 14 3 3 13 7 13 12-1 3-9 10-10 15 2 2 9 6 10 12 5 6-7 14-14 25-11 9 3 15 10 26 6"
                              fill="none" stroke="#0e1630" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span class="mgc__fline"></span>
                    <span class="mgc__flb">АВТОР КУРСА</span>
                    <span class="mgc__flv">{{ issuer || 'МитГуру' }}</span>
                </div>
                <div class="mgc__meta">
                    <span class="mgc__date">{{ date }}</span>
                    <span class="mgc__fline"></span>
                    <span class="mgc__flb">ДАТА ВЫДАЧИ</span>
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
    --ink: #0e1630; --ink-2: #55607a; --blue: #2e70dd; --blue-soft: #5495f3; --orange: #f09157; --orange-hl: rgba(240,145,87,0.5);
    width: 960px; height: 679px; /* A4 landscape 297:210 */
    background: #ffffff; color: var(--ink); position: relative; overflow: hidden;
    font-family: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
    box-sizing: border-box; border: 5px solid var(--blue);
}
.mgc *, .mgc *::before, .mgc *::after { box-sizing: border-box; }

/* left panel */
.mgc__panel { position: absolute; left: 0; top: 0; bottom: 0; width: 306px; background: #f6efe3; border-right: 2px solid var(--ink); overflow: hidden; }
.mgc__art { position: absolute; inset: 0; width: 100%; height: 100%; }

/* content */
.mgc__body { position: absolute; left: 306px; right: 0; top: 0; bottom: 0; display: flex; flex-direction: column; padding: 52px 56px 46px 54px; text-align: left; }
.mgc__word { position: absolute; top: 26px; right: 56px; font-weight: 800; font-size: 16px; letter-spacing: -0.01em; color: var(--ink); }
.mgc__dot { color: var(--blue); }

.mgc__title { margin: 0; font-weight: 800; font-size: 50px; line-height: 0.95; letter-spacing: 0.05em; color: var(--ink); }
.mgc__kicker { margin-top: 6px; font-weight: 600; font-size: 15px; letter-spacing: 0.30em; color: var(--ink); }
.mgc__dots { display: block; width: 84px; height: 0; margin-top: 12px; border-bottom: 3px dotted var(--ink); opacity: 0.7; }

.mgc__pre { margin: 30px 0 0; font-style: italic; font-weight: 700; font-size: 12.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-2); }
.mgc__pre--2 { margin-top: 26px; }
.mgc__name { margin: 12px 0 0; font-weight: 800; font-size: 38px; line-height: 1.12; letter-spacing: 0.02em; color: var(--ink); text-transform: uppercase; }
.mgc__hl { background-image: linear-gradient(transparent 54%, var(--orange-hl) 54%, var(--orange-hl) 92%, transparent 92%); padding: 0 6px 0 2px; -webkit-box-decoration-break: clone; box-decoration-break: clone; }

.mgc__course { margin: 10px 0 0; font-weight: 800; font-size: 23px; line-height: 1.3; color: var(--blue); border-bottom: 2px solid var(--ink); padding-bottom: 8px; max-width: 540px; }

/* footer: author signature (left) + date/number (right) */
.mgc__foot { margin-top: auto; display: flex; align-items: flex-end; gap: 40px; }
.mgc__sig { position: relative; display: flex; flex-direction: column; align-items: flex-start; width: 250px; }
.mgc__circle { position: absolute; left: 4px; top: -6px; width: 66px; height: 66px; border-radius: 50%; background: var(--orange); opacity: 0.9; }
.mgc__scribble { position: relative; width: 150px; height: 36px; }
.mgc__fline { display: block; width: 100%; height: 0; border-bottom: 2px solid var(--ink); margin-top: 2px; }
.mgc__flb { margin-top: 7px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.16em; color: var(--ink-2); }
.mgc__flv { margin-top: 3px; font-size: 13px; font-weight: 700; color: var(--ink); line-height: 1.25; max-width: 250px; }
.mgc__meta { display: flex; flex-direction: column; align-items: flex-start; width: 190px; }
.mgc__date { font-weight: 800; font-size: 17px; color: var(--ink); padding-bottom: 8px; }
.mgc__flv--no { color: var(--orange); }
</style>
