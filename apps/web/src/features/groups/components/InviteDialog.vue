<script setup lang="ts">
import { mdiCheck, mdiContentCopy, mdiShareVariant } from '@mdi/js';
import {
  formatInvitationCode,
  type CreatedInvitation,
} from '@watchlist/shared';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  invitation: CreatedInvitation | null;
  groupName: string;
}>();
const open = defineModel<boolean>({ required: true });
const { t, d } = useI18n();

const copied = ref<'link' | 'code' | null>(null);
watch(open, () => (copied.value = null));

const canShare = typeof navigator !== 'undefined' && !!navigator.share;
const code = computed(() =>
  props.invitation ? formatInvitationCode(props.invitation.code) : '',
);

async function copy(what: 'link' | 'code') {
  if (!props.invitation) return;
  const text = what === 'link' ? props.invitation.url : code.value;
  try {
    await navigator.clipboard.writeText(text);
    copied.value = what;
  } catch {
    // Presse-papiers refusé : le texte reste affiché, à copier à la main.
  }
}

async function share() {
  if (!props.invitation) return;
  try {
    await navigator.share({
      title: t('groups.invite.shareTitle'),
      text: t('groups.invite.shareText', { name: props.groupName }),
      url: props.invitation.url,
    });
  } catch {
    // Partage annulé : rien à faire.
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card v-if="invitation" rounded="xl" data-test="invite-dialog">
      <v-card-title class="font-display text-title-large text-wrap">
        {{ $t('groups.invite.title') }}
      </v-card-title>
      <v-card-text>
        <p class="mb-4">
          {{
            $t('groups.invite.body', {
              date: d(new Date(invitation.expiresAt), 'short'),
            })
          }}
        </p>

        <v-text-field
          :model-value="invitation.url"
          :label="$t('groups.invite.link')"
          variant="outlined"
          readonly
          hide-details
          class="mb-3"
          data-test="invite-link"
        />
        <div class="d-flex ga-2 mb-6">
          <v-btn
            v-if="canShare"
            color="primary"
            rounded="pill"
            class="flex-1-1"
            :prepend-icon="mdiShareVariant"
            @click="share"
          >
            {{ $t('groups.invite.share') }}
          </v-btn>
          <v-btn
            :color="canShare ? undefined : 'primary'"
            :variant="canShare ? 'outlined' : 'flat'"
            rounded="pill"
            class="flex-1-1"
            :prepend-icon="copied === 'link' ? mdiCheck : mdiContentCopy"
            @click="copy('link')"
          >
            {{
              copied === 'link'
                ? $t('groups.invite.copied')
                : $t('groups.invite.copyLink')
            }}
          </v-btn>
        </div>

        <p class="text-body-medium text-medium-emphasis mb-2">
          {{ $t('groups.invite.orCode') }}
        </p>
        <div class="d-flex align-center ga-2">
          <span class="invite-code font-display" data-test="invite-code">{{
            code
          }}</span>
          <v-btn
            :icon="copied === 'code' ? mdiCheck : mdiContentCopy"
            variant="text"
            :aria-label="$t('groups.invite.copyCode')"
            @click="copy('code')"
          />
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">
          {{ $t('common.close') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.invite-code {
  font-size: 28px;
  letter-spacing: 0.08em;
  color: rgb(var(--v-theme-primary));
  font-variant-numeric: tabular-nums;
}
</style>
