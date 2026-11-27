<script setup lang="ts">
import {
  AuthErrorCode,
  EMAIL_CHANGE_MAX,
  EMAIL_CHANGE_WINDOW_DAYS,
} from '@watchlist/shared';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ApiRequestError } from '@/api/http';
import { authApi } from '@/features/auth/api';
import AuthLayout from '@/features/auth/components/AuthLayout.vue';
import { useAuthStore } from '@/features/auth/store';
import { apiErrorMessage, tokenFromHash } from '@/features/auth/validation';

/** Atterrissage du lien reçu à la nouvelle adresse : le changement se fait au clic. */
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { t } = useI18n();
const state = ref<'loading' | 'success' | 'error'>('loading');
const error = ref<string | null>(null);

function message(e: unknown): string {
  if (e instanceof ApiRequestError) {
    if (e.code === AuthErrorCode.EMAIL_ALREADY_REGISTERED)
      return t('settings.email.taken');
    if (e.code === AuthErrorCode.EMAIL_CHANGE_LIMIT)
      return t('errors.EMAIL_CHANGE_LIMIT', {
        max: EMAIL_CHANGE_MAX,
        days: EMAIL_CHANGE_WINDOW_DAYS,
      });
  }
  return apiErrorMessage(e);
}

onMounted(async () => {
  const token = tokenFromHash(route.hash);
  // Le jeton ne doit pas rester dans la barre d'adresse ni dans l'historique.
  await router.replace({ hash: '' });
  if (!token) {
    error.value = t('auth.missingToken');
    state.value = 'error';
    return;
  }
  try {
    await authApi.confirmEmailChange(token);
    // Connecté sur cet appareil : les réglages affichent la nouvelle adresse.
    await auth.reloadUser().catch(() => undefined);
    state.value = 'success';
  } catch (e) {
    error.value = message(e);
    state.value = 'error';
  }
});
</script>

<template>
  <AuthLayout :title="$t('settings.email.confirmTitle')">
    <div v-if="state === 'loading'" class="text-center py-4">
      <v-progress-circular indeterminate color="primary" class="mb-4" />
      <p>{{ $t('settings.email.confirming') }}</p>
    </div>
    <template v-else-if="state === 'success'">
      <v-alert
        type="success"
        variant="tonal"
        class="mb-4"
        :text="$t('settings.email.confirmed')"
        data-test="email-confirmed"
      />
      <v-btn
        :to="auth.isAuthenticated ? { name: 'settings' } : { name: 'login' }"
        color="primary"
        size="large"
        rounded="pill"
        block
      >
        {{
          auth.isAuthenticated
            ? $t('settings.email.backToSettings')
            : $t('auth.reset.login')
        }}
      </v-btn>
    </template>
    <template v-else>
      <v-alert
        type="error"
        variant="tonal"
        class="mb-4"
        :text="error ?? ''"
        data-test="email-confirm-error"
      />
      <v-btn to="/" variant="tonal" rounded="pill" block>
        {{ $t('common.back') }}
      </v-btn>
    </template>
  </AuthLayout>
</template>
