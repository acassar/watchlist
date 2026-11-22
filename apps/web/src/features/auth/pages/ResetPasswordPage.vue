<script setup lang="ts">
import { newPasswordSchema } from '@watchlist/shared';
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { authApi } from '../api';
import AuthLayout from '../components/AuthLayout.vue';
import PasswordField from '../components/PasswordField.vue';
import { useAuthStore } from '../store';
import { apiErrorMessage, tokenFromHash, zodRule } from '../validation';

const route = useRoute();
const auth = useAuthStore();
const token = tokenFromHash(route.hash);
const password = ref('');
const done = ref(false);
const loading = ref(false);
const error = ref<string | null>(token ? null : 'missing');

async function submit(event: Promise<{ valid: boolean }>) {
  if (!(await event).valid || !token) return;
  loading.value = true;
  error.value = null;
  try {
    await authApi.resetPassword({ token, password: password.value });
    // L'API a fermé toutes les sessions, y compris celle-ci.
    auth.clearSession();
    done.value = true;
  } catch (e) {
    error.value = apiErrorMessage(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthLayout :title="$t('auth.reset.title')">
    <template v-if="done">
      <v-alert
        type="success"
        variant="tonal"
        class="mb-4"
        :text="$t('auth.reset.success')"
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
      <PasswordField
        v-model="password"
        :label="$t('auth.newPassword')"
        :hint="$t('auth.passwordHint')"
        :rules="[zodRule(newPasswordSchema)]"
        autocomplete="new-password"
        class="mb-4"
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
      >
        {{ $t('auth.reset.submit') }}
      </v-btn>
    </v-form>
  </AuthLayout>
</template>
