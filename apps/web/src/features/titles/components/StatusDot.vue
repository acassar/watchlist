<script setup lang="ts">
import type { MemberStatus } from '@watchlist/shared';
import { statusAppearance } from '../status';

withDefaults(defineProps<{ status: MemberStatus; size?: number }>(), {
  size: 18,
});
</script>

<template>
  <!-- Couleur + icône ; en attente : pastille vide en pointillés. -->
  <span
    class="status-dot"
    :class="[
      status === 'PENDING' ? 'pending' : `bg-${statusAppearance[status].color}`,
    ]"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :data-status="status"
  >
    <v-icon :icon="statusAppearance[status].icon" :size="size * 0.66" />
  </span>
</template>

<style scoped>
.status-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 0 2px rgb(var(--v-theme-background));
}
.pending {
  border: 1.5px dashed rgba(var(--v-theme-on-surface), 0.85);
  background: rgb(var(--v-theme-background));
  color: rgba(var(--v-theme-on-surface), 0.85);
}
</style>
