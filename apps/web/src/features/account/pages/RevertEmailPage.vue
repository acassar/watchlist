<script setup lang="ts">
import { AuthErrorCode, newPasswordSchema } from '@watchlist/shared';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ApiRequestError } from '@/api/http';
import { authApi } from '@/features/auth/api';
import AuthLayout from '@/features/auth/components/AuthLayout.vue';
import PasswordField from '@/features/auth/components/PasswordField.vue';
import { useAuthStore } from '@/features/auth/store';
import {
  apiErrorMessage,
  tokenFromHash,
  zodRule,
} from '@/features/auth/validation';

/**
 * « Ce n'est pas moi », depuis l'ancienne adresse : elle revient sur le
 * compte avec un nouveau mot de passe, et tous les appareils sont déconnectés.
 */
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { t } = useI18n();
const token = tokenFromHash(route.hash);
const password = ref('');
const done = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);

onMounted(() => {
  // Le jeton reste en mémoire pour le formulaire, pas dans l'historique.
  if (token) void router.replace({ hash: '' });
});

async function submit(event: Promise<{ valid: boolean }>) {
  if (!(await event).valid || !token) return;
  loading.value = true;
  error.value = null;
  try {
    await authApi.revertEmailChange({ token, password: password.value });
    auth.clearSession();
    done.value = true;
  } catch (e) {
    error.value =
      e instanceof ApiRequestError && e.code === AuthErrorCode.EMAIL_TAKEN
        ? t('errors.EMAIL_TAKEN')
        : apiErrorMessage(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthLayout :title="$t('settings.revert.title')">
    <template v-if="done">
      <v-alert
        type="success"
        variant="tonal"
        class="mb-4"
        :text="$t('settings.revert.success')"
        data-test="revert-done"
      />
      <v-btn
        :to="{ name: 'login' }"
        color="primary"
        size="large"
        rounded="pill"
        block
      >
        {{ $t('auth.reset.login') }}
      </v-btn>
    </template>
    <v-alert
      v-else-if="!token"
      type="error"
      variant="tonal"
      :text="$t('auth.missingToken')"
    />
    <v-form v-else validate-on="submit lazy" @submit.prevent="submit">
      <p class="text-body-medium mb-4">{{ $t('settings.revert.intro') }}</p>
      <PasswordField
        v-model="password"
        :label="$t('auth.newPassword')"
        :hint="$t('auth.passwordHint')"
        :rules="[zodRule(newPasswordSchema)]"
        autocomplete="new-password"
        class="mb-4"
        data-test="revert-password"
      />
      <v-alert
        v-if="error"
        type="error"
        variant="tonal"
        class="mb-4"
        :text="error"
      />
      <v-btn
        type="submit"
        color="primary"
        size="large"
        rounded="pill"
        block
        :loading="loading"
        data-test="revert-submit"
      >
        {{ $t('settings.revert.submit') }}
      </v-btn>
    </v-form>
  </AuthLayout>
</template>
