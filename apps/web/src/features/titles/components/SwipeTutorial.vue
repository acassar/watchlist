<script setup lang="ts">
import { mdiArrowLeft, mdiArrowRight, mdiArrowUp } from '@mdi/js';
import { WatchStatus } from '@watchlist/shared';
import { computed } from 'vue';
import { statusAppearance } from '../status';
import { swipeTutorial } from '../tutorial';

const open = computed({
  get: () => swipeTutorial.open.value,
  set: (value: boolean) => {
    if (!value) swipeTutorial.close();
  },
});

const gestures = [
  { arrow: mdiArrowRight, status: WatchStatus.OK_ALONE },
  { arrow: mdiArrowUp, status: WatchStatus.TOGETHER },
  { arrow: mdiArrowLeft, status: WatchStatus.NOT_INTERESTED },
] as const;
</script>

<template>
  <v-dialog v-model="open" max-width="400">
    <v-card class="pa-2" rounded="xl" data-test="swipe-tutorial">
      <v-card-title class="font-display text-headline-small text-wrap">
        {{ $t('tutorial.title') }}
      </v-card-title>
      <v-card-text>
        <p class="mb-4">{{ $t('tutorial.body') }}</p>
        <div
          v-for="g in gestures"
          :key="g.status"
          class="d-flex align-center ga-3 mb-3"
        >
          <v-avatar :color="statusAppearance[g.status].color" size="40">
            <v-icon :icon="g.arrow" />
          </v-avatar>
          <div>
            <div class="text-title-small">
              {{ $t(`tutorial.${g.status}.gesture`) }}
              <v-icon :icon="statusAppearance[g.status].icon" size="16" />
              {{ $t(`titles.status.${g.status}`) }}
            </div>
            <div class="text-body-small text-medium-emphasis">
              {{ $t(`tutorial.${g.status}.meaning`) }}
            </div>
          </div>
        </div>
        <p class="text-body-small text-medium-emphasis">
          {{ $t('tutorial.buttons') }}
        </p>
      </v-card-text>
      <v-card-actions>
        <v-btn
          color="primary"
          variant="flat"
          rounded="pill"
          block
          data-test="tutorial-ok"
          @click="open = false"
        >
          {{ $t('tutorial.ok') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
