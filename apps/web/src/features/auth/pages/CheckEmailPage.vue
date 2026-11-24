<script setup lang="ts">
import { mdiEmailFastOutline } from '@mdi/js';
import { AuthErrorCode } from '@watchlist/shared';
import { ref } from 'vue';
import { ApiRequestError } from '@/api/http';
import { authApi } from '../api';
import AuthLayout from '../components/AuthLayout.vue';
import { apiErrorMessage } from '../validation';

// L'adresse arrive par l'état de navigation, pas par l'URL (elle ne reste pas dans l'historique partagé).
const email = ref<string | null>(
  typeof history.state?.email === 'string' ? history.state.email : null,
);
const resent = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);

async function resend() {
  if (!email.value) return;
  loading.value = true;
  error.value = null;
  try {
    await authApi.resendVerification(email.value);
  } catch (e) {
    // Seul le quota d'emails épuisé mérite d'être dit : le reste (trop
    // d'essais, réseau) se rattrape en recliquant plus tard.
    if (
      e instanceof ApiRequestError &&
      e.code === AuthErrorCode.MAIL_QUOTA_EXCEEDED
    ) {
      error.value = apiErrorMessage(e);
      return;
    }
  } finally {
    loading.value = false;
  }
  resent.value = true;
}
</script>

<template>
  <AuthLayout :title="$t('auth.checkEmail.title')">
    <div class="text-center mb-4">
      <v-icon :icon="mdiEmailFastOutline" size="56" color="primary" />
    </div>
    <p class="mb-3">
      {{ $t('auth.checkEmail.body', { email: email ?? '…' }) }}
    </p>
    <p class="text-medium-emphasis text-body-medium mb-4">
      {{ $t('auth.checkEmail.spam') }}
    </p>
    <v-alert
      v-if="error"
      type="warning"
      variant="tonal"
      class="mb-4"
      :text="error"
    />
    <v-alert
      v-if="resent"
      type="success"
      variant="tonal"
      class="mb-4"
      :text="$t('auth.checkEmail.resent')"
    />
    <v-btn
      v-if="email"
      variant="tonal"
      rounded="pill"
      block
      :loading="loading"
      :disabled="resent || !!error"
      @click="resend"
    >
      {{ $t('auth.checkEmail.resend') }}
    </v-btn>

    <template #footer>
      <router-link :to="{ name: 'login' }" class="text-body-medium">
        {{ $t('auth.checkEmail.back') }}
      </router-link>
    </template>
  </AuthLayout>
</template>
