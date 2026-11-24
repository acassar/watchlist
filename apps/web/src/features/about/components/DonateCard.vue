<script setup lang="ts">
import { mdiHeartOutline, mdiOpenInNew } from '@mdi/js';
import { computed } from 'vue';
import { donationUrl } from '../support';

/** Lien sortant vers Liberapay. Rien ne s'affiche tant qu'aucun compte n'est configuré. */
const props = defineProps<{ username?: string }>();
const url = computed(() => donationUrl(props.username));
</script>

<template>
  <v-card
    v-if="url"
    rounded="xl"
    variant="tonal"
    color="primary"
    class="donate pa-4"
    data-test="donate-card"
  >
    <p class="font-display text-title-large mb-2">{{ $t('donate.title') }}</p>
    <p class="text-body-medium mb-4">{{ $t('donate.pitch') }}</p>
    <v-btn
      :href="url"
      target="_blank"
      rel="noopener noreferrer"
      color="primary"
      variant="flat"
      rounded="pill"
      :prepend-icon="mdiHeartOutline"
      :append-icon="mdiOpenInNew"
      data-test="donate-link"
    >
      {{ $t('donate.button') }}
      <span class="d-sr-only">{{ $t('donate.newTab') }}</span>
    </v-btn>
    <p class="text-body-small text-medium-emphasis mt-3 mb-0">
      {{ $t('donate.hint') }}
    </p>
  </v-card>
</template>
