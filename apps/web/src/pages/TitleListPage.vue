<script setup lang="ts">
import { watch } from 'vue';
import { useGroupsStore } from '@/features/groups/store';
import TitleRow from '@/features/titles/components/TitleRow.vue';
import { useTitlesStore } from '@/features/titles/store';

defineProps<{ view: 'alone' | 'together' | 'pending' }>();
const groups = useGroupsStore();
const titles = useTitlesStore();

// Étape 5 : la liste complète du groupe, la même sous chaque onglet.
// Les trois vues filtrées remplacent cette liste à l'étape 6.
watch(
  () => groups.activeGroup?.id,
  (groupId) => {
    if (groupId) titles.load(groupId).catch(() => undefined);
  },
  { immediate: true },
);
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
      <h1 class="font-display text-headline-small mb-4">
        {{ $t(`views.${view}`) }}
      </h1>
      <div v-if="titles.titles.length" class="title-list" data-test="titles">
        <TitleRow
          v-for="title in titles.titles"
          :key="title.id"
          :title="title"
        />
      </div>
      <v-alert
        v-else-if="titles.status === 'error'"
        type="error"
        variant="tonal"
        :text="$t('titles.loadError')"
      />
      <p v-else-if="titles.status === 'ready'" class="text-medium-emphasis">
        {{ $t('titles.empty') }}
      </p>
    </template>
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
