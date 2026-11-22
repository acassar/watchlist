<script setup lang="ts">
import { mdiAccount, mdiAccountGroup, mdiHelpCircleOutline } from '@mdi/js';
</script>

<template>
  <v-app>
    <v-app-bar density="comfortable" flat>
      <v-app-bar-title>{{ $t('app.title') }}</v-app-bar-title>
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
  </v-app>
</template>
