<script setup lang="ts">
defineProps<{ view: 'alone' | 'together' | 'pending' }>();
</script>

<template>
  <v-container class="pa-4">
    <h1 class="text-title-large mb-4">{{ $t(`views.${view}`) }}</h1>
    <p class="text-medium-emphasis">{{ $t('empty') }}</p>
  </v-container>
</template>
