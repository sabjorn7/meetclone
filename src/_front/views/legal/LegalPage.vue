<!--
  Shared renderer for the hand-written legal pages (/politica, /oferta, /soglasie).
  Content-only: the shared AppHeader/AppFooter are rendered globally by App.vue. Content is
  pre-converted HTML (pandoc → cleaned) passed in as `docs`; multiple docs render as tabs (/oferta).
-->
<template>
    <div class="lp">
        <main class="lp-main">
            <h1 class="lp-title">{{ title }}</h1>

            <div v-if="docs.length > 1" class="lp-tabs" role="tablist">
                <button
                    v-for="(d, i) in docs"
                    :key="i"
                    class="lp-tab"
                    :class="{ active: i === active }"
                    role="tab"
                    :aria-selected="i === active"
                    @click="active = i"
                >
                    {{ d.label }}
                </button>
            </div>

            <article class="lp-prose" v-html="docs[active].html"></article>

            <nav class="lp-links" aria-label="Юридические документы">
                <a href="/politica">Политика конфиденциальности</a>
                <a href="/oferta">Оферта</a>
                <a href="/soglasie">Согласие на обработку ПД</a>
            </nav>
        </main>
    </div>
</template>

<script setup>
import { ref } from 'vue';

defineProps({
    title: { type: String, required: true },
    // [{ label, html }]. One item → no tabs; many → tabbed.
    docs: { type: Array, required: true },
});

const active = ref(0);
</script>

<style scoped>
.lp {
    min-height: calc(100vh - 62px); /* #app already reserves 62px for the fixed AppHeader */
    background: #f6f7f9;
    color: #1f2733;
    font-family: 'Raleway', system-ui, -apple-system, sans-serif;
}
.lp-main {
    max-width: 900px;
    margin: 0 auto;
    padding: 8px 20px 64px;
}
.lp-title {
    font-size: 26px;
    line-height: 1.25;
    margin: 8px 0 20px;
}
.lp-tabs {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 20px;
    border-bottom: 1px solid #e3e7ee;
}
.lp-tab {
    appearance: none;
    border: none;
    background: transparent;
    padding: 10px 14px;
    font: inherit;
    font-weight: 600;
    color: #5b6472;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
}
.lp-tab:hover { color: #2e6fd6; }
.lp-tab.active {
    color: #2e6fd6;
    border-bottom-color: #2e6fd6;
}

/* Document body (v-html) — content isn't scoped, so target via :deep(). */
.lp-prose {
    background: #fff;
    border: 1px solid #e9edf2;
    border-radius: 12px;
    padding: 28px 32px;
    line-height: 1.6;
    font-size: 15px;
    overflow-wrap: break-word;
}
.lp-prose :deep(h1),
.lp-prose :deep(h2) {
    font-size: 19px;
    line-height: 1.3;
    margin: 28px 0 12px;
    font-weight: 700;
}
.lp-prose :deep(h2):first-child,
.lp-prose :deep(h1):first-child { margin-top: 0; }
.lp-prose :deep(h3) {
    font-size: 16px;
    margin: 20px 0 10px;
    font-weight: 700;
}
.lp-prose :deep(p) { margin: 0 0 12px; }
.lp-prose :deep(ol),
.lp-prose :deep(ul) { margin: 0 0 12px; padding-left: 26px; }
.lp-prose :deep(li) { margin: 4px 0; }
.lp-prose :deep(li > p) { margin: 0 0 6px; }
.lp-prose :deep(a) { color: #2e6fd6; overflow-wrap: anywhere; }
.lp-prose :deep(u) { text-decoration: underline; }
/* Neutralize Word review highlights (keep the text, drop the yellow). */
.lp-prose :deep(mark),
.lp-prose :deep(.mark) { background: transparent; color: inherit; }
.lp-prose :deep(strong) { font-weight: 700; }
/* Real data tables. */
.lp-prose :deep(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 16px 0;
    font-size: 14px;
    display: block;
    overflow-x: auto;
}
.lp-prose :deep(th),
.lp-prose :deep(td) {
    border: 1px solid #d6dbe3;
    padding: 8px 10px;
    text-align: left;
    vertical-align: top;
}
.lp-prose :deep(thead th) { background: #f0f3f8; }

.lp-links {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
    margin-top: 24px;
    font-size: 14px;
}
.lp-links a { color: #5b6472; text-decoration: none; }
.lp-links a:hover { color: #2e6fd6; text-decoration: underline; }

@media (max-width: 600px) {
    .lp-prose { padding: 20px 16px; }
    .lp-title { font-size: 22px; }
}
</style>
