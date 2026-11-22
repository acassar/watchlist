<script setup lang="ts">
import type { WatchStatus } from '@watchlist/shared';
import { statusAppearance, statusChoices } from '../status';

const model = defineModel<WatchStatus>({ required: true });
defineProps<{ label: string }>();
</script>

<template>
  <!-- Trois gros boutons, comme dans « Mon avis » (étape 6). -->
  <div
    role="radiogroup"
    :aria-label="label"
    class="status-picker d-flex ga-2"
    data-test="status-picker"
  >
    <v-btn
      v-for="choice in statusChoices"
      :key="choice"
      role="radio"
      :aria-checked="model === choice"
      :color="model === choice ? statusAppearance[choice].color : undefined"
      :variant="model === choice ? 'flat' : 'outlined'"
      :prepend-icon="statusAppearance[choice].icon"
      rounded="lg"
      size="large"
      stacked
      class="flex-1-1 text-none status-choice"
      :data-test="`status-${choice}`"
      @click="model = choice"
    >
      {{ $t(`titles.status.${choice}`) }}
    </v-btn>
  </div>
</template>

<style scoped>
.status-choice {
  min-width: 0;
  letter-spacing: normal;
}
</style>
