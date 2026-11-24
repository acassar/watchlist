<script setup lang="ts">
import { mdiHistory } from '@mdi/js';
import type { GroupTitle, WatchStatus } from '@watchlist/shared';
import { computed, watch } from 'vue';
import { useGroupsStore } from '@/features/groups/store';
import ActiveTitlesCounter from '@/features/titles/components/ActiveTitlesCounter.vue';
import NoticeSnackbar from '@/features/titles/components/NoticeSnackbar.vue';
import StatusSheet from '@/features/titles/components/StatusSheet.vue';
import SwipeCard from '@/features/titles/components/SwipeCard.vue';
import SwipeTutorial from '@/features/titles/components/SwipeTutorial.vue';
import TitleActions from '@/features/titles/components/TitleActions.vue';
import TitleRow from '@/features/titles/components/TitleRow.vue';
import { useTitlesStore } from '@/features/titles/store';
import { swipeTutorial } from '@/features/titles/tutorial';
import { useTitleActions } from '@/features/titles/useTitleActions';

const props = defineProps<{ view: 'alone' | 'together' | 'pending' }>();
const groups = useGroupsStore();
const titles = useTitlesStore();
const { notice, editing, watchedAlone, watchedTogether, setStatus } =
  useTitleActions();

watch(
  () => groups.activeGroup?.id,
  (groupId) => {
    if (groupId) titles.load(groupId).catch(() => undefined);
  },
  { immediate: true },
);

/** Lignes principales de l'onglet. */
const main = computed<GroupTitle[]>(() => {
  if (props.view === 'alone') return titles.byView.ALONE;
  if (props.view === 'together') return titles.byView.TOGETHER;
  return titles.byView.PENDING;
});
/** Sous « Seul » : mes « sans moi, ok » qui attendent encore l'avis d'un autre. */
const waiting = computed(() =>
  props.view === 'alone' ? titles.byView.WAITING : [],
);
const current = computed(() =>
  props.view === 'pending' ? (main.value[0] ?? null) : null,
);

// Premier usage de « Mon avis » avec une carte à l'écran : le tuto des gestes.
watch(
  current,
  (card) => {
    if (card) swipeTutorial.showIfNew();
  },
  { immediate: true },
);

function decide(title: GroupTitle, status: WatchStatus) {
  setStatus(title, status);
}
</script>

<template>
  <v-container class="pa-4">
    <!-- Premier passage : pas encore de groupe, donc pas encore de liste. -->
    <div
      v-if="groups.hasNoGroup"
      class="empty-state text-center mx-auto py-8"
      data-test="no-group"
    >
      <h1 class="font-display text-headline-small mb-3">
        {{ $t('groups.empty.title') }}
      </h1>
      <p class="text-body-medium text-medium-emphasis mb-6">
        {{ $t('groups.empty.body') }}
      </p>
      <v-btn
        :to="{ name: 'group-new' }"
        color="primary"
        size="large"
        rounded="pill"
        block
        class="mb-3"
      >
        {{ $t('groups.empty.create') }}
      </v-btn>
      <v-btn
        :to="{ name: 'join' }"
        variant="outlined"
        size="large"
        rounded="pill"
        block
      >
        {{ $t('groups.empty.join') }}
      </v-btn>
    </div>

    <template v-else>
      <div class="d-flex align-center ga-2 mb-1">
        <h1 class="font-display text-headline-small flex-grow-1">
          {{ $t(`views.${view}`) }}
        </h1>
        <ActiveTitlesCounter
          v-if="groups.activeGroup"
          :count="groups.activeGroup.activeTitleCount"
        />
      </div>

      <v-alert
        v-if="titles.status === 'error'"
        type="error"
        variant="tonal"
        class="mt-3"
        :text="$t('titles.loadError')"
      />

      <!-- « Mon avis » : une grande carte à la fois, boutons ou glissé. -->
      <template v-else-if="view === 'pending'">
        <p
          v-if="current"
          class="text-body-medium text-medium-emphasis mb-4"
          data-test="pending-count"
        >
          {{ $t('views.pendingCount', main.length) }}
        </p>
        <SwipeCard
          v-if="current"
          :key="current.id"
          :title="current"
          @decide="(status) => decide(current!, status)"
        />
        <div
          v-else-if="titles.status === 'ready'"
          class="text-center py-8"
          data-test="pending-done"
        >
          <p class="font-display text-title-large mb-2">
            {{ $t('views.pendingDoneTitle') }}
          </p>
          <p class="text-body-medium text-medium-emphasis">
            {{ $t('views.pendingDone') }}
          </p>
        </div>
        <SwipeTutorial />
      </template>

      <!-- « Seul » et « Ensemble » : lignes compactes. -->
      <template v-else>
        <p class="text-body-small text-medium-emphasis mb-3">
          {{ $t(`views.${view}Hint`) }}
        </p>
        <div class="title-list">
          <div v-if="main.length" data-test="titles">
            <TitleRow
              v-for="title in main"
              :key="title.id"
              :title="title"
              @edit="editing = $event"
            >
              <template #actions>
                <TitleActions
                  :title="title"
                  @watched-alone="(w) => watchedAlone(title, w)"
                  @watched-together="(w) => watchedTogether(title, w)"
                  @edit="editing = title"
                />
              </template>
            </TitleRow>
          </div>
          <p
            v-else-if="titles.status === 'ready'"
            class="text-medium-emphasis py-4"
            data-test="empty"
          >
            {{ $t(`views.${view}Empty`) }}
          </p>

          <template v-if="waiting.length">
            <h2 class="text-title-small mt-6 mb-1">
              {{ $t('views.waiting') }}
            </h2>
            <p class="text-body-small text-medium-emphasis mb-2">
              {{ $t('views.waitingHint') }}
            </p>
            <div data-test="waiting">
              <TitleRow
                v-for="title in waiting"
                :key="title.id"
                :title="title"
                dimmed
                @edit="editing = $event"
              >
                <template #actions>
                  <TitleActions
                    :title="title"
                    @watched-alone="(w) => watchedAlone(title, w)"
                    @watched-together="(w) => watchedTogether(title, w)"
                    @edit="editing = title"
                  />
                </template>
              </TitleRow>
            </div>
          </template>

          <div class="text-center mt-6">
            <v-btn
              :to="{ name: 'history' }"
              variant="text"
              :prepend-icon="mdiHistory"
              class="text-none"
              data-test="history-link"
            >
              {{ $t('history.link') }}
            </v-btn>
          </div>
        </div>
      </template>
    </template>

    <StatusSheet v-model="editing" @pick="setStatus" />
    <NoticeSnackbar v-model="notice" />
  </v-container>
</template>

<style scoped>
.empty-state {
  max-width: 400px;
}
/* Place pour le bouton « + » sous la dernière ligne. */
.title-list {
  padding-bottom: 80px;
}
</style>
