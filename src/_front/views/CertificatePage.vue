<!--
  CertificatePage.vue — DEMO at /cert-demo. Preview of the course certificate + one-click PDF download,
  with editable sample fields so the design can be reviewed before wiring the button into MyCoursePage +
  CoursePage. Not linked from anywhere; it's the design proof.
-->
<template>
    <main class="pd">
        <section class="pd-section">
            <div class="pd-wrap">
                <h1 class="pd-h1">Сертификат — предпросмотр</h1>
                <p class="pd-lead">Демо дизайна и генерации PDF. Отредактируйте поля, чтобы увидеть с разными данными, и нажмите «Скачать PDF».</p>

                <div class="pd-fields">
                    <label class="pd-f"><span>Имя</span><input v-model="name" type="text" /></label>
                    <label class="pd-f"><span>Курс</span><input v-model="course" type="text" /></label>
                    <label class="pd-f"><span>Автор</span><input v-model="author" type="text" /></label>
                </div>

                <div class="pd-actions">
                    <button type="button" class="pd-btn" :disabled="busy" @click="download">
                        <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/></svg>
                        {{ busy ? 'Готовим PDF…' : 'Скачать PDF' }}
                    </button>
                    <span class="pd-note">№ {{ certNo }} · {{ dateStr }}</span>
                </div>

                <div class="pd-preview">
                    <CourseCertificate ref="cert" :name="name" :course="course" :author="author" :date="dateStr" :certNo="certNo" />
                </div>
            </div>
        </section>
    </main>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import CourseCertificate from '@/_front/course/CourseCertificate.vue';
import { certNumber, certDate, downloadCertificatePdf, certFilename } from '@/_front/course/certificate.js';

const name = ref('Иван Петров');
const course = ref('Основы пальпации. Пётр Лебедев');
const author = ref('Пётр Лебедев');
const dateStr = certDate();
const certNo = certNumber('12a60a4f-5ca9-4dbe-ac0c-f21ef584e6f5'); // sample user_course id
const cert = ref(null);
const busy = ref(false);

async function download() {
    if (busy.value) return;
    busy.value = true;
    try {
        await downloadCertificatePdf(cert.value?.root, certFilename(course.value));
    } finally {
        busy.value = false;
    }
}

onMounted(() => {
    if (document.getElementById('pd-fonts')) return;
    const l = document.createElement('link');
    l.id = 'pd-fonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
});
</script>

<style scoped>
.pd { --ink: #091747; --ink-2: #5b6472; --ink-3: #98a0ad; --line: #e4e9f1; --blue: #2e70dd; --blue-strong: #2360c6; --blue-tint: #eaf1fe;
    background: #f1f6fd; color: var(--ink); font-family: 'Onest', system-ui, sans-serif; min-height: 100vh; }
.pd * { box-sizing: border-box; }
.pd-section { padding: 40px 0 90px; }
.pd-wrap { width: 100%; max-width: 1040px; margin-inline: auto; padding-inline: 24px; }
.pd-h1 { margin: 0; font-weight: 800; font-size: 1.9rem; letter-spacing: -0.02em; }
.pd-lead { margin: 8px 0 22px; color: var(--ink-2); max-width: 70ch; }
.pd-fields { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
.pd-f { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 220px; }
.pd-f span { font-size: 0.85rem; font-weight: 600; color: var(--ink-2); }
.pd-f input { border: 1px solid var(--line); border-radius: 12px; padding: 10px 13px; font-family: inherit; font-size: 0.96rem; background: #fff; color: var(--ink); }
.pd-f input:focus { outline: none; border-color: #5495f3; box-shadow: 0 0 0 3px var(--blue-tint); }
.pd-actions { display: flex; align-items: center; gap: 16px; margin-bottom: 26px; flex-wrap: wrap; }
.pd-btn { display: inline-flex; align-items: center; gap: 8px; border: 0; border-radius: 999px; background: var(--blue); color: #fff; font-family: inherit; font-weight: 700; font-size: 0.98rem; padding: 12px 24px; cursor: pointer; transition: background 0.15s, transform 0.15s; }
.pd-btn .pd-ic { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.pd-btn:disabled { opacity: 0.6; cursor: default; }
.pd-btn:not(:disabled):hover { background: var(--blue-strong); transform: translateY(-1px); }
.pd-note { color: var(--ink-3); font-size: 0.9rem; font-weight: 600; }
.pd-preview { display: flex; justify-content: center; overflow-x: auto; padding: 20px; background: #fff; border: 1px solid var(--line); border-radius: 18px; box-shadow: 0 20px 50px -30px rgba(9, 23, 71, 0.3); }
</style>
