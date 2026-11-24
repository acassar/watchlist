<script setup lang="ts">
import type { Component } from 'vue';
import { currentLocale } from '@/features/locale/locale';
import LegalNoticePage from '../pages/LegalNoticePage.vue';
import PrivacyPage from '../pages/PrivacyPage.vue';
import TermsPage from '../pages/TermsPage.vue';
import LegalNoticePageEn from '../pages/en/LegalNoticePageEn.vue';
import PrivacyPageEn from '../pages/en/PrivacyPageEn.vue';
import TermsPageEn from '../pages/en/TermsPageEn.vue';

/**
 * Page légale dans la langue de l'interface (chargée à la demande par le
 * routeur, avec ses deux versions). Le texte anglais est une traduction de
 * confort : la version française fait foi (bandeau en tête, voir LegalLayout).
 */
const props = defineProps<{ page: 'notice' | 'privacy' | 'terms' }>();

const pages: Record<typeof props.page, { fr: Component; en: Component }> = {
  notice: { fr: LegalNoticePage, en: LegalNoticePageEn },
  privacy: { fr: PrivacyPage, en: PrivacyPageEn },
  terms: { fr: TermsPage, en: TermsPageEn },
};
</script>

<template>
  <component :is="pages[page][currentLocale]" />
</template>
