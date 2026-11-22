<script setup lang="ts">
import type { GroupTitle } from '@watchlist/shared';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/features/auth/store';
import StatusDot from './StatusDot.vue';

defineProps<{ title: GroupTitle }>();
const emit = defineEmits<{ edit: [] }>();
const { t } = useI18n();
const auth = useAuthStore();

function label(name: string, status: string, counted: boolean) {
  const base = t('titles.memberStatus', {
    name,
    status: t(`titles.statusLabel.${status}`),
  });
  return counted ? base : `${base} ${t('titles.notCounted')}`;
}
</script>

<template>
  <!-- Avatars des membres avec leur pastille ; la mienne se touche pour changer d'avis. -->
  <div class="members d-flex align-center ga-1" data-test="members">
    <template v-for="member in title.members" :key="member.userId">
      <button
        v-if="member.userId === auth.user?.id"
        type="button"
        class="member mine"
        :aria-label="
          t('titles.changeMine', {
            status: t(`titles.statusLabel.${member.status}`),
          })
        "
        data-test="my-status"
        @click.stop.prevent="emit('edit')"
      >
        <v-avatar size="26" color="surface-variant" class="text-label-small">
          {{ member.displayName.charAt(0).toUpperCase() }}
        </v-avatar>
        <StatusDot :status="member.status" :size="16" class="dot" />
      </button>
      <span
        v-else
        class="member"
        :class="{ 'not-counted': !member.counted }"
        role="img"
        :aria-label="label(member.displayName, member.status, member.counted)"
        :title="label(member.displayName, member.status, member.counted)"
      >
        <v-avatar size="26" color="surface-variant" class="text-label-small">
          {{ member.displayName.charAt(0).toUpperCase() }}
        </v-avatar>
        <StatusDot :status="member.status" :size="16" class="dot" />
      </span>
    </template>
  </div>
</template>

<style scoped>
.member {
  position: relative;
  display: inline-flex;
  padding: 2px;
  border: 0;
  background: none;
  color: inherit;
  border-radius: 50%;
}
.mine {
  cursor: pointer;
  outline: 2px solid rgba(var(--v-theme-primary), 0.5);
  outline-offset: -1px;
}
.mine:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
}
.dot {
  position: absolute;
  right: -3px;
  bottom: -3px;
}
.not-counted {
  opacity: 0.5;
}
</style>
