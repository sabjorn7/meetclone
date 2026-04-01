<template>
  <div
    class="tg-images-row"
    :class="{
      'tg--mobile': isMobile,
      'tg--desktop': !isMobile,
    }"
    :style="containerStyle"
    v-if="limited.length"
  >
    <!-- 1 картинка -->
    <div
      v-if="limited.length === 1"
      class="tg-case tg-case-1"
    >
      <button
        class="tg-btn"
        type="button"
        @click="onImageClick(0, limited[0])"
      >
        <img :src="limited[0]" class="tg-img" loading="lazy" decoding="async" alt="" />
      </button>
    </div>

    <!-- 2 картинки: рядом -->
    <div
      v-else-if="limited.length === 2"
      class="tg-case tg-case-2"
    >
      <button
        v-for="(src, idx) in limited"
        :key="idx"
        class="tg-btn tg-cell-half"
        type="button"
        @click="onImageClick(idx, src)"
      >
        <img :src="src" class="tg-img" loading="lazy" decoding="async" alt="" />
      </button>
    </div>

    <!-- 3 картинки -->
    <div
      v-else-if="limited.length === 3"
      class="tg-case tg-case-3"
    >
      <!-- desktop: 1 слева, 2 друг под другом справа -->
      <template v-if="!isMobile">
        <div class="tg-3-desktop">
          <div class="tg-3-desktop-left">
            <button
              class="tg-btn"
              type="button"
              @click="onImageClick(0, limited[0])"
            >
              <img :src="limited[0]" class="tg-img" loading="lazy" decoding="async" alt="" />
            </button>
          </div>
          <div class="tg-3-desktop-right">
            <button
              v-for="(src, idx) in limited.slice(1)"
              :key="idx"
              class="tg-btn tg-3-desktop-right-cell"
              type="button"
              @click="onImageClick(idx + 1, src)"
            >
              <img :src="src" class="tg-img" loading="lazy" decoding="async" alt="" />
            </button>
          </div>
        </div>
      </template>

      <!-- mobile: 1 сверху, 2 снизу рядом -->
      <template v-else>
        <div class="tg-3-mobile">
          <div class="tg-3-mobile-top">
            <button
              class="tg-btn"
              type="button"
              @click="onImageClick(0, limited[0])"
            >
              <img :src="limited[0]" class="tg-img" loading="lazy" decoding="async" alt="" />
            </button>
          </div>
          <div class="tg-3-mobile-bottom">
            <button
              v-for="(src, idx) in limited.slice(1)"
              :key="idx"
              class="tg-btn tg-cell-half"
              type="button"
              @click="onImageClick(idx + 1, src)"
            >
              <img :src="src" class="tg-img" loading="lazy" decoding="async" alt="" />
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- 4+ картинок: 1 большая сверху, остальные в один ряд под ней -->
    <div
      v-else
      class="tg-case tg-case-4plus"
    >
      <div class="tg-4plus-top">
        <button
          class="tg-btn"
          type="button"
          @click="onImageClick(0, limited[0])"
        >
          <img :src="limited[0]" class="tg-img" loading="lazy" decoding="async" alt="" />
        </button>
      </div>

      <div class="tg-4plus-bottom">
        <button
          v-for="(src, idx) in limited.slice(1)"
          :key="idx"
          class="tg-btn tg-4plus-bottom-cell"
          type="button"
          @click="onImageClick(idx + 1, src)"
        >
          <img :src="src" class="tg-img" loading="lazy" decoding="async" alt="" />
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';

export default {
  props: {
    content: { type: Object, required: true },
    uid: { type: String, required: true },
  },
  emits: ['trigger-event'],
  setup(props, { emit }) {
    const isMobile = computed(() => !!props.content?.isMobile);

    const imgs = computed(() => {
      const val = props.content?.images;
      return Array.isArray(val) ? val : [];
    });

    const maxImages = computed(() => {
      const v = Number(props.content?.maxImages ?? 10);
      if (!Number.isFinite(v) || v <= 0) return 10;
      return Math.min(v, 10);
    });

    const limited = computed(() =>
      imgs.value.slice(0, maxImages.value),
    );

    const rowGap = computed(
      () => props.content?.rowGap || '2px',
    );
    const columnGap = computed(
      () => props.content?.columnGap || '2px',
    );

    const containerStyle = computed(() => ({
      borderRadius: props.content?.borderRadius || '12px',
      '--tg-row-gap': rowGap.value,
      '--tg-column-gap': columnGap.value,
      maxWidth: isMobile.value ? '300px' : '650px',
      width: '100%',
      overflow: 'hidden',
    }));

    const isEditing = computed(() => {
      return false;
    });

    const onImageClick = (index, src) => {
      if (isEditing.value) return;
      emit('trigger-event', {
        name: 'imageClick',
        event: { index, src },
      });
    };

    return {
      isMobile,
      limited,
      containerStyle,
      onImageClick,
    };
  },
};
</script>

<style lang="scss" scoped>
.tg-images-row {
  position: relative;
}

/* width limit */
.tg--desktop {
  max-width: 650px;
}
.tg--mobile {
  max-width: 300px;
}

/* общий контейнер кейса */
.tg-case {
  width: 100%;
}

/* reset */
.tg-btn {
  padding: 0;
  margin: 0;
  border: none;
  background: none;
  display: block;
  width: 100%;
  height: 100%;
  cursor: pointer;

  &:focus {
    outline: none;
  }
}

.tg-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
}

/* 1 картинка */
.tg-case-1 {
  width: 100%;
}

/* 2 картинки: flex‑row, 2 равных блока */
.tg-case-2 {
  display: flex;
  gap: var(--tg-column-gap, 2px);
}
.tg-cell-half {
  flex: 1 1 0;
}

/* 3 картинки */
/* desktop: 1 слева, 2 вертикально справа */
.tg-3-desktop {
  display: flex;
  gap: var(--tg-column-gap, 2px);
}
.tg-3-desktop-left {
  flex: 2 1 0;
}
.tg-3-desktop-right {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  gap: var(--tg-row-gap, 2px);
}
.tg-3-desktop-right-cell {
  flex: 1 1 0;
}

/* mobile: 1 сверху, 2 снизу */
.tg-3-mobile {
  display: flex;
  flex-direction: column;
  gap: var(--tg-row-gap, 2px);
}
.tg-3-mobile-top {
  width: 100%;
}
.tg-3-mobile-bottom {
  display: flex;
  gap: var(--tg-column-gap, 2px);
}

/* 4+ : 1 сверху, остальные в один flex‑row */
/* делаем верхнюю заметно выше, нижний ряд ниже */
.tg-case-4plus {
  display: flex;
  flex-direction: column;
  gap: var(--tg-row-gap, 2px);
}

/* верхняя большая */
.tg-4plus-top {
  width: 100%;
  aspect-ratio: 16 / 9;
}

/* нижний ряд – ниже по высоте */
.tg-4plus-bottom {
  display: flex;
  gap: var(--tg-column-gap, 2px);
  width: 100%;
  aspect-ratio: 16 / 3;
}

.tg-4plus-bottom-cell {
  flex: 1 1 0;
}
</style>