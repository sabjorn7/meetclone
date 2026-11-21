<template><template v-for="(part, index) in parts" :key="index"><a v-if="part.href" class="pd-msg__link" :href="part.href" target="_blank" rel="noopener noreferrer">{{ part.text }}</a><template v-else>{{ part.text }}</template></template></template>
<script setup>
import { computed } from 'vue';
import { messageLinks } from '../helpers/messageLinks.js';
const props = defineProps({ text: { type: String, default: '' } });
const parts = computed(() => messageLinks(props.text));
</script>
<style scoped>
.pd-msg__link { color: inherit; text-decoration: underline; text-decoration-thickness: 1.5px; text-underline-offset: 3px; overflow-wrap: anywhere; }
.pd-msg__link:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; border-radius: 2px; }
</style>
