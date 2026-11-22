<script setup lang="ts">
import { useGroupsStore } from '@/features/groups/store';

defineProps<{ view: 'alone' | 'together' | 'pending' }>();
const groups = useGroupsStore();
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
      <p class="text-medium-emphasis">{{ $t('empty') }}</p>
    </template>
  </v-container>
</template>

<style scoped>
.empty-state {
  max-width: 400px;
}
</style>
