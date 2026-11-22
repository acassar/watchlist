<script setup lang="ts">
import type { GroupTitle, WatchStatus } from '@watchlist/shared';
import { computed } from 'vue';
import { statusAppearance, statusChoices } from '../status';

/** Titre dont on change mon avis ; null = fermé. */
const title = defineModel<GroupTitle | null>({ required: true });
const emit = defineEmits<{ pick: [title: GroupTitle, status: WatchStatus] }>();

const open = computed({
  get: () => title.value !== null,
  set: (value: boolean) => {
    if (!value) title.value = null;
  },
});

function pick(status: WatchStatus) {
  const current = title.value;
  title.value = null;
  if (current && current.myStatus !== status) emit('pick', current, status);
}
</script>

<template>
  <v-bottom-sheet v-model="open" inset>
    <v-card class="pa-4 pb-6" rounded="t-xl" data-test="status-sheet">
      <div class="sheet-handle mx-auto mb-4" />
      <p class="text-title-small mb-1 text-truncate">
        {{ title?.media.title }}
      </p>
      <p class="text-body-small text-medium-emphasis mb-4">
        {{ $t('titles.yourStatus') }}
      </p>
      <div class="d-flex ga-2">
        <v-btn
          v-for="choice in statusChoices"
          :key="choice"
          :color="
            title?.myStatus === choice
              ? statusAppearance[choice].color
              : undefined
          "
          :variant="title?.myStatus === choice ? 'flat' : 'outlined'"
          :prepend-icon="statusAppearance[choice].icon"
          :aria-pressed="title?.myStatus === choice"
          rounded="lg"
          size="large"
          stacked
          class="flex-1-1 text-none choice"
          :data-test="`sheet-${choice}`"
          @click="pick(choice)"
        >
          {{ $t(`titles.status.${choice}`) }}
        </v-btn>
      </div>
    </v-card>
  </v-bottom-sheet>
</template>

<style scoped>
.choice {
  min-width: 0;
  letter-spacing: normal;
}
</style>
