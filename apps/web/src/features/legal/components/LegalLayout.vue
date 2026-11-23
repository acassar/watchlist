<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import PageHeader from '@/features/groups/components/PageHeader.vue';
import { LEGAL_UPDATED_AT } from '../publisher';

defineProps<{ title: string }>();
const { d } = useI18n();
</script>

<template>
  <v-container class="legal pa-4">
    <PageHeader :title="title" wrap />
    <p class="text-body-small text-medium-emphasis mb-6">
      {{
        $t('legal.updatedAt', { date: d(new Date(LEGAL_UPDATED_AT), 'long') })
      }}
    </p>
    <article class="legal-body text-body-medium">
      <slot />
    </article>
    <nav class="legal-nav mt-8 text-body-medium" :aria-label="$t('legal.nav')">
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
.legal {
  max-width: 720px;
}
.legal-body :deep(h2) {
  font-family: var(--v-font-heading);
  font-size: 1.25rem;
  font-weight: 600;
  margin: 2rem 0 0.75rem;
}
.legal-body :deep(h3) {
  font-size: 1rem;
  font-weight: 600;
  margin: 1.25rem 0 0.5rem;
}
.legal-body :deep(p),
.legal-body :deep(ul) {
  margin-bottom: 0.75rem;
  line-height: 1.6;
}
.legal-body :deep(ul) {
  padding-left: 1.25rem;
}
.legal-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
  font-size: 0.875rem;
}
.legal-body :deep(th),
.legal-body :deep(td) {
  text-align: left;
  vertical-align: top;
  padding: 6px 8px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.legal-body :deep(.table-scroll) {
  overflow-x: auto;
}
.legal-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}
</style>
