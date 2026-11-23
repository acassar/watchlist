<script setup lang="ts">
import { computed } from 'vue';
import { isTodo, TODO } from '../publisher';

/** Valeur de publisher.ts : un champ pas encore rempli saute aux yeux. */
const props = defineProps<{ value: string }>();
const todo = computed(() => isTodo(props.value));
const text = computed(() =>
  todo.value
    ? `[À COMPLÉTER : ${props.value.slice(TODO.length).trim()}]`
    : props.value,
);
</script>

<template>
  <mark v-if="todo" class="legal-todo" data-test="legal-todo">{{ text }}</mark>
  <span v-else>{{ text }}</span>
</template>

<style scoped>
.legal-todo {
  background: rgb(var(--v-theme-warning));
  color: rgb(var(--v-theme-on-warning));
  padding: 0 4px;
  border-radius: 4px;
}
</style>
