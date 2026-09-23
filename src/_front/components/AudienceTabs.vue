<!--
  AudienceTabs.vue — the "Присоединяйся к сообществу" 3-tab block (Специалист / Спикер / Учебное
  заведение). Shared by the main LandingPage and the /onas page. Self-contained (own tokens + styles);
  router-optional like LandingPage (no router in the standalone meetgu.ru build → links go to the app
  host). data-reveal elements are revealed by the host page's IntersectionObserver.
-->
<template>
    <section class="pd-audience">
        <div class="pd-wrap">
            <div class="pd-head" data-reveal>
                <h2 class="pd-h2">{{ heading }}</h2>
                <p class="pd-head__note">Платформа работает для всех сторон обучения — выберите свою роль.</p>
            </div>
            <div class="pd-tabs" data-reveal>
                <div class="pd-tabs__row" role="tablist" aria-label="Роли на платформе">
                    <button
                        v-for="(t, i) in tabs"
                        :key="t.key"
                        class="pd-tab"
                        :class="{ 'is-active': activeTab === i }"
                        type="button"
                        role="tab"
                        :aria-selected="activeTab === i ? 'true' : 'false'"
                        @click="activeTab = i"
                    >
                        <span class="pd-tab__ic" v-html="t.icon" aria-hidden="true"></span>
                        {{ t.label }}
                    </button>
                </div>
                <div class="pd-tabs__panel" role="tabpanel">
                    <p class="pd-tabs__text">{{ tabs[activeTab].text }}</p>
                    <a class="pd-ghost" :href="tabs[activeTab].href" @click.prevent="go(tabs[activeTab].href)">
                        {{ tabs[activeTab].cta }}
                        <svg viewBox="0 0 24 24" class="pd-ic" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                    </a>
                </div>
            </div>
        </div>
    </section>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

defineProps({ heading: { type: String, default: 'Присоединяйся к сообществу' } });

// Router is present in the app build but NOT in the standalone meetgu.ru landing build — guard it.
let router = null;
try { router = useRouter(); } catch (e) { router = null; }
function go(path) { if (router) router.push(path); else window.location.href = 'https://app.meetgu.ru' + path; }

const I = (body) => `<svg viewBox="0 0 24 24" class="pd-ic" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const tabs = [
    {
        key: 'specialist', label: 'Специалист',
        icon: I('<path d="M6 3v5a5 5 0 0 0 10 0V3"/><path d="M6 3H4M16 3h2M11 18v-5"/><circle cx="18" cy="16" r="3"/><path d="M18 13v-2"/>'),
        href: '/all_course', cta: 'Смотреть курсы',
        text: 'Проходите курсы у ведущих практиков и заполняйте профиль специалиста — вас увидят пациенты в каталоге сообщества и смогут к вам записаться.',
    },
    {
        key: 'speaker', label: 'Спикер',
        icon: I('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"/>'),
        href: '/registration', cta: 'Стать спикером',
        text: 'Хотите делиться своими знаниями и зарабатывать на этом? У нас вы найдёте идеальные условия для создания и продажи ваших курсов.',
    },
    {
        key: 'school', label: 'Учебное заведение',
        icon: I('<path d="M4 21V9l8-5 8 5v12M9 21v-6h6v6"/>'),
        href: '/registration', cta: 'Оставить заявку',
        text: 'Расширьте доступ к вашим образовательным продуктам и привлекайте больше специалистов с помощью нашей платформы.',
    },
];
const activeTab = ref(0);
</script>

<style scoped>
.pd-audience {
    --ink: #091747; --ink-2: #5b6472; --ink-3: #98a0ad; --line: #e4e9f1; --surface: #fff;
    --blue: #2e70dd; --blue-soft: #5495f3; --blue-ink: #1f5fc9; --blue-tint: #eaf1fe;
    --r-lg: 26px; --r-md: 16px; --r-pill: 999px;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --shadow-sm: 0 4px 16px -8px rgba(9, 23, 71, 0.18);
    --wrap: 1200px;
    padding: 84px 0;
    color: var(--ink);
    font-family: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
}
.pd-audience *, .pd-audience *::before, .pd-audience *::after { box-sizing: border-box; }
.pd-wrap { width: 100%; max-width: var(--wrap); margin-inline: auto; padding-inline: 40px; }
.pd-ic { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; display: block; }
.pd-h2 { margin: 0 0 12px; font-weight: 700; font-size: clamp(1.9rem, 4vw, 3rem); line-height: 1.06; letter-spacing: -0.02em; }
.pd-head { margin-bottom: 34px; }
.pd-head__note { margin: 0; color: var(--ink-2); }

[data-reveal] { opacity: 0; transform: translateY(20px); transition: opacity 0.6s var(--ease-out), transform 0.6s var(--ease-out); }
[data-reveal].is-in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { [data-reveal] { opacity: 1; transform: none; transition: none; } }

.pd-ghost { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 16px; color: var(--ink); text-decoration: none; padding: 8px 4px; transition: gap 0.18s var(--ease-out), color 0.18s var(--ease-out); cursor: pointer; }
.pd-ghost .pd-ic { width: 20px; height: 20px; }
@media (hover: hover) and (pointer: fine) { .pd-ghost:hover { color: var(--blue-ink); gap: 12px; } }

.pd-tabs__row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 22px; }
.pd-tab { display: inline-flex; align-items: center; gap: 10px; font-family: inherit; font-weight: 600; font-size: 1rem; color: var(--ink-2); background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-pill); padding: 12px 22px; cursor: pointer; transition: color 0.18s var(--ease-out), border-color 0.18s var(--ease-out), background 0.18s var(--ease-out); }
.pd-tab__ic { display: grid; place-items: center; color: var(--blue-ink); }
.pd-tab__ic :deep(.pd-ic) { width: 20px; height: 20px; }
.pd-tab.is-active { color: #fff; background: var(--blue); border-color: var(--blue); }
.pd-tab.is-active .pd-tab__ic { color: #fff; }
@media (hover: hover) and (pointer: fine) { .pd-tab:not(.is-active):hover { border-color: var(--blue-soft); color: var(--ink); } }
.pd-tabs__panel { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 34px 36px; box-shadow: var(--shadow-sm); }
.pd-tabs__text { margin: 0 0 18px; font-size: 1.16rem; color: var(--ink-2); max-width: 68ch; }

@media (max-width: 900px) {
    .pd-audience { padding: 58px 0; }
    .pd-wrap { padding-inline: 22px; }
    .pd-tabs__panel { padding: 26px 24px; }
}
@media (max-width: 560px) {
    .pd-tab { flex: 1 1 auto; justify-content: center; }
}
</style>
