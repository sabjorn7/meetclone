<template>
    <div v-if="target" ref="host" class="pd-preview-slot">
        <a v-if="preview" class="pd-preview" :class="{ 'pd-preview--mine': mine }" :href="preview.href" target="_blank" rel="noopener noreferrer">
            <img v-if="preview.image && !imageFailed" class="pd-preview__image" :src="preview.image" alt="" loading="lazy" crossorigin="anonymous" referrerpolicy="no-referrer" @error="imageFailed = true" />
            <span v-else class="pd-preview__image pd-preview__placeholder" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 8H6a4 4 0 0 0 0 8h3m6-8h3a4 4 0 0 1 0 8h-3M8 12h8" /></svg>
            </span>
            <span class="pd-preview__body">
                <span class="pd-preview__title">{{ preview.title }}</span>
                <span class="pd-preview__meta">{{ typeLabel }}<template v-if="detail"> · {{ detail }}</template></span>
                <span v-if="preview.description" class="pd-preview__description">{{ preview.description }}</span>
                <span class="pd-preview__action">{{ preview.type === 'profile' ? 'Перейти' : 'Подробнее' }}<span aria-hidden="true"> →</span></span>
            </span>
        </a>
    </div>
</template>
<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { firstInternalChatLink } from '../helpers/internalChatLinks.js';
import { loadChatPreview } from '../helpers/chatPreviewData.js';
const props = defineProps({ text: { type: String, default: '' }, mine: Boolean });
const host = ref(null), preview = ref(null), imageFailed = ref(false);
const target = computed(() => firstInternalChatLink(props.text));
const names = { course: 'Курс', event: 'Мероприятие', club: 'Клуб', stream: 'Трансляция', profile: 'Профиль' };
const typeLabel = computed(() => names[preview.value?.type] || '');
const detail = computed(() => preview.value?.startsAt ? new Date(preview.value.startsAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : preview.value?.status || '');
let observer, revision = 0, mounted = false;
async function prepare() {
    const version = ++revision;
    observer?.disconnect(); preview.value = null; imageFailed.value = false;
    const item = target.value;
    if (!mounted || !item) return;
    await nextTick();
    if (!mounted || version !== revision) return;
    const load = async () => {
        observer?.disconnect();
        const data = await loadChatPreview(item);
        if (mounted && version === revision) preview.value = data;
    };
    if (typeof IntersectionObserver === 'undefined') { load(); return; }
    observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) load(); }, { rootMargin: '150px' });
    if (host.value) observer.observe(host.value);
}
onMounted(() => { mounted = true; prepare(); });
watch(target, prepare);
onBeforeUnmount(() => { mounted = false; revision++; observer?.disconnect(); });
</script>
<style scoped>
.pd-preview-slot { min-width: 0; }
.pd-preview { display: flex; gap: 10px; width: 310px; max-width: 100%; box-sizing: border-box; margin-top: 9px; padding: 9px; border: 1px solid var(--line, #dce2ee); border-radius: 12px; background: var(--bg-tint, #f1f6fd); color: var(--ink, #091747); text-decoration: none; }
.pd-preview--mine { background: #fff; border-color: transparent; }
.pd-preview__image { flex: 0 0 58px; width: 58px; height: 68px; object-fit: cover; border-radius: 7px; }
.pd-preview__placeholder { display: grid; place-items: center; background: #e5edfa; color: #335882; }
.pd-preview__placeholder svg { width: 25px; height: 25px; }
.pd-preview__body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.pd-preview__title, .pd-preview__description { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; }
.pd-preview__title { font-size: 0.86rem; font-weight: 650; line-height: 1.3; }
.pd-preview__meta { font-size: 0.7rem; line-height: 1.4; color: #4c5b75; overflow-wrap: anywhere; }
.pd-preview__description { font-size: 0.77rem; line-height: 1.4; color: #3e4d68; }
.pd-preview__action { margin-top: 2px; font-size: 0.75rem; line-height: 1.4; font-weight: 600; color: #1f5fc9; }
.pd-preview:hover .pd-preview__action { text-decoration: underline; }
.pd-preview:focus-visible { outline: 2px solid var(--blue, #2e70dd); outline-offset: 3px; }
@media (max-width: 420px) { .pd-preview { gap: 8px; padding: 8px; } .pd-preview__image { flex-basis: 44px; width: 44px; height: 56px; } }
</style>
