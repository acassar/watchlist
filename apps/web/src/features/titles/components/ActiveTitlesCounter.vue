<script setup lang="ts">
import { GROUP_MAX_ACTIVE_TITLES } from '@watchlist/shared';
import { computed } from 'vue';

/**
 * Compteur des titres en cours du groupe (« 48/50 en cours ») : la limite se
 * voit avant d'ajouter. Ambre en approchant, rouge quand la liste est pleine.
 */
const props = defineProps<{ count: number }>();

const full = computed(() => props.count >= GROUP_MAX_ACTIVE_TITLES);
const color = computed(() =>
  full.value
    ? 'error'
    : props.count >= GROUP_MAX_ACTIVE_TITLES - 10
      ? 'warning'
      : undefined,
);
</script>

<template>
  <v-chip
    size="small"
    variant="tonal"
    :color="color"
    class="flex-shrink-0"
    data-test="active-count"
  >
    {{
      $t(full ? 'titles.active.full' : 'titles.active.count', {
        count,
        max: GROUP_MAX_ACTIVE_TITLES,
      })
    }}
  </v-chip>
</template>
