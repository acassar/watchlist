<script setup lang="ts">
import { formatDuration, type GroupTitle } from '@watchlist/shared';
import { computed } from 'vue';
import MediaThumb from './MediaThumb.vue';
import MemberStatuses from './MemberStatuses.vue';

const props = defineProps<{ title: GroupTitle; dimmed?: boolean }>();
const emit = defineEmits<{ edit: [title: GroupTitle] }>();

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
  <!-- Ligne compacte (maquette) : miniature, titre, chaîne et durée, avis des membres. -->
  <div
    class="title-row d-flex ga-3 py-2"
    :class="{ dimmed }"
    data-test="title-row"
    :data-title="title.id"
  >
    <a
      :href="title.media.url"
      target="_blank"
      rel="noopener noreferrer"
      class="thumb-link"
      :aria-label="$t('titles.open', { title: title.media.title })"
    >
      <MediaThumb :src="title.media.thumbnailUrl" :width="112" />
    </a>
    <div class="d-flex flex-column flex-1-1 overflow-hidden ga-1">
      <span class="text-title-small title-text">{{ title.media.title }}</span>
      <span class="text-body-small text-medium-emphasis text-truncate">{{
        meta
      }}</span>
      <slot name="info" />
      <MemberStatuses :title="title" @edit="emit('edit', title)" />
    </div>
    <div class="flex-shrink-0">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.thumb-link {
  flex-shrink: 0;
  align-self: flex-start;
}
.title-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.dimmed .thumb-link,
.dimmed .title-text {
  opacity: 0.65;
}
</style>
