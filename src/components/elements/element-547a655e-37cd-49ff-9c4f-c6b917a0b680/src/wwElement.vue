<template>
<div class="text-diff-container">
<div class="text-diff-columns">
<div class="text-diff-column old-version">
<div class="text-diff-header">{{ content.oldVersionTitle || 'Old Version' }}</div>
<div class="text-diff-content" v-html="oldVersionHtml"></div>
</div>
<div class="text-diff-column new-version">
<div class="text-diff-header">{{ content.newVersionTitle || 'New Version' }}</div>
<div class="text-diff-content" v-html="combinedVersionHtml"></div>
</div>
</div>
</div>
</template>

<script>
import { computed, ref, watch } from 'vue';
import * as diffLib from 'diff';

export default {
props: {
content: { type: Object, required: true },
uid: { type: String, required: true },
},
setup(props) {
// Check if we're in editor mode
const isEditing = computed(() => {
// eslint-disable-next-line no-unreachable
return false;
});

// Get the old and new text from content
const oldText = computed(() => props.content?.oldText || '');
const newText = computed(() => props.content?.newText || '');
const diffMode = computed(() => props.content?.diffMode || 'words');
const deletedTextColor = computed(() => props.content?.deletedTextColor || '#d32f2f');
const addedTextColor = computed(() => props.content?.addedTextColor || '#388e3c');
const showLineNumbers = computed(() => props.content?.showLineNumbers || false);

// Computed properties for the HTML with highlighted differences
const oldVersionHtml = ref('');
const combinedVersionHtml = ref('');

// Function to process the diff and generate HTML
const processDiff = () => {
try {
let differences;

// Use the selected diff mode
switch (diffMode.value) {
case 'chars':
differences = diffLib.diffChars(oldText.value, newText.value);
break;
case 'words':
differences = diffLib.diffWords(oldText.value, newText.value);
break;
case 'lines':
differences = diffLib.diffLines(oldText.value, newText.value);
break;
default:
differences = diffLib.diffWords(oldText.value, newText.value);
}

// Generate HTML for old version (original text)
let oldHtml = oldText.value;

// Generate HTML for combined version (showing both deleted and added text)
let combinedHtml = '';

differences.forEach(part => {
const value = part.value;
// Text present in old but not in new (deleted)
if (part.removed) {
combinedHtml += `<span class="text-diff-deleted" style="color: ${deletedTextColor.value}; text-decoration: line-through;">${value}</span>`;
}
// Text present in new but not in old (added)
else if (part.added) {
combinedHtml += `<span class="text-diff-added" style="color: ${addedTextColor.value};">${value}</span>`;
}
// Text present in both versions (unchanged)
else {
combinedHtml += value;
}
});

// Replace newlines with <br> for HTML display
oldHtml = oldHtml.replace(/\n/g, '<br>');
combinedHtml = combinedHtml.replace(/\n/g, '<br>');

// Add line numbers if enabled
if (showLineNumbers.value) {
oldHtml = addLineNumbers(oldHtml);
combinedHtml = addLineNumbers(combinedHtml);
}

oldVersionHtml.value = oldHtml;
combinedVersionHtml.value = combinedHtml;
} catch (error) {
console.error('Error processing diff:', error);
oldVersionHtml.value = oldText.value.replace(/\n/g, '<br>');
combinedVersionHtml.value = newText.value.replace(/\n/g, '<br>');
}
};

// Helper function to add line numbers to HTML
const addLineNumbers = (html) => {
if (!html) return '';

// Replace <br> with a unique marker that won't appear in normal text
const marker = '___LINE_BREAK_MARKER___';
let markedHtml = html.replace(/<br\s*\/?>/gi, marker);

const lines = markedHtml.split(marker);
let numberedHtml = '';

for (let i = 0; i < lines.length; i++) {
numberedHtml += `<div class="text-diff-line"><span class="text-diff-line-number">${i + 1}</span>${lines[i]}</div>`;
}

return numberedHtml;
};

// Watch for changes in the text content and options
watch([oldText, newText, diffMode, deletedTextColor, addedTextColor, showLineNumbers], () => {
processDiff();
}, { immediate: true });

return {
isEditing,
oldVersionHtml,
combinedVersionHtml
};
}
};
</script>

<style lang="scss" scoped>
.text-diff-container {
width: 100%;
height: 100%;
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}

.text-diff-columns {
display: flex;
width: 100%;
height: 100%;
gap: 20px;
}

.text-diff-column {
flex: 1;
display: flex;
flex-direction: column;
border: 1px solid #e0e0e0;
border-radius: 4px;
overflow: hidden;
}

.text-diff-header {
padding: 10px;
font-weight: bold;
background-color: #f5f5f5;
border-bottom: 1px solid #e0e0e0;
}

.text-diff-content {
padding: 10px;
overflow-y: auto;
flex: 1;
line-height: 1.5;
}

:deep(.text-diff-deleted) {
background-color: rgba(255, 0, 0, 0.1);
}

:deep(.text-diff-added) {
background-color: rgba(0, 255, 0, 0.1);
}

:deep(.text-diff-line) {
display: flex;
align-items: flex-start;
}

:deep(.text-diff-line-number) {
display: inline-block;
width: 30px;
text-align: right;
padding-right: 10px;
color: #999;
user-select: none;
}
</style>