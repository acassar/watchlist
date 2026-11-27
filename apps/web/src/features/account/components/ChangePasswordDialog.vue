<script setup lang="ts">
import { AuthErrorCode, newPasswordSchema } from '@watchlist/shared';
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ApiRequestError } from '@/api/http';
import { authApi } from '@/features/auth/api';
import PasswordField from '@/features/auth/components/PasswordField.vue';
import { apiErrorMessage, zodRule } from '@/features/auth/validation';

const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ done: [] }>();
const { t } = useI18n();

const currentPassword = ref('');
const newPassword = ref('');
const saving = ref(false);
const error = ref<string | null>(null);

watch(open, (value) => {
  if (value) return;
  currentPassword.value = '';
  newPassword.value = '';
  error.value = null;
});

async function submit(event: Promise<{ valid: boolean }>) {
  if (!(await event).valid) return;
  saving.value = true;
  error.value = null;
  try {
    await authApi.changePassword({
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    });
    open.value = false;
    emit('done');
  } catch (e) {
    error.value =
      e instanceof ApiRequestError &&
      e.code === AuthErrorCode.INVALID_CREDENTIALS
        ? t('settings.delete.wrongPassword')
        : apiErrorMessage(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card rounded="xl" data-test="password-dialog">
      <v-card-title class="font-display text-title-large text-wrap">
        {{ $t('settings.password.title') }}
      </v-card-title>
      <v-form validate-on="submit lazy" @submit.prevent="submit">
        <v-card-text>
          <PasswordField
            v-model="currentPassword"
            :label="$t('settings.password.current')"
            :rules="[(v) => !!v || $t('validation.required')]"
            autocomplete="current-password"
            class="mb-2"
            data-test="current-password"
          />
          <PasswordField
            v-model="newPassword"
            :label="$t('auth.newPassword')"
            :hint="$t('auth.passwordHint')"
            :rules="[zodRule(newPasswordSchema)]"
            autocomplete="new-password"
            data-test="new-password"
          />
          <p class="text-body-small text-medium-emphasis mt-4">
            {{ $t('settings.password.otherDevices') }}
          </p>
          <v-alert
            v-if="error"
            type="error"
            variant="tonal"
            class="mt-3"
            :text="error"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="open = false">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            type="submit"
            color="primary"
            variant="flat"
            :loading="saving"
            data-test="save-password"
          >
            {{ $t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>
