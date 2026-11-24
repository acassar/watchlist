<script setup lang="ts">
import {
  invitationCodeSchema,
  type InvitationPreview,
  type InvitationRequest,
} from '@watchlist/shared';
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiRequestError } from '@/api/http';
import { useAuthStore } from '@/features/auth/store';
import {
  apiErrorMessage,
  tokenFromHash,
  zodRule,
} from '@/features/auth/validation';
import AuthLayout from '@/features/auth/components/AuthLayout.vue';
import { groupsApi } from '../api';
import { pendingInvite } from '../storage';
import { useGroupsStore } from '../store';

const auth = useAuthStore();
const groups = useGroupsStore();
const route = useRoute();
const router = useRouter();

const code = ref('');
/** Invitation en cours d'examen (lien ou code), et ce qu'elle ouvre. */
const lookup = ref<InvitationRequest | null>(null);
const preview = ref<InvitationPreview | null>(null);
const loading = ref(false);
/** Vérification d'un lien à l'ouverture de la page. */
const checkingLink = ref(false);
const error = ref<string | null>(null);

function fail(e: unknown) {
  error.value = apiErrorMessage(e);
  if (e instanceof ApiRequestError && e.code === 'INVITATION_INVALID') {
    // Lien mort : inutile de le reproposer après la prochaine connexion.
    pendingInvite.clear();
    lookup.value = null;
  }
}

async function loadPreview(request: InvitationRequest) {
  loading.value = true;
  error.value = null;
  try {
    preview.value = await groupsApi.previewInvitation(request);
    lookup.value = request;
  } catch (e) {
    fail(e);
  } finally {
    loading.value = false;
  }
}

async function submitCode(event: Promise<{ valid: boolean }>) {
  if (!(await event).valid) return;
  await loadPreview({ code: invitationCodeSchema.parse(code.value) });
}

async function openGroup(groupId: string) {
  pendingInvite.clear();
  await router.replace({ name: 'alone' });
  groups.select(groupId);
}

async function accept() {
  if (!lookup.value) return;
  loading.value = true;
  error.value = null;
  try {
    const group = await groupsApi.acceptInvitation(lookup.value);
    groups.joined(group);
    await openGroup(group.id);
  } catch (e) {
    fail(e);
    preview.value = null;
  } finally {
    loading.value = false;
  }
}

async function later() {
  pendingInvite.clear();
  await router.replace('/');
}

onMounted(async () => {
  const fromLink = tokenFromHash(route.hash);
  if (fromLink) {
    pendingInvite.set(fromLink);
    // Le jeton ne reste pas dans l'historique du navigateur.
    await router.replace({ name: 'join' });
  }
  // Pour savoir d'avance si la limite d'un groupe est atteinte.
  if (auth.isAuthenticated && groups.status === 'idle') void groups.load();
  const token = fromLink ?? pendingInvite.get();
  if (token && auth.isAuthenticated) {
    checkingLink.value = true;
    await loadPreview({ token });
    checkingLink.value = false;
  }
});
</script>

<template>
  <AuthLayout :title="$t('groups.join.title')">
    <!-- Pas connecté : le lien est gardé de côté le temps de se connecter. -->
    <template v-if="!auth.isAuthenticated">
      <p class="mb-6">{{ $t('groups.join.needAccount') }}</p>
      <v-btn
        :to="{ name: 'register' }"
        color="primary"
        size="large"
        rounded="pill"
        block
        class="mb-3"
      >
        {{ $t('auth.login.register') }}
      </v-btn>
      <v-btn
        :to="{ name: 'login', query: { redirect: '/join' } }"
        variant="outlined"
        size="large"
        rounded="pill"
        block
      >
        {{ $t('auth.login.submit') }}
      </v-btn>
    </template>

    <template v-else-if="preview">
      <div class="text-center mb-6" data-test="invitation-preview">
        <p class="text-body-medium text-medium-emphasis mb-2">
          {{
            preview.invitedBy
              ? $t('groups.join.invitedBy', { name: preview.invitedBy })
              : $t('groups.join.invited')
          }}
        </p>
        <p class="font-display text-headline-medium mb-1">
          {{ preview.groupName }}
        </p>
        <p class="text-body-medium text-medium-emphasis">
          {{ $t('groups.memberCount', preview.memberCount) }}
        </p>
      </div>
      <template v-if="preview.alreadyMember">
        <v-alert
          type="info"
          variant="tonal"
          class="mb-4"
          :text="$t('groups.join.alreadyMember')"
        />
        <v-btn
          color="primary"
          size="large"
          rounded="pill"
          block
          @click="openGroup(preview.groupId)"
        >
          {{ $t('groups.join.open') }}
        </v-btn>
      </template>
      <!-- Un seul groupe pour l'instant : inutile de proposer de rejoindre. -->
      <template v-else-if="groups.atGroupLimit">
        <v-alert
          variant="tonal"
          class="mb-4"
          data-test="group-limit"
          :title="$t('groups.limit.title')"
          :text="$t('groups.limit.body')"
        />
        <p class="text-body-medium text-medium-emphasis mb-6">
          {{ $t('groups.limit.leaveHint') }}
        </p>
        <v-btn variant="text" rounded="pill" block @click="later">
          {{ $t('groups.join.back') }}
        </v-btn>
      </template>
      <template v-else>
        <v-btn
          color="primary"
          size="large"
          rounded="pill"
          block
          class="mb-3"
          :loading="loading"
          data-test="accept"
          @click="accept"
        >
          {{ $t('groups.join.accept') }}
        </v-btn>
        <v-btn variant="text" rounded="pill" block @click="later">
          {{ $t('groups.join.later') }}
        </v-btn>
      </template>
    </template>

    <template v-else>
      <v-alert
        v-if="error"
        type="error"
        variant="tonal"
        class="mb-4"
        :text="error"
      />
      <div v-if="checkingLink" class="text-center py-4">
        <v-progress-circular indeterminate color="primary" />
      </div>
      <v-form v-else validate-on="submit lazy" @submit.prevent="submitCode">
        <p class="mb-4">{{ $t('groups.join.codeBody') }}</p>
        <v-text-field
          v-model="code"
          :label="$t('groups.join.code')"
          :rules="[zodRule(invitationCodeSchema)]"
          placeholder="ABCD-EFGH"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          maxlength="12"
          variant="outlined"
          class="code-input mb-2"
        />
        <v-btn
          type="submit"
          color="primary"
          size="large"
          rounded="pill"
          block
          :loading="loading"
        >
          {{ $t('groups.join.submitCode') }}
        </v-btn>
      </v-form>
    </template>

    <template #footer>
      <router-link
        v-if="auth.isAuthenticated"
        to="/"
        class="text-body-medium"
        @click="pendingInvite.clear()"
      >
        {{ $t('groups.join.back') }}
      </router-link>
    </template>
  </AuthLayout>
</template>

<style scoped>
.code-input :deep(input) {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-variant-numeric: tabular-nums;
}
</style>
