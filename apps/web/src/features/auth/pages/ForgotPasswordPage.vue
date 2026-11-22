<script setup lang="ts">
import { emailSchema } from '@watchlist/shared';
import { ref } from 'vue';
import { authApi } from '../api';
import AuthLayout from '../components/AuthLayout.vue';
import { apiErrorMessage, zodRule } from '../validation';

const email = ref('');
const sentTo = ref<string | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

async function submit(event: Promise<{ valid: boolean }>) {
  if (!(await event).valid) return;
  loading.value = true;
  error.value = null;
  try {
    const normalized = emailSchema.parse(email.value);
    await authApi.forgotPassword(normalized);
    sentTo.value = normalized;
  } catch (e) {
    error.value = apiErrorMessage(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthLayout :title="$t('auth.forgot.title')">
    <v-alert
      v-if="sentTo"
      type="success"
      variant="tonal"
      :text="$t('auth.forgot.sent', { email: sentTo })"
    />
    <v-form v-else validate-on="submit lazy" @submit.prevent="submit">
      <p class="mb-4">{{ $t('auth.forgot.body') }}</p>
      <v-text-field
        v-model="email"
        :label="$t('auth.email')"
        :rules="[zodRule(emailSchema)]"
        type="email"
        inputmode="email"
        autocomplete="email"
        autocapitalize="off"
        spellcheck="false"
        variant="outlined"
        class="mb-2"
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
        {{ $t('auth.forgot.submit') }}
      </v-btn>
    </v-form>

    <template #footer>
      <router-link :to="{ name: 'login' }" class="text-body-medium">
        {{ $t('auth.checkEmail.back') }}
      </router-link>
    </template>
  </AuthLayout>
</template>
