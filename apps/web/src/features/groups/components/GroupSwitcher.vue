<script setup lang="ts">
import { mdiCheck, mdiChevronDown, mdiCogOutline } from '@mdi/js';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useGroupsStore } from '../store';

const groups = useGroupsStore();
const router = useRouter();
const open = ref(false);

function pick(groupId: string) {
  groups.select(groupId);
  open.value = false;
}

async function go(to: Parameters<typeof router.push>[0]) {
  open.value = false;
  await router.push(to);
}
</script>

<template>
  <!-- Nom du groupe actif dans l'en-tête : un appui ouvre « Vos groupes ». -->
  <v-bottom-sheet v-if="groups.activeGroup" v-model="open">
    <template #activator="{ props }">
      <v-btn
        v-bind="props"
        variant="outlined"
        rounded="pill"
        class="group-pill text-none"
        :append-icon="mdiChevronDown"
        :aria-label="
          $t('groups.switcher.label', { name: groups.activeGroup.name })
        "
        data-test="group-switcher"
      >
        <span class="text-truncate">{{ groups.activeGroup.name }}</span>
      </v-btn>
    </template>

    <v-card rounded="t-xl" class="pb-4" data-test="group-sheet">
      <div class="sheet-handle mx-auto mt-3 mb-1" aria-hidden="true" />
      <v-card-title class="font-display text-headline-small">
        {{ $t('groups.switcher.title') }}
      </v-card-title>

      <v-card-text class="d-flex flex-column ga-2">
        <div
          v-for="group in groups.groups"
          :key="group.id"
          class="group-row d-flex align-center rounded-lg"
          :class="{ active: group.id === groups.activeGroup.id }"
        >
          <button
            type="button"
            class="group-pick flex-grow-1 d-flex align-center ga-3 text-left"
            :aria-current="group.id === groups.activeGroup.id"
            @click="pick(group.id)"
          >
            <span class="d-flex flex-column flex-grow-1 overflow-hidden">
              <span class="text-title-medium text-truncate">{{
                group.name
              }}</span>
              <span class="text-body-small text-medium-emphasis">
                {{ $t('groups.memberCount', group.memberCount) }}
              </span>
            </span>
            <v-icon
              v-if="group.id === groups.activeGroup.id"
              :icon="mdiCheck"
              color="primary"
            />
          </button>
          <v-btn
            :icon="mdiCogOutline"
            variant="text"
            class="mr-1"
            :aria-label="$t('groups.switcher.manage', { name: group.name })"
            @click="go({ name: 'group', params: { groupId: group.id } })"
          />
        </div>

        <div class="d-flex ga-2 mt-2">
          <v-btn
            class="flex-1-1 text-none"
            variant="outlined"
            rounded="lg"
            size="large"
            @click="go({ name: 'group-new' })"
          >
            {{ $t('groups.switcher.create') }}
          </v-btn>
          <v-btn
            class="flex-1-1 text-none"
            variant="outlined"
            rounded="lg"
            size="large"
            @click="go({ name: 'join' })"
          >
            {{ $t('groups.switcher.join') }}
          </v-btn>
        </div>
      </v-card-text>
    </v-card>
  </v-bottom-sheet>
</template>

<style scoped>
.group-pill {
  max-width: 55vw;
  min-height: 44px;
  border-color: rgba(var(--v-theme-on-surface), 0.16);
  background: rgb(var(--v-theme-surface));
}
<<<<<<< HEAD
=======
.sheet-handle {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: rgba(var(--v-theme-on-surface), 0.24);
}
>>>>>>> origin/main
.group-row {
  min-height: 56px;
  background: rgb(var(--v-theme-surface-variant));
  border: 1px solid transparent;
}
.group-row.active {
  border-color: rgb(var(--v-theme-primary));
}
.group-pick {
  min-height: 56px;
  padding: 0 14px;
  color: inherit;
  background: none;
  border: none;
  font: inherit;
  cursor: pointer;
  overflow: hidden;
}
</style>
