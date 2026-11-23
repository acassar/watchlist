<script setup lang="ts">
import { mdiChevronRight, mdiClose } from '@mdi/js';
import type { GroupSummary } from '@watchlist/shared';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/features/auth/store';
import { lastAddGroupMemory, pendingShare } from '@/features/groups/storage';
import { useGroupsStore } from '@/features/groups/store';
import AddTitleForm from '@/features/titles/components/AddTitleForm.vue';

/**
 * Ajout plein écran, sans barre d'onglets :
 * - `/share` : lien reçu du menu « Partager » d'Android (mis de côté par le routeur) ;
 * - `/add` : raccourci de l'icône, et chemin iOS avec « Coller le lien ».
 * On demande toujours le groupe (le dernier utilisé en tête), sauf s'il n'y en a qu'un.
 */
const props = defineProps<{ shared?: boolean }>();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const groups = useGroupsStore();

const link = ref<string | null>(props.shared ? pendingShare.get() : null);
const emptyShare = computed(() => props.shared && !!route.query.empty);
const chosenId = ref<string | null>(null);
const addedTo = ref<string | null>(null);
/** Change à chaque nouvel ajout : le formulaire repart de zéro. */
const session = ref(0);

/** Le dernier groupe utilisé pour un ajout en tête, puis les autres (par nom). */
const ordered = computed<GroupSummary[]>(() => {
  const preferred =
    (auth.user && lastAddGroupMemory.get(auth.user.id)) ||
    groups.activeGroup?.id;
  const first = groups.groups.find((g) => g.id === preferred);
  return first
    ? [first, ...groups.groups.filter((g) => g.id !== first.id)]
    : groups.groups;
});
const single = computed(() => groups.groups.length === 1);
const chosen = computed<GroupSummary | null>(() => {
  if (single.value) return groups.groups[0];
  return groups.groups.find((g) => g.id === chosenId.value) ?? null;
});

onMounted(() => {
  // Partage déjà traité (retour arrière, rechargement) : rien à ajouter.
  if (props.shared && !link.value && !emptyShare.value) {
    router.replace('/');
    return;
  }
  if (auth.isAuthenticated) groups.load().catch(() => undefined);
});

// Le groupe choisi a disparu (quitté depuis un autre onglet…) : on redemande.
watch(
  () => groups.groups,
  () => {
    if (chosenId.value && !groups.groups.some((g) => g.id === chosenId.value))
      chosenId.value = null;
  },
);

function added(groupName: string) {
  pendingShare.clear();
  link.value = null;
  if (chosen.value) groups.select(chosen.value.id);
  addedTo.value = groupName;
}

function another() {
  addedTo.value = null;
  if (!single.value) chosenId.value = null;
  session.value++;
}

function close() {
  pendingShare.clear();
  router.replace('/');
}
</script>

