<script setup lang="ts">
import { newPasswordSchema } from '@watchlist/shared';
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authApi } from '../api';
import AuthLayout from '../components/AuthLayout.vue';
import PasswordField from '../components/PasswordField.vue';
import { useAuthStore } from '../store';
import { apiErrorMessage, tokenFromHash, zodRule } from '../validation';

/**
 * Lien reçu par email pour ajouter un mot de passe à un compte Google. Le mot de
 * passe se choisit ici : celui tapé à l'inscription n'est jamais repris, pour
 * qu'un inconnu ne puisse pas faire valider le sien par le vrai propriétaire.
 */
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const token = tokenFromHash(route.hash);
// Le jeton ne doit pas rester dans la barre d'adresse ni dans l'historique.
if (token) void router.replace({ hash: '' });
const password = ref('');
const done = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);

async function submit(event: Promise<{ valid: boolean }>) {
  if (!(await event).valid || !token) return;
  loading.value = true;
  error.value = null;
  try {
    auth.applySession(
      await authApi.confirmLinkPassword({ token, password: password.value }),
    );
    done.value = true;
  } catch (e) {
    error.value = apiErrorMessage(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthLayout :title="$t('auth.link.title')">
    <template v-if="done">
      <v-alert
        type="success"
        variant="tonal"
        class="mb-4"
        :text="$t('auth.link.success')"
      />
      <v-btn to="/" color="primary" size="large" rounded="pill" block>
        {{ $t('auth.link.continue') }}
      </v-btn>
    </template>
    <v-alert
      v-else-if="!token"
      type="error"
      variant="tonal"
      :text="$t('auth.missingToken')"
    />
    <v-form v-else validate-on="submit lazy" @submit.prevent="submit">
      <p class="mb-4">{{ $t('auth.link.body') }}</p>
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
        {{ $t('auth.link.submit') }}
      </v-btn>
    </v-form>
  </AuthLayout>
</template>
