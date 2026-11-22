<script setup lang="ts">
import {
  mdiAccountCheckOutline,
  mdiAccountMultipleCheckOutline,
  mdiDotsVertical,
  mdiPencilOutline,
  mdiUndo,
} from '@mdi/js';
import type { GroupTitle } from '@watchlist/shared';

defineProps<{ title: GroupTitle; history?: boolean }>();
const emit = defineEmits<{
  watchedAlone: [watched: boolean];
  watchedTogether: [watched: boolean];
  edit: [];
}>();
</script>

<template>
  <v-menu location="bottom end">
    <template #activator="{ props: menu }">
      <v-btn
        v-bind="menu"
        :icon="mdiDotsVertical"
        variant="text"
        size="small"
        :aria-label="$t('titles.actions.label', { title: title.media.title })"
        data-test="title-actions"
      />
    </template>
    <v-list density="compact">
      <template v-if="!history">
        <v-list-item
          :prepend-icon="mdiAccountCheckOutline"
          :title="$t('titles.actions.watchedAlone')"
          data-test="action-watched-alone"
          @click="emit('watchedAlone', true)"
        />
        <v-list-item
          :prepend-icon="mdiAccountMultipleCheckOutline"
          :title="$t('titles.actions.watchedTogether')"
          data-test="action-watched-together"
          @click="emit('watchedTogether', true)"
        />
      </template>
      <template v-else>
        <v-list-item
          v-if="title.watchedTogetherAt"
          :prepend-icon="mdiUndo"
          :title="$t('titles.actions.undoTogether')"
          data-test="action-undo-together"
          @click="emit('watchedTogether', false)"
        />
        <v-list-item
          v-if="title.myWatchedAloneAt"
          :prepend-icon="mdiUndo"
          :title="$t('titles.actions.undoAlone')"
          data-test="action-undo-alone"
          @click="emit('watchedAlone', false)"
        />
      </template>
      <v-list-item
        :prepend-icon="mdiPencilOutline"
        :title="$t('titles.actions.changeStatus')"
        data-test="action-edit"
        @click="emit('edit')"
      />
    </v-list>
  </v-menu>
</template>
