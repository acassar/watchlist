<script setup lang="ts">
import {
  mdiAccountMultiplePlus,
  mdiClose,
  mdiLogout,
  mdiPencilOutline,
} from '@mdi/js';
import {
  formatInvitationCode,
  GroupRole,
  groupNameSchema,
  type CreatedInvitation,
  type GroupDetail,
  type GroupMember,
  type Invitation,
} from '@watchlist/shared';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ApiRequestError } from '@/api/http';
import { useAuthStore } from '@/features/auth/store';
import { apiErrorMessage, zodRule } from '@/features/auth/validation';
import { groupsApi } from '../api';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import InviteDialog from '../components/InviteDialog.vue';
import PageHeader from '../components/PageHeader.vue';
import { useGroupsStore } from '../store';

const props = defineProps<{ groupId: string }>();
const auth = useAuthStore();
const groups = useGroupsStore();
const route = useRoute();
const router = useRouter();
const { t, d } = useI18n();

const group = ref<GroupDetail | null>(null);
const invitations = ref<Invitation[]>([]);
const state = ref<'loading' | 'ready' | 'not-found' | 'error'>('loading');
const actionError = ref<string | null>(null);

const isOwner = computed(() => group.value?.role === GroupRole.OWNER);
const me = computed(() => auth.user?.id);
const justCreated = computed(() => route.query.created === '1');

async function load() {
  state.value = 'loading';
  try {
    const [detail, list] = await Promise.all([
      groupsApi.detail(props.groupId),
      groupsApi.invitations(props.groupId),
    ]);
    group.value = detail;
    invitations.value = list;
    groups.upsert(detail);
    state.value = 'ready';
  } catch (e) {
    if (e instanceof ApiRequestError && e.status === 404) {
      // Plus membre (retiré, groupe supprimé) : on l'enlève de la liste.
      groups.remove(props.groupId);
      state.value = 'not-found';
    } else {
      state.value = 'error';
    }
  }
}
watch(() => props.groupId, load, { immediate: true });

/* Inviter */
const inviteOpen = ref(false);
const created = ref<CreatedInvitation | null>(null);
const inviting = ref(false);

async function invite() {
  inviting.value = true;
  actionError.value = null;
  try {
    created.value = await groupsApi.createInvitation(props.groupId);
    invitations.value = [created.value, ...invitations.value];
    inviteOpen.value = true;
  } catch (e) {
    actionError.value = apiErrorMessage(e);
  } finally {
    inviting.value = false;
  }
}

function canRevoke(invitation: Invitation) {
  return isOwner.value || invitation.createdBy?.userId === me.value;
}

async function revoke(invitation: Invitation) {
  actionError.value = null;
  try {
    await groupsApi.revokeInvitation(props.groupId, invitation.id);
    invitations.value = invitations.value.filter((i) => i.id !== invitation.id);
  } catch (e) {
    actionError.value = apiErrorMessage(e);
  }
}

function invitationLine(invitation: Invitation) {
  const parts = [
    t('groups.invitations.expires', {
      date: d(new Date(invitation.expiresAt), 'short'),
    }),
  ];
  if (invitation.uses > 0) {
    parts.push(t('groups.invitations.uses', invitation.uses));
  }
  if (invitation.createdBy && invitation.createdBy.userId !== me.value) {
    parts.push(
      t('groups.invitations.by', { name: invitation.createdBy.displayName }),
    );
  }
  return parts.join(' · ');
}

/* Renommer (propriétaire) */
const renameOpen = ref(false);
const newName = ref('');
const renaming = ref(false);
const renameError = ref<string | null>(null);

function openRename() {
  newName.value = group.value?.name ?? '';
  renameError.value = null;
  renameOpen.value = true;
}

async function rename(event: Promise<{ valid: boolean }>) {
  if (!(await event).valid) return;
  renaming.value = true;
  renameError.value = null;
  try {
    group.value = await groupsApi.rename(
      props.groupId,
      groupNameSchema.parse(newName.value),
    );
    groups.upsert(group.value);
    renameOpen.value = false;
  } catch (e) {
    renameError.value = apiErrorMessage(e);
  } finally {
    renaming.value = false;
  }
}

