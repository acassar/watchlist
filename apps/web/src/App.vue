<script setup lang="ts">
import {
  mdiAccount,
  mdiAccountCircleOutline,
  mdiAccountGroup,
  mdiHelpCircleOutline,
  mdiLogout,
<<<<<<< HEAD
  mdiPlus,
} from '@mdi/js';
import { computed, ref, watch } from 'vue';
=======
} from '@mdi/js';
import { computed, watch } from 'vue';
>>>>>>> origin/main
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/features/auth/store';
import GroupSwitcher from '@/features/groups/components/GroupSwitcher.vue';
import { pendingInvite } from '@/features/groups/storage';
import { useGroupsStore } from '@/features/groups/store';
<<<<<<< HEAD
import AddTitleSheet from '@/features/titles/components/AddTitleSheet.vue';
import { useTitlesStore } from '@/features/titles/store';
=======
>>>>>>> origin/main

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const groups = useGroupsStore();
<<<<<<< HEAD
const titles = useTitlesStore();
const bare = computed(() => route.meta.layout === 'auth');
const adding = ref(false);
const addedTo = ref<string | null>(null);
const addedSnackbar = computed({
  get: () => addedTo.value !== null,
  set: (open: boolean) => {
    if (!open) addedTo.value = null;
  },
});
// Le « + » n'a de sens que sur les listes, une fois un groupe choisi.
const canAdd = computed(
  () =>
    !!groups.activeGroup &&
    ['alone', 'together', 'pending'].includes(String(route.name)),
);
=======
const bare = computed(() => route.meta.layout === 'auth');
>>>>>>> origin/main

// Mes groupes se chargent dès qu'on est connecté, et repartent de zéro au changement de compte.
watch(
  () => auth.user?.id,
  (userId) => {
    groups.reset();
<<<<<<< HEAD
    titles.reset();
=======
>>>>>>> origin/main
    if (userId) groups.load().catch(() => undefined);
  },
  { immediate: true },
);

async function logout() {
  await auth.logout().catch(() => undefined);
  // Appareil partagé : une invitation laissée de côté ne doit pas suivre le compte suivant.
  pendingInvite.clear();
  await router.replace({ name: 'login' });
}
</script>

<template>
  <v-app>
    <v-main v-if="bare">
      <router-view />
    </v-main>

    <template v-else>
      <v-app-bar density="comfortable" flat>
        <v-app-bar-title class="font-display text-primary brand">{{
          $t('app.title')
        }}</v-app-bar-title>
        <template v-if="auth.user" #append>
          <GroupSwitcher />
          <v-menu>
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                :icon="mdiAccountCircleOutline"
                :aria-label="$t('account.menu')"
              />
            </template>
            <v-list density="compact">
              <v-list-item
                :title="auth.user.displayName"
                :subtitle="auth.user.email"
              />
              <v-divider />
              <v-list-item
                :prepend-icon="mdiLogout"
                :title="$t('account.logout')"
                @click="logout"
              />
            </v-list>
          </v-menu>
        </template>
      </v-app-bar>

      <v-main>
        <router-view />
      </v-main>

<<<<<<< HEAD
      <template v-if="canAdd">
        <v-btn
          class="add-fab"
          color="primary"
          size="large"
          :icon="mdiPlus"
          :aria-label="$t('titles.addButton')"
          data-test="add-fab"
          @click="adding = true"
        />
        <AddTitleSheet v-model="adding" @added="(name) => (addedTo = name)" />
      </template>
      <v-snackbar
        v-model="addedSnackbar"
        :timeout="3000"
        location="top"
        data-test="added"
      >
        {{ $t('titles.added', { name: addedTo ?? '' }) }}
      </v-snackbar>

=======
>>>>>>> origin/main
      <!-- Mobile d'abord : les trois vues principales en barre du bas. -->
      <v-bottom-navigation grow>
        <v-btn to="/alone" :prepend-icon="mdiAccount">{{
          $t('nav.alone')
        }}</v-btn>
        <v-btn to="/together" :prepend-icon="mdiAccountGroup">{{
          $t('nav.together')
        }}</v-btn>
        <v-btn to="/pending" :prepend-icon="mdiHelpCircleOutline">{{
          $t('nav.pending')
        }}</v-btn>
      </v-bottom-navigation>
    </template>
  </v-app>
</template>

<style scoped>
.brand {
  font-weight: 600;
}
<<<<<<< HEAD
/* Au-dessus de la barre d'onglets (56 px), à portée de pouce. */
.add-fab {
  position: fixed;
  right: 16px;
  bottom: calc(56px + 16px + env(safe-area-inset-bottom));
  z-index: 1005;
}
=======
>>>>>>> origin/main
</style>
