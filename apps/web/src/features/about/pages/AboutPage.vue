<script setup lang="ts">
import PageHeader from '@/features/groups/components/PageHeader.vue';
import DonateCard from '../components/DonateCard.vue';
</script>

<template>
  <v-container class="about pa-4">
    <PageHeader :title="$t('about.title')" />

    <p class="font-display text-headline-small text-primary mb-1">
      {{ $t('app.title') }}
    </p>
    <p class="text-body-large text-medium-emphasis mb-6">
      {{ $t('app.tagline') }}
    </p>

    <p class="text-body-medium mb-3">{{ $t('about.what') }}</p>
    <p class="text-body-medium mb-8">{{ $t('about.who') }}</p>

    <DonateCard class="mb-8" />

    <h2 class="text-title-small text-medium-emphasis mb-2">
      {{ $t('about.credits') }}
    </h2>
    <p class="text-body-medium mb-8">{{ $t('about.youtube') }}</p>

    <nav class="about-links text-body-medium" :aria-label="$t('legal.nav')">
      <router-link :to="{ name: 'legal-notice' }">{{
        $t('legal.notice')
      }}</router-link>
      <router-link :to="{ name: 'privacy' }">{{
        $t('legal.privacy')
      }}</router-link>
      <router-link :to="{ name: 'terms' }">{{ $t('legal.terms') }}</router-link>
    </nav>
  </v-container>
</template>

<style scoped>
.about {
  max-width: 600px;
}
.about-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}
</style>
