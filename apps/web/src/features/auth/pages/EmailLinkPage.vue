<script setup lang="ts">
import type { AuthResponse } from '@watchlist/shared';
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authApi } from '../api';
import AuthLayout from '../components/AuthLayout.vue';
import { useAuthStore } from '../store';
import { apiErrorMessage, tokenFromHash } from '../validation';

/**
 * Atterrissage des liens qui ouvrent une session au clic :
 * vérification d'email et confirmation d'ajout d'un mot de passe.
 */
const props = defineProps<{ kind: 'verify' | 'link' }>();

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const state = ref<'loading' | 'success' | 'error'>('loading');
const error = ref<string | null>(null);

const confirm: Record<
  typeof props.kind,
  (token: string) => Promise<AuthResponse>
> = {
  verify: authApi.verifyEmail,
  link: authApi.confirmLinkPassword,
};

onMounted(async () => {
  const token = tokenFromHash(route.hash);
  // Le jeton ne doit pas rester dans la barre d'adresse ni dans l'historique.
  await router.replace({ hash: '' });
  if (!token) {
    state.value = 'error';
    return;
  }
  try {
    auth.applySession(await confirm[props.kind](token));
    state.value = 'success';
  } catch (e) {
    error.value = apiErrorMessage(e);
    state.value = 'error';
  }
});
</script>

<template>
  <AuthLayout :title="$t(`auth.${kind}.title`)">
    <div v-if="state === 'loading'" class="text-center py-4">
      <v-progress-circular indeterminate color="primary" class="mb-4" />
      <p>{{ $t(`auth.${kind}.loading`) }}</p>
    </div>
    <template v-else-if="state === 'success'">
      <v-alert
        type="success"
        variant="tonal"
        class="mb-4"
        :text="
          kind === 'verify'
            ? $t('auth.verify.success')
            : $t('auth.link.success')
        "
      />
      <v-btn to="/" color="primary" size="large" rounded="pill" block>
        {{ $t(`auth.${kind}.continue`) }}
      </v-btn>
    </template>
    <template v-else>
      <v-alert
        type="error"
        variant="tonal"
        class="mb-4"
        :text="
          error
            ? kind === 'verify'
              ? $t('auth.verify.failed')
              : error
            : $t('auth.missingToken')
        "
      />
      <v-btn :to="{ name: 'login' }" variant="tonal" rounded="pill" block>
        {{ $t('auth.checkEmail.back') }}
      </v-btn>
    </template>
  </AuthLayout>
</template>
