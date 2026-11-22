<script setup lang="ts">
import { mdiArrowLeft } from '@mdi/js';
import type { GroupTitle } from '@watchlist/shared';
import { watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGroupsStore } from '@/features/groups/store';
import NoticeSnackbar from '@/features/titles/components/NoticeSnackbar.vue';
import StatusSheet from '@/features/titles/components/StatusSheet.vue';
import TitleActions from '@/features/titles/components/TitleActions.vue';
import TitleRow from '@/features/titles/components/TitleRow.vue';
import { useTitlesStore } from '@/features/titles/store';
import { useTitleActions } from '@/features/titles/useTitleActions';

const { t, d } = useI18n();
const groups = useGroupsStore();
const titles = useTitlesStore();
const { notice, editing, watchedAlone, watchedTogether, setStatus } =
  useTitleActions();

watch(
  () => groups.activeGroup?.id,
  (groupId) => {
    if (!groupId) return;
    titles.loadHistory(groupId).catch(() => undefined);
    // Pour la pastille de « Mon avis » et une annulation qui y ramène un titre.
    titles.load(groupId).catch(() => undefined);
  },
  { immediate: true },
);

/** Pourquoi le titre est sorti de mes listes. */
function reason(title: GroupTitle): string {
  if (title.watchedTogetherAt) {
    return t('history.together', {
      date: d(new Date(title.watchedTogetherAt), 'short'),
    });
  }
  if (title.myWatchedAloneAt) {
    return t('history.alone', {
      date: d(new Date(title.myWatchedAloneAt), 'short'),
    });
  }
  if (title.view === 'ARCHIVED') return t('history.archived');
  return t('history.notInterested');
}
</script>

<template>
  <v-container class="pa-4">
    <div class="d-flex align-center ga-1 mb-3">
      <v-btn
        :to="{ name: 'alone' }"
        :icon="mdiArrowLeft"
        variant="text"
        :aria-label="$t('common.back')"
      />
      <h1 class="font-display text-headline-small">
        {{ $t('history.title') }}
      </h1>
    </div>

    <v-alert
      v-if="titles.historyStatus === 'error'"
      type="error"
      variant="tonal"
      :text="$t('titles.loadError')"
    />
    <div v-else-if="titles.history.length" data-test="history">
      <TitleRow
        v-for="title in titles.history"
        :key="title.id"
        :title="title"
        @edit="editing = $event"
      >
        <template #info>
          <span class="text-body-small text-primary" data-test="reason">{{
            reason(title)
          }}</span>
        </template>
        <template #actions>
          <TitleActions
            :title="title"
            history
            @watched-alone="(w) => watchedAlone(title, w)"
            @watched-together="(w) => watchedTogether(title, w)"
            @edit="editing = title"
          />
        </template>
      </TitleRow>
    </div>
    <p
      v-else-if="titles.historyStatus === 'ready'"
      class="text-medium-emphasis"
      data-test="history-empty"
    >
      {{ $t('history.empty') }}
    </p>

    <StatusSheet v-model="editing" @pick="setStatus" />
    <NoticeSnackbar v-model="notice" />
  </v-container>
</template>
