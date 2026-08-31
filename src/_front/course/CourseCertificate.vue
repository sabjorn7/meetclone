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
        <!-- left decorative panel: abstract "graduate" illustration -->
        <div class="mgc__panel">
            <img class="mgc__illus" src="/images/cert-graduate.png" alt="" crossorigin="anonymous" />
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

            <span class="mgc__dots mgc__dots--2"></span>
            <p class="mgc__desc">Документ подтверждает успешное прохождение курса на образовательной платформе МитГуру.</p>

            <footer class="mgc__foot">
                <div class="mgc__author">
                    <span v-if="issuerLogo" class="mgc__logo"><img :src="issuerLogo" alt="" crossorigin="anonymous" /></span>
                    <span v-else class="mgc__logo mgc__logo--txt">{{ initials }}</span>
                    <span class="mgc__atext">
                        <span class="mgc__flb">АВТОР КУРСА</span>
                        <span class="mgc__flv">{{ issuer || 'МитГуру' }}</span>
                    </span>
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
    --ink: #0e1630; --ink-2: #55607a; --blue: #2e70dd; --blue-soft: #5495f3; --orange: #f09157; --orange-hl: rgba(240,145,87,0.5);
    width: 960px; height: 679px; /* A4 landscape 297:210 */
    background: #ffffff; color: var(--ink); position: relative; overflow: hidden;
    font-family: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
    box-sizing: border-box; border: 5px solid var(--blue);
}
.mgc *, .mgc *::before, .mgc *::after { box-sizing: border-box; }

/* left panel */
.mgc__panel { position: absolute; left: 0; top: 0; bottom: 0; width: 306px; background: #f6efe3; border-right: 2px solid var(--ink); overflow: hidden; display: grid; place-items: center; }
.mgc__illus { width: 92%; height: auto; object-fit: contain; }

/* content */
.mgc__body { position: absolute; left: 306px; right: 0; top: 0; bottom: 0; display: flex; flex-direction: column; padding: 52px 56px 46px 54px; text-align: left; }
.mgc__word { position: absolute; top: 26px; right: 56px; font-weight: 800; font-size: 16px; letter-spacing: -0.01em; color: var(--ink); }
.mgc__dot { color: var(--blue); }

.mgc__title { margin: 0; font-weight: 800; font-size: 50px; line-height: 0.95; letter-spacing: 0.05em; color: var(--ink); }
.mgc__kicker { margin-top: 6px; font-weight: 600; font-size: 15px; letter-spacing: 0.30em; color: var(--ink); }
.mgc__dots { display: block; width: 84px; height: 0; margin-top: 12px; border-bottom: 3px dotted var(--ink); opacity: 0.7; }

.mgc__pre { margin: 30px 0 0; font-style: italic; font-weight: 700; font-size: 12.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-2); }
.mgc__pre--2 { margin-top: 26px; }
.mgc__name { margin: 12px 0 0; font-weight: 800; font-size: 38px; line-height: 1.12; letter-spacing: 0.02em; color: var(--ink); text-transform: uppercase; overflow-wrap: anywhere; }
.mgc__hl { background-image: linear-gradient(transparent 54%, var(--orange-hl) 54%, var(--orange-hl) 92%, transparent 92%); padding: 0 6px 0 2px; -webkit-box-decoration-break: clone; box-decoration-break: clone; }

.mgc__course { margin: 10px 0 0; font-weight: 800; font-size: 23px; line-height: 1.3; color: var(--blue); border-bottom: 2px solid var(--ink); padding-bottom: 8px; max-width: 540px; overflow-wrap: anywhere; }
.mgc__dots--2 { margin-top: 24px; }
.mgc__desc { margin: 16px 0 0; font-size: 13.5px; line-height: 1.62; color: var(--ink-2); max-width: 430px; }

/* footer: author (logo + name, left) + date/number (right) */
.mgc__foot { margin-top: auto; display: flex; align-items: flex-end; justify-content: space-between; gap: 30px; }
.mgc__author { display: flex; align-items: center; gap: 12px; width: 260px; }
.mgc__logo { width: 48px; height: 48px; border-radius: 50%; overflow: hidden; flex: none; border: 1px solid #e0d8c8; background: #fff; display: grid; place-items: center; }
.mgc__logo img { width: 100%; height: 100%; object-fit: cover; }
.mgc__logo--txt { font-weight: 800; font-size: 16px; color: var(--blue); }
.mgc__atext { display: flex; flex-direction: column; }
.mgc__fline { display: block; width: 100%; height: 0; border-bottom: 2px solid var(--ink); margin-top: 2px; }
.mgc__flb { margin-top: 6px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.16em; color: var(--ink-2); }
.mgc__atext .mgc__flb { margin-top: 0; }
.mgc__flv { margin-top: 3px; font-size: 13px; font-weight: 700; color: var(--ink); line-height: 1.25; max-width: 210px; }
.mgc__meta { display: flex; flex-direction: column; align-items: flex-start; width: 190px; }
.mgc__date { font-weight: 800; font-size: 17px; color: var(--ink); padding-bottom: 8px; }
.mgc__flv--no { color: var(--orange); margin-top: 7px; }
</style>
