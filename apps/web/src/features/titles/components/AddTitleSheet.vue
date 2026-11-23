<script setup lang="ts">
import { ref, watch } from 'vue';
import { useGroupsStore } from '@/features/groups/store';
import AddTitleForm from './AddTitleForm.vue';

/** Bouton « + » des listes : ajout dans le groupe affiché. */
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ added: [groupName: string] }>();
const groups = useGroupsStore();
/** Change à chaque ouverture : le formulaire repart de zéro. */
const session = ref(0);

watch(open, (isOpen) => {
  if (isOpen) session.value++;
});

function added(name: string) {
  emit('added', name);
  open.value = false;
}
</script>

<template>
  <v-bottom-sheet v-model="open">
    <v-card rounded="t-xl" class="pb-4" data-test="add-sheet">
      <div class="sheet-handle mx-auto mt-3 mb-1" aria-hidden="true" />
      <v-card-title class="font-display text-headline-small text-wrap">
        {{ $t('titles.add.title') }}
      </v-card-title>
      <template v-if="groups.activeGroup">
        <v-card-subtitle class="text-wrap">
          {{ $t('titles.add.inGroup', { name: groups.activeGroup.name }) }}
        </v-card-subtitle>
        <AddTitleForm
          :key="session"
          :group="groups.activeGroup"
          @added="added"
          @cancel="open = false"
        />
      </template>
    </v-card>
  </v-bottom-sheet>
</template>
