<script setup lang="ts">
import {
  mdiAccount,
  mdiAccountCircleOutline,
  mdiAccountGroup,
  mdiHelpCircleOutline,
  mdiLogout,
} from '@mdi/js';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/features/auth/store';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const bare = computed(() => route.meta.layout === 'auth');

async function logout() {
  await auth.logout().catch(() => undefined);
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
        <v-app-bar-title class="font-display">{{
          $t('app.title')
        }}</v-app-bar-title>
        <template v-if="auth.user" #append>
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
