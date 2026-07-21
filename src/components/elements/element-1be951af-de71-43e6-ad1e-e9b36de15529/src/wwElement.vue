<template>
  <div class="meetgu-video-player" :style="containerStyle">
    <template v-if="videoUuid">
      <iframe v-if="showIframe" :key="videoUuid" :title="iframeTitle" :src="embedUrl" frameborder="0"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms" @load="onVideoLoaded"></iframe>

      <button
        v-else
        type="button"
        class="meetgu-video-player__start"
        @click="startVideo"
      >
        <img
          v-if="posterUrl"
          class="meetgu-video-player__poster"
          :src="posterUrl"
          :alt="iframeTitle"
        />
        <div v-else class="meetgu-video-player__poster meetgu-video-player__poster--empty">
          {{ iframeTitle }}
        </div>
        <span class="meetgu-video-player__play" aria-hidden="true">▶</span>
      </button>
    </template>

    <div v-else class="meetgu-video-player__placeholder">
      <div class="meetgu-video-player__placeholder-text">
        {{ placeholderText }}
      </div>
    </div>
  </div>
</template>

<script>
  import { computed, ref, watch } from 'vue';

const PEERTUBE_BASE = 'https://video.meetgu.ru';

export default {
  props: {
    content: { type: Object, required: true },
    uid: { type: String, required: true },
  },
  emits: ['trigger-event'],
  setup(props, { emit }) {
    const isStarted = ref(false);
    const posterUrl = ref('');

    const isEditing = computed(() => {
      // eslint-disable-next-line no-unreachable
      return false;
    });

    const showIframe = computed(() => isEditing.value || isStarted.value);

    const videoUuid = computed(() => {
      const uuid = props.content && props.content.videoUuid;
      return typeof uuid === 'string' ? uuid.trim() : '';
    });

    const iframeTitle = computed(() => {
      if (props.content && props.content.videoTitle) return props.content.videoTitle;
      return 'Meetgu Video';
    });

    const placeholderText = computed(() => {
      if (props.content && props.content.placeholderText) return props.content.placeholderText;
      return 'Please enter a video UUID';
    });

    const embedUrl = computed(() => {
      if (!videoUuid.value) return '';
      const params = new URLSearchParams({
        title: '0',
        warningTitle: '0',
        peertubeLink: '0',
        p2p: '0',
      });
      return `${PEERTUBE_BASE}/videos/embed/${videoUuid.value}?${params.toString()}`;
    });

    const containerStyle = computed(() => ({
      aspectRatio: (props.content && props.content.aspectRatio) || '16/9',
      maxWidth: (props.content && props.content.maxWidth) || '100%',
    }));

    const { setValue: setIsLoaded } = wwLib.wwVariable.useComponentVariable({
      uid: props.uid,
      name: 'isLoaded',
      type: 'boolean',
      defaultValue: false,
    });

    async function loadPoster(uuid) {
      posterUrl.value = '';
      if (!uuid) return;

      try {
        const response = await fetch(`${PEERTUBE_BASE}/api/v1/videos/${uuid}`);
        if (!response.ok) return;

        const data = await response.json();
        if (data.thumbnailPath) {
          posterUrl.value = `${PEERTUBE_BASE}${data.thumbnailPath}`;
        } else if (data.previewPath) {
          posterUrl.value = `${PEERTUBE_BASE}${data.previewPath}`;
        }
      } catch {
        posterUrl.value = '';
      }
    }

    function startVideo() {
      isStarted.value = true;
    }

    function onVideoLoaded() {
      setIsLoaded(true);
      if (!isEditing.value) {
        emit('trigger-event', {
          name: 'videoLoaded',
          event: { uuid: videoUuid.value },
        });
      }
    }

    watch(
      videoUuid,
      (uuid) => {
        isStarted.value = false;
        setIsLoaded(false);
        loadPoster(uuid);
      },
      { immediate: true }
    );

    return {
      videoUuid,
      embedUrl,
      iframeTitle,
      placeholderText,
      containerStyle,
      posterUrl,
      showIframe,
      startVideo,
      onVideoLoaded,
    };
  },
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

    &__start {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      padding: 0;
      border: 0;
      background: #000;
      cursor: pointer;
    }

    &__poster {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;

      &--empty {
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 16px;
        padding: 20px;
        text-align: center;
      }
    }

    &__play {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.65);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      pointer-events: none;
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