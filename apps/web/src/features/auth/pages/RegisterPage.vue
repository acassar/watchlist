<script setup lang="ts">
import {
  displayNameSchema,
  emailSchema,
  newPasswordSchema,
  registerRequestSchema,
} from '@watchlist/shared';
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authApi } from '../api';
import AuthLayout from '../components/AuthLayout.vue';
import GoogleButton from '../components/GoogleButton.vue';
import PasswordField from '../components/PasswordField.vue';
import { useAuthStore } from '../store';
import { apiErrorMessage, zodRule } from '../validation';

const router = useRouter();
const auth = useAuthStore();
const route = useRoute();

const displayName = ref('');
const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

async function submit(event: Promise<{ valid: boolean }>) {
  if (!(await event).valid) return;
  loading.value = true;
  error.value = null;
  try {
    const body = registerRequestSchema.parse({
      displayName: displayName.value,
      email: email.value,
      password: password.value,
    });
    await authApi.register(body);
    // La réponse est la même que l'adresse soit nouvelle ou non : on renvoie vers les emails.
    await router.push({ name: 'check-email', state: { email: body.email } });
  } catch (e) {
    error.value = apiErrorMessage(e, {
      googleAvailable: !!auth.providers?.google,
    });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthLayout
    :title="$t('auth.register.title')"
    :subtitle="$t('auth.register.subtitle')"
  >
    <GoogleButton :next="route.query.redirect" />

    <v-form validate-on="submit lazy" @submit.prevent="submit">
      <v-text-field
        v-model="displayName"
        :label="$t('auth.displayName')"
        :hint="$t('auth.displayNameHint')"
        :rules="[zodRule(displayNameSchema)]"
        autocomplete="nickname"
        variant="outlined"
        class="mb-2"
      />
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
      <PasswordField
        v-model="password"
        :label="$t('auth.password')"
        :hint="$t('auth.passwordHint')"
        :rules="[zodRule(newPasswordSchema)]"
        autocomplete="new-password"
        class="mb-4"
      />

      <!-- Accepter les CGU avant de créer le compte, y compris avec Google (plus haut). -->
      <i18n-t
        keypath="auth.register.legal"
        tag="p"
        class="text-body-small text-medium-emphasis mb-4"
        data-test="register-legal"
        scope="global"
      >
        <template #terms>
          <router-link :to="{ name: 'terms' }">{{
            $t('auth.register.legalTerms')
          }}</router-link>
        </template>
        <template #privacy>
          <router-link :to="{ name: 'privacy' }">{{
            $t('auth.register.legalPrivacy')
          }}</router-link>
        </template>
      </i18n-t>

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
        {{ $t('auth.register.submit') }}
      </v-btn>
    </v-form>

    <template #footer>
      <span class="text-body-medium text-medium-emphasis">
        {{ $t('auth.register.hasAccount') }}
      </span>
      <router-link
        :to="{ name: 'login', query: route.query }"
        class="text-body-medium ml-1"
      >
        {{ $t('auth.register.login') }}
      </router-link>
    </template>
  </AuthLayout>
</template>
