<script setup lang="ts">
import { mdiEye, mdiEyeOff } from '@mdi/js';
import { ref } from 'vue';

defineProps<{
  label: string;
  autocomplete: 'current-password' | 'new-password';
  rules?: ((value: unknown) => true | string)[];
  hint?: string;
}>();
const model = defineModel<string>({ required: true });
const visible = ref(false);
</script>

<template>
  <v-text-field
    v-model="model"
    :label="label"
    :type="visible ? 'text' : 'password'"
    :autocomplete="autocomplete"
    :rules="rules"
    :hint="hint"
    :persistent-hint="!!hint"
    variant="outlined"
    autocapitalize="off"
    spellcheck="false"
  >
    <template #append-inner>
      <v-btn
        :icon="visible ? mdiEyeOff : mdiEye"
        :aria-label="
          visible ? $t('auth.hidePassword') : $t('auth.showPassword')
        "
        variant="text"
        density="comfortable"
        size="small"
        @click="visible = !visible"
      />
    </template>
  </v-text-field>
</template>