<template>
  <v-container class="add-page pa-4" data-test="add-page">
    <div class="d-flex align-center mb-4">
      <span class="font-display text-title-large text-primary brand">{{
        $t('app.title')
      }}</span>
      <v-spacer />
      <v-btn
        variant="text"
        :icon="mdiClose"
        :aria-label="$t('common.close')"
        data-test="add-close"
        @click="close"
      />
    </div>

    <!-- Partage sans lien (une photo, un texte…). -->
    <div v-if="emptyShare" class="text-center py-6" data-test="share-empty">
      <h1 class="font-display text-headline-small mb-3">
        {{ $t('share.empty.title') }}
      </h1>
      <p class="text-body-medium text-medium-emphasis mb-6">
        {{ $t('share.empty.body') }}
      </p>
      <v-btn
        :to="{ name: 'add' }"
        replace
        color="primary"
        size="large"
        rounded="pill"
        block
      >
        {{ $t('share.empty.paste') }}
      </v-btn>
    </div>

    <!-- C'est fait. -->
    <div v-else-if="addedTo" class="text-center py-6" data-test="share-done">
      <h1 class="font-display text-headline-small mb-3">
        {{ $t('share.done.title', { name: addedTo }) }}
      </h1>
      <p class="text-body-medium text-medium-emphasis mb-6">
        {{ $t('share.done.body') }}
      </p>
      <v-btn
        :to="{ name: 'alone' }"
        replace
        color="primary"
        size="large"
        rounded="pill"
        block
        class="mb-3"
        data-test="share-open-list"
      >
        {{ $t('share.done.openList') }}
      </v-btn>
      <v-btn
        variant="outlined"
        size="large"
        rounded="pill"
        block
        data-test="share-another"
        @click="another"
      >
        {{ $t('share.done.another') }}
      </v-btn>
    </div>

    <div
      v-else-if="groups.status === 'loading' || groups.status === 'idle'"
      class="text-center py-8"
    >
      <v-progress-circular indeterminate color="primary" />
    </div>

    <v-alert
      v-else-if="groups.status === 'error'"
      type="error"
      variant="tonal"
      :text="$t('share.loadError')"
    >
      <template #append>
        <v-btn variant="text" @click="groups.load().catch(() => undefined)">
          {{ $t('common.retry') }}
        </v-btn>
      </template>
    </v-alert>

    <!-- Pas encore de groupe : il en faut un. Le lien attend pendant ce temps. -->
    <div
      v-else-if="groups.hasNoGroup"
      class="text-center py-6"
      data-test="share-no-group"
    >
      <h1 class="font-display text-headline-small mb-3">
        {{ $t('share.noGroup.title') }}
      </h1>
      <p class="text-body-medium text-medium-emphasis mb-6">
        {{ $t('share.noGroup.body') }}
      </p>
      <v-btn
        :to="{ name: 'group-new' }"
        color="primary"
        size="large"
        rounded="pill"
        block
        class="mb-3"
      >
        {{ $t('groups.empty.create') }}
      </v-btn>
      <v-btn
        :to="{ name: 'join' }"
        variant="outlined"
        size="large"
        rounded="pill"
        block
      >
        {{ $t('groups.empty.join') }}
      </v-btn>
    </div>

    <!-- « Ajouter à quel groupe ? » -->
    <template v-else-if="!chosen">
      <h1 class="font-display text-headline-small mb-1">
        {{ $t('share.chooseGroup') }}
      </h1>
      <p
        v-if="link"
        class="text-body-small text-medium-emphasis mb-4 shared-link"
        data-test="shared-link"
      >
        {{ link }}
      </p>
      <v-list bg-color="transparent" class="pa-0" data-test="group-choices">
        <v-list-item
          v-for="group in ordered"
          :key="group.id"
          :title="group.name"
          :subtitle="$t('groups.memberCount', group.memberCount)"
          :append-icon="mdiChevronRight"
          rounded="lg"
          class="mb-2 group-choice"
          data-test="group-choice"
          @click="chosenId = group.id"
        />
      </v-list>
    </template>

    <v-card v-else rounded="xl" elevation="0" color="surface" class="pb-2">
      <v-card-title class="font-display text-title-large text-wrap">
        {{ $t('titles.add.title') }}
      </v-card-title>
      <v-card-subtitle class="text-wrap d-flex align-center">
        <span data-test="add-group">{{
          $t('titles.add.inGroup', { name: chosen.name })
        }}</span>
        <v-btn
          v-if="!single"
          variant="text"
          size="small"
          class="ml-1 text-none"
          data-test="change-group"
          @click="chosenId = null"
        >
          {{ $t('share.changeGroup') }}
        </v-btn>
      </v-card-subtitle>
      <AddTitleForm
        :key="`${session}-${chosen.id}`"
        :group="chosen"
        :initial-link="link"
        @added="added"
        @cancel="close"
      />
    </v-card>
  </v-container>
</template>

<style scoped>
.add-page {
  max-width: 480px;
  min-height: 100dvh;
}
.brand {
  font-weight: 600;
}
.group-choice {
  background: rgb(var(--v-theme-surface));
}
.shared-link {
  overflow-wrap: anywhere;
}
</style>
