<template>
<div class="meetgu-video-player" :style="containerStyle">
<iframe 
v-if="videoUuid"
:title="content.title || 'Meetgu Video'"
:width="content.width || '100%'"
:height="content.height || '100%'"
:src="videoUuid ? `https://video.meetgu.ru/videos/embed/${videoUuid}?peertubeLink=0?title=0` : ''"
frameborder="0"
allowfullscreen
sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
@load="onVideoLoaded"
></iframe>
<div v-else class="meetgu-video-player__placeholder">
<div class="meetgu-video-player__placeholder-text">
{{ content.placeholderText || 'Please enter a video UUID' }}
</div>
</div>
</div>
</template>

<script>
import { computed, ref, watch } from 'vue';

export default {
props: {
content: { type: Object, required: true },
uid: { type: String, required: true },
},
emits: ['trigger-event'],
setup(props, { emit }) {
// Editor state
const isEditing = computed(() => {
// eslint-disable-next-line no-unreachable
return false;
});

// Video state
const videoUuid = computed(() => {
const uuid = props.content?.videoUuid;
// Handle both direct string values and expressions that might return objects
return typeof uuid === 'string' ? uuid : '';
});
const isVideoLoaded = ref(false);

// Internal variable to expose video loaded state
const { value: isLoaded, setValue: setIsLoaded } = wwLib.wwVariable.useComponentVariable({
uid: props.uid,
name: 'isLoaded',
type: 'boolean',
defaultValue: false
});

// Container style
const containerStyle = computed(() => ({
aspectRatio: props.content?.aspectRatio || '16/9',
maxWidth: props.content?.maxWidth || '100%',
}));

// Handle video loaded event
const onVideoLoaded = () => {
isVideoLoaded.value = true;
setIsLoaded(true);

if (!isEditing.value) {
emit('trigger-event', {
name: 'videoLoaded',
event: { uuid: videoUuid.value }
});
}
};

// Watch for changes to videoUuid
watch(videoUuid, (newValue, oldValue) => {
if (newValue !== oldValue) {
isVideoLoaded.value = false;
setIsLoaded(false);
}
});

return {
videoUuid,
isVideoLoaded,
containerStyle,
onVideoLoaded,
isLoaded,
setIsLoaded
};
}
};
</script>

<style lang="scss" scoped>
.meetgu-video-player {
position: relative;
width: 100%;
height: 100%;
background-color: #000;
overflow: hidden;

iframe {
position: absolute;
top: 0;
left: 0;
width: 100%;
height: 100%;
border: none;
}

&__placeholder {
display: flex;
align-items: center;
justify-content: center;
width: 100%;
height: 100%;
background-color: #f0f0f0;
color: #666;

&-text {
padding: 20px;
text-align: center;
font-size: 16px;
}
}
}
</style>