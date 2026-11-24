<script setup lang="ts">
import {
  mdiChevronRight,
  mdiDeleteOutline,
  mdiDownload,
  mdiFileDocumentOutline,
  mdiInformationOutline,
  mdiScaleBalance,
  mdiShieldAccountOutline,
} from '@mdi/js';
import {
  AccountErrorCode,
  AuthErrorCode,
  deleteAccountRequestSchema,
  emailSchema,
} from '@watchlist/shared';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ApiRequestError } from '@/api/http';
import { googleLoginUrl } from '@/features/auth/api';
import PasswordField from '@/features/auth/components/PasswordField.vue';
import { useAuthStore } from '@/features/auth/store';
import { apiErrorMessage, zodRule } from '@/features/auth/validation';
import PageHeader from '@/features/groups/components/PageHeader.vue';
import { forgetUser } from '@/features/groups/storage';
import DonateCard from '@/features/about/components/DonateCard.vue';
import { accountApi, downloadJson } from '../api';

const auth = useAuthStore();
const router = useRouter();
const { t } = useI18n();

/* Export */
const exporting = ref(false);
const exportError = ref<string | null>(null);
const exported = ref(false);

async function exportData() {
  exporting.value = true;
  exportError.value = null;
  try {
    const data = await accountApi.export();
    const day = data.exportedAt.slice(0, 10);
    downloadJson(data, `canapact-export-${day}.json`);
    exported.value = true;
  } catch (e) {
    exportError.value = apiErrorMessage(e);
  } finally {
    exporting.value = false;
  }
}

/* Suppression */
const deleteOpen = ref(false);
const confirmEmail = ref('');
const password = ref('');
const deleting = ref(false);
const deleteError = ref<string | null>(null);
/** Compte Google : la connexion est trop ancienne, il faut la refaire. */
const reauthRequired = ref(false);
const reauthUrl = googleLoginUrl('/settings');
const hasPassword = computed(() => auth.user?.hasPassword ?? false);
const emailMatches = computed(() => {
  const parsed = emailSchema.safeParse(confirmEmail.value);
  return parsed.success && parsed.data === auth.user?.email;
});
const canDelete = computed(
  () => emailMatches.value && (!hasPassword.value || password.value.length > 0),
);

watch(deleteOpen, (open) => {
  if (open) return;
  confirmEmail.value = '';
  password.value = '';
  deleteError.value = null;
  reauthRequired.value = false;
});

