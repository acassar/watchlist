<script setup lang="ts">
import {
  AuthErrorCode,
  EMAIL_CHANGE_MAX,
  EMAIL_CHANGE_WINDOW_DAYS,
  emailSchema,
} from '@watchlist/shared';
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ApiRequestError } from '@/api/http';
import { authApi } from '@/features/auth/api';
import PasswordField from '@/features/auth/components/PasswordField.vue';
import { apiErrorMessage, zodRule } from '@/features/auth/validation';

const open = defineModel<boolean>({ required: true });
/** Adresse à laquelle le lien de confirmation est parti. */
const emit = defineEmits<{ sent: [email: string] }>();
const { t } = useI18n();

const newEmail = ref('');
const password = ref('');
const sending = ref(false);
const error = ref<string | null>(null);

watch(open, (value) => {
  if (value) return;
  newEmail.value = '';
  password.value = '';
  error.value = null;
});

function message(e: unknown): string {
  if (!(e instanceof ApiRequestError)) return apiErrorMessage(e);
  switch (e.code) {
    case AuthErrorCode.INVALID_CREDENTIALS:
      return t('settings.delete.wrongPassword');
    case AuthErrorCode.EMAIL_ALREADY_REGISTERED:
      return t('settings.email.taken');
    case AuthErrorCode.EMAIL_CHANGE_LIMIT:
      return t('errors.EMAIL_CHANGE_LIMIT', {
        max: EMAIL_CHANGE_MAX,
        days: EMAIL_CHANGE_WINDOW_DAYS,
      });
    default:
      return apiErrorMessage(e);
  }
}

async function submit(event: Promise<{ valid: boolean }>) {
  if (!(await event).valid) return;
  sending.value = true;
  error.value = null;
  try {
    const parsed = emailSchema.parse(newEmail.value);
    await authApi.requestEmailChange({
      newEmail: parsed,
      password: password.value,
    });
    open.value = false;
    emit('sent', parsed);
  } catch (e) {
    error.value = message(e);
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card rounded="xl" data-test="email-dialog">
      <v-card-title class="font-display text-title-large text-wrap">
        {{ $t('settings.email.title') }}
      </v-card-title>
      <v-form validate-on="submit lazy" @submit.prevent="submit">
        <v-card-text>
          <p class="text-body-medium text-medium-emphasis mb-4">
            {{
              $t('settings.email.intro', {
                max: EMAIL_CHANGE_MAX,
                days: EMAIL_CHANGE_WINDOW_DAYS,
              })
            }}
          </p>
          <v-text-field
            v-model="newEmail"
            :label="$t('settings.email.newEmail')"
            :rules="[zodRule(emailSchema)]"
            type="email"
            inputmode="email"
            autocomplete="email"
            autocapitalize="off"
            spellcheck="false"
            variant="outlined"
            class="mb-2"
            data-test="new-email"
          />
          <PasswordField
            v-model="password"
            :label="$t('settings.delete.password')"
            :rules="[(v) => !!v || $t('validation.required')]"
            autocomplete="current-password"
            data-test="email-password"
          />
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
            :loading="sending"
            data-test="send-email-change"
          >
            {{ $t('settings.email.submit') }}
          </v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>
