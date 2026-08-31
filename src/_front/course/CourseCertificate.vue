<!--
  CourseCertificate.vue — the printable course-completion certificate (MeetGuru pd-* brand language).
  Presentational only: pass name / course / author / date / certNo. Rendered at a FIXED design size
  (960×679, A4-landscape 297:210) so html2canvas captures it consistently; downloadCertificatePdf() in
  certificate.js turns this node into an A4-landscape PDF. Used by the /cert-demo preview and, offscreen,
  by MyCoursePage + CoursePage.
-->
<template>
    <div ref="root" class="mgc">
        <!-- double frame -->
        <div class="mgc__frame">
            <!-- corner flourishes -->
            <svg v-for="pos in ['tl','tr','bl','br']" :key="pos" class="mgc__corner" :class="`mgc__corner--${pos}`" viewBox="0 0 60 60" aria-hidden="true">
                <path d="M2 2h34M2 2v34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M10 2v10M2 10h10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                <circle cx="2" cy="2" r="2.4" fill="currentColor"/>
            </svg>

            <div class="mgc__body">
                <div class="mgc__brand">
                    <img class="mgc__logo" src="/images/512-favicon.png" alt="" crossorigin="anonymous" />
                    <span class="mgc__word">meetguru<span class="mgc__dot">.</span></span>
                </div>

                <h1 class="mgc__title">СЕРТИФИКАТ</h1>
                <p class="mgc__sub">настоящим подтверждается, что</p>

                <p class="mgc__name">{{ name || 'Пользователь' }}</p>
                <span class="mgc__rule"></span>

                <p class="mgc__line">успешно прошёл(а) курс</p>
                <p class="mgc__course">«{{ course || 'Курс' }}»</p>
                <p v-if="author" class="mgc__author">Автор курса: {{ author }}</p>

                <div class="mgc__foot">
                    <span class="mgc__foot-i">Выдан {{ date }}</span>
                    <span class="mgc__seal" aria-hidden="true">
                        <svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </span>
                    <span class="mgc__foot-i mgc__foot-i--r">№&nbsp;{{ certNo }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';

defineProps({
    name: { type: String, default: '' },
    course: { type: String, default: '' },
    author: { type: String, default: '' },
    date: { type: String, default: '' },
    certNo: { type: String, default: '' },
});
const root = ref(null);
defineExpose({ root });
</script>

<style scoped>
.mgc {
    --ink: #091747; --blue: #2e70dd; --ink-2: #5b6472; --ink-3: #98a0ad; --gold: #c79a3e; --gold-soft: #f0a641;
    width: 960px; height: 679px; /* A4 landscape 297:210 */
    background: #ffffff; color: var(--ink);
    font-family: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
    box-sizing: border-box; padding: 26px; position: relative; overflow: hidden;
}
.mgc *, .mgc *::before, .mgc *::after { box-sizing: border-box; }
/* faint watermark */
.mgc::before {
    content: ''; position: absolute; right: -120px; bottom: -160px; width: 520px; height: 520px;
    background: radial-gradient(circle, rgba(46, 112, 221, 0.05), transparent 70%); border-radius: 50%;
}
.mgc__frame { position: relative; width: 100%; height: 100%; border: 2px solid var(--ink); border-radius: 4px; }
.mgc__frame::after {
    content: ''; position: absolute; inset: 7px; border: 1px solid var(--gold); border-radius: 2px; pointer-events: none;
}
.mgc__corner { position: absolute; width: 40px; height: 40px; color: var(--gold); }
.mgc__corner--tl { top: 14px; left: 14px; }
.mgc__corner--tr { top: 14px; right: 14px; transform: scaleX(-1); }
.mgc__corner--bl { bottom: 14px; left: 14px; transform: scaleY(-1); }
.mgc__corner--br { bottom: 14px; right: 14px; transform: scale(-1); }

.mgc__body {
    position: absolute; inset: 7px; display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 44px 70px; text-align: center;
}
.mgc__brand { display: inline-flex; align-items: center; gap: 10px; margin-bottom: 26px; }
.mgc__logo { width: 40px; height: 40px; object-fit: contain; }
.mgc__word { font-weight: 800; font-size: 26px; letter-spacing: -0.02em; color: var(--ink); }
.mgc__dot { color: var(--blue); }

.mgc__title { margin: 0; font-weight: 800; font-size: 40px; letter-spacing: 0.22em; color: var(--ink); padding-left: 0.22em; }
.mgc__sub { margin: 12px 0 0; font-size: 15px; color: var(--ink-2); letter-spacing: 0.02em; }

.mgc__name { margin: 22px 0 0; font-weight: 800; font-size: 52px; line-height: 1.05; color: var(--blue); letter-spacing: -0.02em; }
.mgc__rule { display: block; width: 260px; height: 3px; margin: 14px auto 0; border-radius: 3px; background: linear-gradient(90deg, transparent, var(--gold-soft) 22%, var(--gold-soft) 78%, transparent); }

.mgc__line { margin: 22px 0 0; font-size: 16px; color: var(--ink-2); }
.mgc__course { margin: 10px 0 0; font-weight: 700; font-size: 24px; line-height: 1.25; color: var(--ink); max-width: 660px; }
.mgc__author { margin: 12px 0 0; font-size: 15px; color: var(--ink-2); }

.mgc__foot { position: absolute; left: 70px; right: 70px; bottom: 40px; display: flex; align-items: center; justify-content: space-between; }
.mgc__foot-i { font-size: 13px; color: var(--ink-3); font-weight: 600; letter-spacing: 0.01em; min-width: 200px; }
.mgc__foot-i--r { text-align: right; }
.mgc__seal { width: 54px; height: 54px; border-radius: 50%; border: 2px solid var(--gold); color: var(--gold); display: grid; place-items: center; flex: none; box-shadow: inset 0 0 0 4px rgba(199, 154, 62, 0.12); }
.mgc__seal svg { width: 26px; height: 26px; }
</style>
