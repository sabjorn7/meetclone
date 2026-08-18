<!--
  AppFooter.vue — reusable MeetGuru site footer (extracted from PromoDemoPage, Phase 0).
  Self-contained styles + tokens. Prop: note (optional bottom-line note, e.g. a demo tag).
-->
<template>
    <footer class="mgf">
        <div class="mgf__top">
            <div class="mgf__brand">
                <a class="mgf__logo" href="/" @click.prevent="go('/')">meetguru<span>.</span></a>
                <p class="mgf__note">Образовательная платформа по прикладной кинезиологии. Курсы, трансляции и семинары.</p>
            </div>
            <nav class="mgf__cols" aria-label="Навигация в подвале">
                <div class="mgf__col" v-for="col in columns" :key="col.title">
                    <h4>{{ col.title }}</h4>
                    <a v-for="l in col.links" :key="l.path" :href="l.path" @click.prevent="go(l.path)">{{ l.label }}</a>
                </div>
            </nav>
        </div>
        <div class="mgf__bottom">
            <span>© {{ year }} МитГуру</span>
            <span v-if="note" class="mgf__demo">{{ note }}</span>
        </div>
    </footer>
</template>

<script setup>
import { useRouter } from 'vue-router';

defineProps({ note: { type: String, default: '' } });

const router = useRouter();
const year = 2026;
function go(path) { router.push(path); }

const columns = [
    { title: 'Курсы', links: [{ label: 'Все курсы', path: '/all_course' }, { label: 'Трансляции', path: '/streams' }, { label: 'Клуб', path: '/club' }] },
    { title: 'Поддержка', links: [{ label: 'Вопросы и ответы', path: '/faq' }, { label: 'Контакты', path: '/contacts' }] },
    { title: 'Компания', links: [{ label: 'О нас', path: '/about_meet' }, { label: 'Приветствие', path: '/welcome' }] },
    { title: 'Документы', links: [{ label: 'Политика', path: '/politica' }, { label: 'Оферта', path: '/oferta' }, { label: 'Согласие', path: '/soglasie' }] },
];
</script>

<style scoped>
.mgf {
    --ink: #091747; --blue-soft: #5495f3; --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    background: var(--ink); color: rgba(255, 255, 255, 0.7); padding: 56px 0 40px;
    font-family: 'Onest', system-ui, -apple-system, sans-serif;
}
.mgf__top, .mgf__bottom { width: 100%; max-width: 1200px; margin-inline: auto; padding-inline: 40px; }
.mgf__top { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr); gap: 48px; padding-bottom: 36px; border-bottom: 1px solid rgba(255, 255, 255, 0.12); }
.mgf__logo { display: inline-block; font-weight: 800; font-size: 1.4rem; letter-spacing: -0.03em; color: #fff; text-decoration: none; }
.mgf__logo span { color: var(--blue-soft); }
.mgf__note { margin: 12px 0 0; font-size: 0.95rem; color: rgba(255, 255, 255, 0.5); max-width: 34ch; }
.mgf__cols { display: grid; grid-template-columns: repeat(4, 1fr); gap: 28px; }
.mgf__col h4 { margin: 0 0 12px; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255, 255, 255, 0.5); }
.mgf__col a { display: block; padding: 5px 0; color: rgba(255, 255, 255, 0.8); text-decoration: none; font-size: 0.95rem; transition: color 0.18s var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .mgf__col a:hover { color: var(--blue-soft); } }
.mgf__bottom { display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap; margin-top: 24px; font-size: 0.88rem; color: rgba(255, 255, 255, 0.45); }
@media (max-width: 900px) {
    .mgf__top { grid-template-columns: 1fr; gap: 28px; padding-inline: 22px; }
    .mgf__bottom { padding-inline: 22px; }
    .mgf__cols { grid-template-columns: repeat(2, 1fr); gap: 24px; }
}
@media (max-width: 560px) { .mgf__cols { grid-template-columns: 1fr; } }
</style>
