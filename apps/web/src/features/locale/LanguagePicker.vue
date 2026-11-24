<script setup lang="ts">
import { SUPPORTED_LOCALES, type Locale } from '@watchlist/shared';
import { ref } from 'vue';
import { useAuthStore } from '@/features/auth/store';
import { apiErrorMessage } from '@/features/auth/validation';
import { currentLocale } from './locale';

/**
 * Choix de la langue. Chaque langue s'affiche dans sa propre langue
 * (« English » même en français) : on la reconnaît sans lire la langue courante.
 */
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });

const auth = useAuthStore();
const error = ref<string | null>(null);

async function choose(locale: Locale | undefined) {
  if (!locale || locale === currentLocale.value) return;
  error.value = null;
  try {
    await auth.changeLocale(locale);
  } catch (e) {
    error.value = apiErrorMessage(e);
  }
}
</script>

<template>
  <div>
    <v-btn-toggle
      :model-value="currentLocale"
      :density="compact ? 'compact' : 'comfortable'"
      :variant="compact ? 'text' : 'outlined'"
      color="primary"
      rounded="pill"
      mandatory
      :aria-label="$t('language.label')"
      data-test="language-picker"
      @update:model-value="choose"
    >
      <v-btn
        v-for="locale in SUPPORTED_LOCALES"
        :key="locale"
        :value="locale"
        :lang="locale"
        :size="compact ? 'small' : 'default'"
        :data-test="`language-${locale}`"
      >
        {{ $t(`language.${locale}`) }}
      </v-btn>
    </v-btn-toggle>
    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      class="mt-2"
      density="compact"
      :text="error"
    />
  </div>
</template>
