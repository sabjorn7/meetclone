<!--
  CourseCertificate.vue — the printable course-completion certificate (MeetGuru pd-* brand language).
  Presentational only. Props:
    name       — student full name
    course     — course title
    issuer     — who ran the course (course owner: a school/org or author) — shown as identity + signature
    issuerLogo — issuer's logo/avatar URL (Supabase storage, served with CORS); falls back to initials
    date       — issue date (already formatted, ru)
    certNo     — deterministic MG-XXXX-XXXX number
  Rendered at a FIXED design size (960×679, A4-landscape 297:210) so html2canvas captures it consistently;
  downloadCertificatePdf() in certificate.js turns this node into an A4-landscape PDF. Used by the /cert-demo
  preview and, offscreen, by MyCoursePage + CoursePage.
-->
<template>
    <div ref="root" class="mgc">
        <div class="mgc__frame">
            <!-- corner flourishes -->
            <svg v-for="pos in ['tl','tr','bl','br']" :key="pos" class="mgc__corner" :class="`mgc__corner--${pos}`" viewBox="0 0 60 60" aria-hidden="true">
                <path d="M2 2h34M2 2v34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M10 2v10M2 10h10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                <circle cx="2" cy="2" r="2.4" fill="currentColor"/>
            </svg>

            <div class="mgc__body">
                <!-- platform header -->
                <header class="mgc__head">
                    <img class="mgc__logo" src="/images/512-favicon.png" alt="" crossorigin="anonymous" />
                    <span class="mgc__word">meetguru<span class="mgc__dot">.</span></span>
                </header>

                <!-- main -->
                <div class="mgc__main">
                    <h1 class="mgc__title">СЕРТИФИКАТ</h1>
                    <p class="mgc__sub">настоящим подтверждается, что</p>

                    <p class="mgc__name">{{ name || 'Пользователь' }}</p>
                    <span class="mgc__rule"></span>

                    <p class="mgc__line">успешно прошёл(а) курс</p>
                    <p class="mgc__course">«{{ course || 'Курс' }}»</p>
                </div>

                <!-- issuer signature (left) · official stamp (right) -->
                <footer class="mgc__foot">
                    <div class="mgc__sign">
                        <svg class="mgc__scribble" viewBox="0 0 210 52" aria-hidden="true">
                            <path d="M6 34c14-30 24-30 27-6 2 17 9 18 14 2 4-13 12-13 15 3 3 15 8 15 13-1 3-11 11-12 16 2 2 10 7 12 13 5 6-8 15-16 27-13 10 3 16 12 28 6 8-4 20-16 39-24"
                                  fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span class="mgc__sign-rule"></span>
                        <div class="mgc__party">
                            <span v-if="issuerLogo" class="mgc__party-logo"><img :src="issuerLogo" alt="" crossorigin="anonymous" /></span>
                            <span v-else class="mgc__party-logo mgc__party-logo--txt">{{ initials }}</span>
                            <span class="mgc__party-text">
                                <span class="mgc__party-name">{{ issuer || 'МитГуру' }}</span>
                                <span class="mgc__party-role">Организатор курса</span>
                            </span>
                        </div>
                    </div>

                    <div class="mgc__stamp" aria-hidden="true">
                        <span class="mgc__stamp-ring"></span>
                        <span class="mgc__stamp-in">
                            <svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            <span class="mgc__stamp-t1">MEETGURU</span>
                            <span class="mgc__stamp-t2">ПОДТВЕРЖДЕНО</span>
                        </span>
                    </div>
                </footer>

                <p class="mgc__meta">Выдан {{ date }}<span class="mgc__meta-sep">·</span>№&nbsp;{{ certNo }}</p>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
    name: { type: String, default: '' },
    course: { type: String, default: '' },
    issuer: { type: String, default: '' },
    issuerLogo: { type: String, default: '' },
    date: { type: String, default: '' },
    certNo: { type: String, default: '' },
});
const initials = computed(() => {
    const parts = String(props.issuer || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'МГ';
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
});
const root = ref(null);
defineExpose({ root });
</script>

<style scoped>
.mgc {
    --ink: #091747; --blue: #2e70dd; --ink-2: #5b6472; --ink-3: #98a0ad; --gold: #c79a3e; --gold-soft: #f0a641; --stamp: #2b5aa6;
    width: 960px; height: 679px; /* A4 landscape 297:210 */
    background: #ffffff; color: var(--ink);
    font-family: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
    box-sizing: border-box; padding: 26px; position: relative; overflow: hidden;
}
.mgc *, .mgc *::before, .mgc *::after { box-sizing: border-box; }
.mgc::before {
    content: ''; position: absolute; right: -120px; bottom: -160px; width: 520px; height: 520px;
    background: radial-gradient(circle, rgba(46, 112, 221, 0.05), transparent 70%); border-radius: 50%;
}
.mgc__frame { position: relative; width: 100%; height: 100%; border: 2px solid var(--ink); border-radius: 4px; }
.mgc__frame::after { content: ''; position: absolute; inset: 7px; border: 1px solid var(--gold); border-radius: 2px; pointer-events: none; }
.mgc__corner { position: absolute; width: 40px; height: 40px; color: var(--gold); }
.mgc__corner--tl { top: 14px; left: 14px; }
.mgc__corner--tr { top: 14px; right: 14px; transform: scaleX(-1); }
.mgc__corner--bl { bottom: 14px; left: 14px; transform: scaleY(-1); }
.mgc__corner--br { bottom: 14px; right: 14px; transform: scale(-1); }

.mgc__body { position: absolute; inset: 7px; display: flex; flex-direction: column; padding: 30px 60px 26px; text-align: center; }

.mgc__head { display: inline-flex; align-items: center; justify-content: center; gap: 9px; }
.mgc__logo { width: 34px; height: 34px; object-fit: contain; }
.mgc__word { font-weight: 800; font-size: 22px; letter-spacing: -0.02em; color: var(--ink); }
.mgc__dot { color: var(--blue); }

.mgc__main { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.mgc__title { margin: 0; font-weight: 800; font-size: 38px; letter-spacing: 0.22em; color: var(--ink); padding-left: 0.22em; }
.mgc__sub { margin: 12px 0 0; font-size: 15px; color: var(--ink-2); letter-spacing: 0.02em; }
.mgc__name { margin: 18px 0 0; font-weight: 800; font-size: 48px; line-height: 1.05; color: var(--blue); letter-spacing: -0.02em; }
.mgc__rule { display: block; width: 260px; height: 3px; margin: 13px auto 0; border-radius: 3px; background: linear-gradient(90deg, transparent, var(--gold-soft) 22%, var(--gold-soft) 78%, transparent); }
.mgc__line { margin: 18px 0 0; font-size: 15px; color: var(--ink-2); }
.mgc__course { margin: 9px 0 0; font-weight: 700; font-size: 23px; line-height: 1.25; color: var(--ink); max-width: 640px; }

.mgc__foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; }
/* signature */
.mgc__sign { display: flex; flex-direction: column; align-items: flex-start; text-align: left; min-width: 250px; }
.mgc__scribble { width: 168px; height: 42px; color: var(--blue); margin-left: 8px; opacity: 0.9; }
.mgc__sign-rule { display: block; width: 240px; height: 1.5px; background: var(--ink); opacity: 0.35; margin: 2px 0 9px; }
.mgc__party { display: flex; align-items: center; gap: 10px; }
.mgc__party-logo { width: 40px; height: 40px; border-radius: 50%; overflow: hidden; flex: none; border: 1px solid #e4e9f1; background: #f2f6fd; display: grid; place-items: center; }
.mgc__party-logo img { width: 100%; height: 100%; object-fit: cover; }
.mgc__party-logo--txt { font-weight: 800; font-size: 15px; color: var(--blue); }
.mgc__party-text { display: flex; flex-direction: column; }
.mgc__party-name { font-weight: 700; font-size: 15px; color: var(--ink); line-height: 1.2; max-width: 300px; }
.mgc__party-role { font-size: 12px; color: var(--ink-3); }
/* stamp */
.mgc__stamp { position: relative; width: 108px; height: 108px; flex: none; transform: rotate(-8deg); color: var(--stamp); margin-bottom: 4px; }
.mgc__stamp-ring { position: absolute; inset: 0; border-radius: 50%; border: 2.5px solid currentColor; opacity: 0.55; }
.mgc__stamp-ring::after { content: ''; position: absolute; inset: 6px; border-radius: 50%; border: 1.5px dashed currentColor; }
.mgc__stamp-in { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; opacity: 0.62; }
.mgc__stamp-in svg { width: 26px; height: 22px; }
.mgc__stamp-t1 { font-weight: 800; font-size: 12px; letter-spacing: 0.14em; padding-left: 0.14em; }
.mgc__stamp-t2 { font-weight: 700; font-size: 7.5px; letter-spacing: 0.16em; padding-left: 0.16em; }

.mgc__meta { margin: 14px 0 0; font-size: 12px; color: var(--ink-3); font-weight: 600; letter-spacing: 0.02em; text-align: center; }
.mgc__meta-sep { margin: 0 9px; opacity: 0.6; }
</style>
