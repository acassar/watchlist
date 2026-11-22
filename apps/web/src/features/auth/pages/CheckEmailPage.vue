<script setup lang="ts">
import { mdiEmailFastOutline } from '@mdi/js';
import { ref } from 'vue';
import { authApi } from '../api';
import AuthLayout from '../components/AuthLayout.vue';

// L'adresse arrive par l'état de navigation, pas par l'URL (elle ne reste pas dans l'historique partagé).
const email = ref<string | null>(
  typeof history.state?.email === 'string' ? history.state.email : null,
);
const resent = ref(false);
const loading = ref(false);

async function resend() {
  if (!email.value) return;
  loading.value = true;
  await authApi.resendVerification(email.value).catch(() => undefined);
  loading.value = false;
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
      :disabled="resent"
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