/* Retirer un membre (propriétaire) */
const removing = ref<GroupMember | null>(null);
const removeOpen = ref(false);
const removeBusy = ref(false);
const removeError = ref<string | null>(null);

function askRemove(member: GroupMember) {
  removing.value = member;
  removeError.value = null;
  removeOpen.value = true;
}

async function confirmRemove() {
  if (!removing.value) return;
  removeBusy.value = true;
  try {
    await groupsApi.removeMember(props.groupId, removing.value.userId);
    removeOpen.value = false;
    await load();
  } catch (e) {
    removeError.value = apiErrorMessage(e);
  } finally {
    removeBusy.value = false;
  }
}

/* Quitter */
const leaveOpen = ref(false);
const leaveBusy = ref(false);
const leaveError = ref<string | null>(null);

/** Ce que le départ va changer, dit avant de confirmer. */
const leaveText = computed(() => {
  const g = group.value;
  if (!g) return '';
  if (g.memberCount === 1) return t('groups.leave.lastMember');
  const heir = g.members.find((m) => m.userId !== me.value);
  if (isOwner.value && heir) {
    return t('groups.leave.owner', { name: heir.displayName });
  }
  return t('groups.leave.member');
});

function askLeave() {
  leaveError.value = null;
  leaveOpen.value = true;
}

async function confirmLeave() {
  leaveBusy.value = true;
  try {
    await groups.leave(props.groupId);
    leaveOpen.value = false;
    await router.replace('/');
  } catch (e) {
    leaveError.value = apiErrorMessage(e);
  } finally {
    leaveBusy.value = false;
  }
}

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?';
}
</script>

