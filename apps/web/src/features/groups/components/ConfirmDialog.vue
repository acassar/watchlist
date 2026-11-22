<script setup lang="ts">
defineProps<{
  title: string;
  text: string;
  confirmLabel: string;
  loading?: boolean;
  error?: string | null;
}>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ confirm: [] }>();
</script>

<template>
  <!-- Fenêtre de confirmation de l'app (jamais window.confirm). -->
  <v-dialog v-model="open" max-width="420">
    <v-card rounded="xl" data-test="confirm-dialog">
      <v-card-title class="font-display text-title-large text-wrap">
        {{ title }}
      </v-card-title>
      <v-card-text>
        <p>{{ text }}</p>
        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          class="mt-4"
          :text="error"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">
          {{ $t('common.cancel') }}
        </v-btn>
        <v-btn
          color="error"
          variant="flat"
          :loading="loading"
          data-test="confirm"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
