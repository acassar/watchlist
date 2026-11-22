<script setup lang="ts">
import { formatDuration, type GroupTitle } from '@watchlist/shared';
import { computed } from 'vue';
import MediaThumb from './MediaThumb.vue';

const props = defineProps<{ title: GroupTitle }>();

const meta = computed(() =>
  [
    props.title.media.author,
    props.title.media.durationSec !== null
      ? formatDuration(props.title.media.durationSec)
      : null,
  ]
    .filter(Boolean)
    .join(' · '),
);
</script>

<template>
  <!-- Ligne compacte (maquette) : miniature, titre, chaîne et durée. -->
  <a
    :href="title.media.url"
    target="_blank"
    rel="noopener noreferrer"
    class="title-row d-flex ga-3 py-2"
    data-test="title-row"
  >
    <MediaThumb :src="title.media.thumbnailUrl" :width="112" />
    <div class="d-flex flex-column overflow-hidden">
      <span class="text-title-small title-text">{{ title.media.title }}</span>
      <span class="text-body-small text-medium-emphasis text-truncate">{{
        meta
      }}</span>
    </div>
  </a>
</template>

<style scoped>
.v-application a.title-row {
  color: inherit;
  text-decoration: none;
}
.title-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
