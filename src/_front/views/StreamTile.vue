<template>
    <div class="lkc-tile" :class="{ 'is-speaking': entry.speaking }">
        <video
            v-show="entry.hasCamera"
            ref="videoEl"
            class="lkc-tile__video"
            autoplay
            playsinline
            :muted="entry.isLocal"
        ></video>
        <div v-if="!entry.hasCamera" class="lkc-tile__avatar">{{ initials }}</div>
        <div class="lkc-tile__bar">
            <span class="lkc-tile__mic" :class="{ off: !entry.micEnabled }">
                {{ entry.micEnabled ? '🎙' : '🔇' }}
            </span>
            <span class="lkc-tile__name">
                {{ entry.name }}<template v-if="entry.isLocal"> (вы)</template>
            </span>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { Track } from 'livekit-client';

const props = defineProps({ entry: { type: Object, required: true } });
const videoEl = ref(null);
// The currently-attached LiveKit track (kept out of reactivity — plain local var).
let attached = null;

const initials = computed(() => {
    const parts = (props.entry.name || '').trim().split(/\s+/).slice(0, 2);
    return parts.map((s) => (s[0] ? s[0].toUpperCase() : '')).join('') || '?';
});

// Attach/detach the participant's camera track to our <video>. Runs after render (flush:'post')
// so the element exists; detaches the old track on any change to avoid leaking media elements.
function sync() {
    const p = props.entry.participant;
    const pub = p && p.getTrackPublication ? p.getTrackPublication(Track.Source.Camera) : null;
    const track = props.entry.hasCamera && pub ? pub.track : null;
    if (track === attached) return;
    if (attached && videoEl.value) attached.detach(videoEl.value);
    attached = null;
    if (track && videoEl.value) {
        track.attach(videoEl.value);
        attached = track;
    }
}

watch(() => [props.entry.hasCamera, props.entry.participant], sync, {
    immediate: true,
    flush: 'post',
});

onBeforeUnmount(() => {
    if (attached && videoEl.value) attached.detach(videoEl.value);
    attached = null;
});
</script>

<style scoped>
.lkc-tile {
    position: relative;
    aspect-ratio: 3 / 4;
    border-radius: 14px;
    overflow: hidden;
    background: #161b2e;
    border: 2px solid transparent;
}
.lkc-tile.is-speaking {
    border-color: #2563eb;
}
.lkc-tile__video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}
.lkc-tile__avatar {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Raleway', sans-serif;
    font-weight: 700;
    font-size: 28px;
    color: #fff;
    background: #223;
}
.lkc-tile__bar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: rgba(0, 0, 0, 0.45);
    color: #fff;
    font-family: 'Raleway', sans-serif;
    font-size: 13px;
}
.lkc-tile__mic.off {
    opacity: 0.9;
}
.lkc-tile__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