async function deleteAccount() {
  const user = auth.user;
  if (!user || !canDelete.value) return;
  deleting.value = true;
  deleteError.value = null;
  reauthRequired.value = false;
  try {
    await accountApi.delete(
      deleteAccountRequestSchema.parse({
        confirmEmail: confirmEmail.value,
        password: hasPassword.value ? password.value : undefined,
      }),
    );
    // Le serveur a effacé le cookie de session : on oublie aussi tout côté appareil.
    forgetUser(user.id);
    auth.clearSession();
    await router.replace({ name: 'login', query: { deleted: '1' } });
  } catch (e) {
    if (
      e instanceof ApiRequestError &&
      e.code === AccountErrorCode.REAUTH_REQUIRED
    ) {
      reauthRequired.value = true;
      return;
    }
    deleteError.value =
      e instanceof ApiRequestError &&
      e.code === AuthErrorCode.INVALID_CREDENTIALS
        ? t('settings.delete.wrongPassword')
        : apiErrorMessage(e);
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <v-container class="settings pa-4">
    <PageHeader :title="$t('settings.title')" />

    <h2 class="text-title-small text-medium-emphasis mb-2">
      {{ $t('settings.account') }}
    </h2>
    <v-list v-if="auth.user" bg-color="transparent" class="mb-4">
      <v-list-item
        :title="auth.user.displayName"
        :subtitle="auth.user.email"
        data-test="settings-user"
      />
    </v-list>

    <h2 class="text-title-small text-medium-emphasis mb-2">
      {{ $t('settings.data') }}
    </h2>
    <p class="text-body-medium text-medium-emphasis mb-3">
      {{ $t('settings.exportHint') }}
    </p>
    <v-btn
      variant="tonal"
      rounded="pill"
      :prepend-icon="mdiDownload"
      :loading="exporting"
      data-test="export"
      @click="exportData"
    >
      {{ $t('settings.export') }}
    </v-btn>
    <p
      v-if="exported"
      class="text-body-small text-medium-emphasis mt-2"
      role="status"
    >
      {{ $t('settings.exported') }}
    </p>
    <v-alert
      v-if="exportError"
      type="error"
      variant="tonal"
      class="mt-3"
      :text="exportError"
    />

    <h2 class="text-title-small text-medium-emphasis mt-8 mb-2">
      {{ $t('settings.support') }}
    </h2>
    <DonateCard class="mb-2" />
    <v-list bg-color="transparent">
      <v-list-item
        :to="{ name: 'about' }"
        :prepend-icon="mdiInformationOutline"
        :append-icon="mdiChevronRight"
        :title="$t('about.title')"
        data-test="settings-about"
      />
    </v-list>

    <h2 class="text-title-small text-medium-emphasis mt-8 mb-2">
      {{ $t('settings.legal') }}
    </h2>
    <v-list bg-color="transparent" class="mb-4">
      <v-list-item
        :to="{ name: 'privacy' }"
        :prepend-icon="mdiShieldAccountOutline"
        :append-icon="mdiChevronRight"
        :title="$t('legal.privacyTitle')"
      />
      <v-list-item
        :to="{ name: 'terms' }"
        :prepend-icon="mdiFileDocumentOutline"
        :append-icon="mdiChevronRight"
        :title="$t('legal.termsTitle')"
      />
      <v-list-item
        :to="{ name: 'legal-notice' }"
        :prepend-icon="mdiScaleBalance"
        :append-icon="mdiChevronRight"
        :title="$t('legal.notice')"
      />
    </v-list>

    <h2 class="text-title-small text-error mt-4 mb-2">
      {{ $t('settings.danger') }}
    </h2>
    <p class="text-body-medium text-medium-emphasis mb-3">
      {{ $t('settings.deleteHint') }}
    </p>
    <v-btn
      color="error"
      variant="outlined"
      rounded="pill"
      :prepend-icon="mdiDeleteOutline"
      data-test="delete-account"
      @click="deleteOpen = true"
    >
      {{ $t('settings.danger') }}
    </v-btn>

    <v-dialog v-model="deleteOpen" max-width="440">
      <v-card rounded="xl" data-test="delete-dialog">
        <v-card-title class="font-display text-title-large text-wrap">
          {{ $t('settings.delete.title') }}
        </v-card-title>
        <v-form @submit.prevent="deleteAccount">
          <v-card-text>
            <p class="mb-2">{{ $t('settings.delete.intro') }}</p>
            <ul class="delete-points mb-3">
              <li>{{ $t('settings.delete.point1') }}</li>
              <li>{{ $t('settings.delete.point2') }}</li>
              <li>{{ $t('settings.delete.point3') }}</li>
              <li>{{ $t('settings.delete.point4') }}</li>
            </ul>
            <p class="text-medium-emphasis mb-4">
              {{ $t('settings.delete.exportFirst') }}
            </p>
            <v-text-field
              v-model="confirmEmail"
              :label="
                $t('settings.delete.confirmEmail', {
                  email: auth.user?.email ?? '',
                })
              "
              :rules="[zodRule(emailSchema)]"
              type="email"
              inputmode="email"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              variant="outlined"
              class="mb-2"
              data-test="confirm-email"
            />
            <PasswordField
              v-if="hasPassword"
              v-model="password"
              :label="$t('settings.delete.password')"
              autocomplete="current-password"
              data-test="confirm-password"
            />
            <v-alert
              v-if="reauthRequired"
              type="info"
              variant="tonal"
              class="mt-2"
              data-test="reauth-required"
            >
              <p class="mb-2">{{ $t('settings.delete.reauth') }}</p>
              <v-btn
                :href="reauthUrl"
                variant="flat"
                rounded="pill"
                size="small"
                data-test="reauth-google"
              >
                {{ $t('settings.delete.reauthButton') }}
              </v-btn>
            </v-alert>
            <v-alert
              v-if="deleteError"
              type="error"
              variant="tonal"
              class="mt-2"
              :text="deleteError"
            />
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" @click="deleteOpen = false">
              {{ $t('common.cancel') }}
            </v-btn>
            <v-btn
              type="submit"
              color="error"
              variant="flat"
              :disabled="!canDelete"
              :loading="deleting"
              data-test="confirm-delete"
            >
              {{ $t('settings.delete.submit') }}
            </v-btn>
          </v-card-actions>
        </v-form>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.settings {
  max-width: 600px;
  /* Au-dessus de la barre d'onglets. */
  padding-bottom: 96px !important;
}
.delete-points {
  padding-left: 1.25rem;
}
.delete-points li {
  margin-bottom: 4px;
}
</style>
