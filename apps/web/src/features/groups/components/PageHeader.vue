<script setup lang="ts">
import { mdiArrowLeft } from '@mdi/js';
import { useRouter } from 'vue-router';

/** `wrap` : titre long sur plusieurs lignes plutôt que tronqué. */
defineProps<{ title: string; wrap?: boolean }>();
const router = useRouter();

/** Retour à la page précédente, ou aux listes si on arrive directement ici. */
function back() {
  if (window.history.state?.back) router.back();
  else void router.push('/');
}
</script>

<template>
  <div class="d-flex align-center ga-1 mb-4">
    <v-btn
      :icon="mdiArrowLeft"
      variant="text"
      :aria-label="$t('common.back')"
      class="ml-n2"
      @click="back"
    />
    <h1
      class="font-display text-headline-small flex-grow-1"
      :class="wrap ? 'text-wrap' : 'text-truncate'"
    >
      {{ title }}
    </h1>
    <slot name="actions" />
  </div>
</template>
