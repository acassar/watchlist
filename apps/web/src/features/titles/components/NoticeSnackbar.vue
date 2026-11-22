<script setup lang="ts">
import { computed } from 'vue';
import type { Notice } from '../useTitleActions';

const notice = defineModel<Notice | null>({ required: true });
const open = computed({
  get: () => notice.value !== null,
  set: (value: boolean) => {
    if (!value) notice.value = null;
  },
});

function undo() {
  const action = notice.value?.undo;
  notice.value = null;
  action?.();
}
</script>

<template>
  <!-- Au-dessus de la barre d'onglets et du « + ». -->
  <v-snackbar
    v-model="open"
    :timeout="5000"
    :color="notice?.error ? 'error' : undefined"
    location="bottom"
    class="notice"
    data-test="notice"
  >
    {{ notice?.text }}
    <template v-if="notice?.undo" #actions>
      <v-btn variant="text" color="primary" data-test="undo" @click="undo">
        {{ $t('common.undo') }}
      </v-btn>
    </template>
  </v-snackbar>
</template>

<style scoped>
.notice {
  margin-bottom: calc(56px + 72px + env(safe-area-inset-bottom));
}
</style>
