<script setup lang="ts">
import LanguagePicker from '@/features/locale/LanguagePicker.vue';

defineProps<{ title: string; subtitle?: string }>();
</script>

<template>
  <!-- Écrans d'auth : une colonne centrée, pensée pour 360 px de large. -->
  <v-container class="auth-layout d-flex flex-column justify-center pa-4">
    <div class="text-center mb-6">
      <p class="font-display text-headline-large text-primary mb-1">
        {{ $t('app.title') }}
      </p>
      <p class="text-body-medium text-medium-emphasis">
        {{ $t('app.tagline') }}
      </p>
    </div>

    <v-card class="pa-2" rounded="xl" elevation="0" color="surface">
      <v-card-title class="font-display text-title-large text-wrap">
        {{ title }}
      </v-card-title>
      <v-card-subtitle v-if="subtitle" class="text-wrap">
        {{ subtitle }}
      </v-card-subtitle>
      <v-card-text>
        <slot />
      </v-card-text>
    </v-card>

    <div class="text-center mt-4">
      <slot name="footer" />
    </div>

    <nav class="legal-links text-body-small mt-6" :aria-label="$t('legal.nav')">
      <router-link :to="{ name: 'legal-notice' }">{{
        $t('legal.notice')
      }}</router-link>
      <router-link :to="{ name: 'privacy' }">{{
        $t('legal.privacy')
      }}</router-link>
      <router-link :to="{ name: 'terms' }">{{ $t('legal.terms') }}</router-link>
      <router-link :to="{ name: 'about' }" data-test="auth-about">{{
        $t('about.title')
      }}</router-link>
    </nav>

    <LanguagePicker compact class="d-flex justify-center mt-3" />
  </v-container>
</template>

<style scoped>
.auth-layout {
  max-width: 440px;
  min-height: 100dvh;
}
.legal-links {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 4px 16px;
}
</style>
