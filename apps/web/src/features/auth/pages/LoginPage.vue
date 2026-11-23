<script setup lang="ts">
import {
  AuthErrorCode,
  emailSchema,
  isGoogleErrorCode,
  loginRequestSchema,
} from '@watchlist/shared';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ApiRequestError } from '@/api/http';
import { authApi } from '../api';
import AuthLayout from '../components/AuthLayout.vue';
import GoogleButton from '../components/GoogleButton.vue';
import PasswordField from '../components/PasswordField.vue';
import { safeRedirect } from '../redirect';
import { useAuthStore } from '../store';
import { apiErrorMessage, zodRule } from '../validation';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const notVerified = ref(false);

/** Retour d'une connexion Google qui n'a pas abouti (`/login?error=google_…`). */
const googleError = computed(() =>
  isGoogleErrorCode(route.query.error)
    ? t(`auth.google.errors.${route.query.error}`)
    : null,
);

async function submit(event: Promise<{ valid: boolean }>) {
  if (!(await event).valid) return;
  loading.value = true;
  error.value = null;
  notVerified.value = false;
  try {
    await auth.login(
      loginRequestSchema.parse({
        email: email.value,
        password: password.value,
      }),
    );
    await router.replace(safeRedirect(route.query.redirect));
  } catch (e) {
    if (
      e instanceof ApiRequestError &&
      e.code === AuthErrorCode.EMAIL_NOT_VERIFIED
    ) {
      notVerified.value = true;
    } else {
      error.value = apiErrorMessage(e);
    }
  } finally {
    loading.value = false;
  }
}

async function resend() {
  const normalized = emailSchema.parse(email.value);
  await authApi.resendVerification(normalized).catch(() => undefined);
  await router.push({ name: 'check-email', state: { email: normalized } });
}
</script>

<template>
  <AuthLayout :title="$t('auth.login.title')">
    <v-alert
      v-if="route.query.deleted === '1'"
      type="success"
      variant="tonal"
      class="mb-4"
      :text="$t('settings.deleted')"
      data-test="account-deleted"
    />
    <v-alert
      v-if="googleError"
      type="warning"
      variant="tonal"
      class="mb-4"
      :text="googleError"
      data-test="google-error"
    />
    <GoogleButton :next="route.query.redirect" />

    <v-form validate-on="submit lazy" @submit.prevent="submit">
      <v-text-field
        v-model="email"
        :label="$t('auth.email')"
        :rules="[zodRule(emailSchema)]"
        type="email"
        inputmode="email"
        autocomplete="username"
        autocapitalize="off"
        spellcheck="false"
        variant="outlined"
        class="mb-2"
      />
      <PasswordField
        v-model="password"
        :label="$t('auth.password')"
        :rules="[zodRule(loginRequestSchema.shape.password)]"
        autocomplete="current-password"
      />

      <div class="text-right mb-4">
        <router-link :to="{ name: 'forgot-password' }" class="text-body-medium">
          {{ $t('auth.login.forgot') }}
        </router-link>
      </div>

      <v-alert
        v-if="notVerified"
        type="info"
        variant="tonal"
        class="mb-4"
        :text="$t('auth.login.notVerified')"
      >
        <template #append>
          <v-btn variant="text" size="small" @click="resend">
            {{ $t('auth.login.resend') }}
          </v-btn>
        </template>
      </v-alert>
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
        {{ $t('auth.login.submit') }}
      </v-btn>
    </v-form>

    <template #footer>
      <span class="text-body-medium text-medium-emphasis">
        {{ $t('auth.login.noAccount') }}
      </span>
      <router-link
        :to="{ name: 'register', query: route.query }"
        class="text-body-medium ml-1"
      >
        {{ $t('auth.login.register') }}
      </router-link>
    </template>
  </AuthLayout>
</template>
