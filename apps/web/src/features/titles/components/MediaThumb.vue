<script setup lang="ts">
import { mdiPlayCircleOutline } from '@mdi/js';

defineProps<{ src: string | null; width: number }>();
</script>

<template>
  <!-- Hotlink de la miniature (décision D6), sans envoyer l'adresse de la page. -->
  <div class="thumb rounded-lg" :style="{ width: `${width}px` }">
    <img
      v-if="src"
      :src="src"
      alt=""
      loading="lazy"
      referrerpolicy="no-referrer"
      class="thumb-img"
    />
    <v-icon v-else :icon="mdiPlayCircleOutline" class="thumb-icon" />
  </div>
</template>

<style scoped>
.thumb {
  position: relative;
  flex-shrink: 0;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: rgb(var(--v-theme-surface-variant));
}
.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.thumb-icon {
  position: absolute;
  inset: 0;
  margin: auto;
  opacity: 0.6;
}
</style>