<template>
  <v-container class="page pa-4">
    <div v-if="state === 'loading'" class="text-center py-12">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <template v-else-if="state === 'not-found' || state === 'error'">
      <PageHeader :title="$t('groups.settings.title')" />
      <v-alert
        type="warning"
        variant="tonal"
        :text="
          state === 'not-found'
            ? $t('groups.settings.notFound')
            : $t('errors.UNKNOWN')
        "
      />
      <v-btn class="mt-4" variant="text" to="/">{{
        $t('groups.join.back')
      }}</v-btn>
    </template>

    <template v-else-if="group">
      <PageHeader :title="group.name">
        <template v-if="isOwner" #actions>
          <v-btn
            :icon="mdiPencilOutline"
            variant="text"
            :aria-label="$t('groups.rename.title')"
            data-test="rename"
            @click="openRename"
          />
        </template>
      </PageHeader>

      <v-alert
        v-if="justCreated"
        type="success"
        variant="tonal"
        class="mb-4"
        :text="$t('groups.settings.created')"
      />
      <v-alert
        v-if="actionError"
        type="error"
        variant="tonal"
        class="mb-4"
        closable
        :text="actionError"
        @click:close="actionError = null"
      />

      <!-- Membres -->
      <section class="mb-8" :aria-label="$t('groups.settings.members')">
        <h2 class="text-title-medium mb-2">
          {{ $t('groups.settings.members') }}
          <span class="text-medium-emphasis">({{ group.memberCount }})</span>
        </h2>
        <v-list bg-color="transparent" class="pa-0">
          <v-list-item
            v-for="member in group.members"
            :key="member.userId"
            class="px-0"
            data-test="member"
          >
            <template #prepend>
              <v-avatar color="surface-variant" size="40">
                <span class="text-title-medium">{{
                  initial(member.displayName)
                }}</span>
              </v-avatar>
            </template>
            <v-list-item-title>
              {{ member.displayName }}
              <span v-if="member.userId === me" class="text-medium-emphasis">
                {{ $t('groups.settings.you') }}
              </span>
            </v-list-item-title>
            <v-list-item-subtitle v-if="member.role === GroupRole.OWNER">
              {{ $t('groups.roles.OWNER') }}
            </v-list-item-subtitle>
            <template v-if="isOwner && member.userId !== me" #append>
              <v-btn
                :icon="mdiClose"
                variant="text"
                :aria-label="
                  $t('groups.remove.label', { name: member.displayName })
                "
                @click="askRemove(member)"
              />
            </template>
          </v-list-item>
        </v-list>
      </section>

      <!-- Invitations -->
      <section class="mb-8" :aria-label="$t('groups.invitations.title')">
        <h2 class="text-title-medium mb-1">
          {{ $t('groups.invitations.title') }}
        </h2>
        <p class="text-body-medium text-medium-emphasis mb-4">
          {{ $t('groups.invitations.body') }}
        </p>
        <v-btn
          color="primary"
          size="large"
          rounded="pill"
          block
          :prepend-icon="mdiAccountMultiplePlus"
          :loading="inviting"
          data-test="invite"
          @click="invite"
        >
          {{ $t('groups.invitations.create') }}
        </v-btn>

        <v-list
          v-if="invitations.length"
          bg-color="transparent"
          class="pa-0 mt-4"
        >
          <v-list-item
            v-for="invitation in invitations"
            :key="invitation.id"
            class="px-0"
            data-test="invitation"
          >
            <v-list-item-title class="invite-code">
              {{ formatInvitationCode(invitation.code) }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{ invitationLine(invitation) }}
            </v-list-item-subtitle>
            <template v-if="canRevoke(invitation)" #append>
              <v-btn
                variant="text"
                class="text-none touch-target"
                @click="revoke(invitation)"
              >
                {{ $t('groups.invitations.revoke') }}
              </v-btn>
            </template>
          </v-list-item>
        </v-list>
      </section>

      <v-btn
        variant="text"
        color="error"
        rounded="pill"
        block
        :prepend-icon="mdiLogout"
        data-test="leave"
        @click="askLeave"
      >
        {{ $t('groups.leave.action') }}
      </v-btn>

      <InviteDialog
        v-model="inviteOpen"
        :invitation="created"
        :group-name="group.name"
      />

      <v-dialog v-model="renameOpen" max-width="420">
        <v-card rounded="xl">
          <v-form validate-on="submit lazy" @submit.prevent="rename">
            <v-card-title class="font-display text-title-large">
              {{ $t('groups.rename.title') }}
            </v-card-title>
            <v-card-text>
              <v-text-field
                v-model="newName"
                :label="$t('groups.name')"
                :rules="[zodRule(groupNameSchema)]"
                :counter="50"
                maxlength="50"
                variant="outlined"
                autofocus
              />
              <v-alert
                v-if="renameError"
                type="error"
                variant="tonal"
                :text="renameError"
              />
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="renameOpen = false">
                {{ $t('common.cancel') }}
              </v-btn>
              <v-btn
                type="submit"
                color="primary"
                variant="flat"
                :loading="renaming"
              >
                {{ $t('common.save') }}
              </v-btn>
            </v-card-actions>
          </v-form>
        </v-card>
      </v-dialog>

      <ConfirmDialog
        v-model="removeOpen"
        :title="
          $t('groups.remove.title', { name: removing?.displayName ?? '' })
        "
        :text="$t('groups.remove.text')"
        :confirm-label="$t('groups.remove.confirm')"
        :loading="removeBusy"
        :error="removeError"
        @confirm="confirmRemove"
      />

      <ConfirmDialog
        v-model="leaveOpen"
        :title="$t('groups.leave.title', { name: group.name })"
        :text="leaveText"
        :confirm-label="$t('groups.leave.confirm')"
        :loading="leaveBusy"
        :error="leaveError"
        @confirm="confirmLeave"
      />
    </template>
  </v-container>
</template>

<style scoped>
.page {
  max-width: 560px;
}
/* Cible tactile d'au moins 48 px de haut sur mobile. */
.touch-target {
  min-height: 48px;
}
.invite-code {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.08em;
  font-weight: 600;
}
</style>
