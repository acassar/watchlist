import type { AddTitleRequest, GroupTitle } from '@watchlist/shared';
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { titlesApi } from './api';

/**
 * Titres du groupe affiché. Version minimale de l'étape 5 (une seule liste) :
 * les trois vues et le rechargement au retour sur l'app arrivent à l'étape 6.
 */
export const useTitlesStore = defineStore('titles', () => {
  const titles = ref<GroupTitle[]>([]);
  /** Groupe dont `titles` est la liste (null : rien de chargé). */
  const groupId = ref<string | null>(null);
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');

  async function load(id: string) {
    if (groupId.value !== id) {
      titles.value = [];
      groupId.value = id;
    }
    status.value = 'loading';
    try {
      const list = await titlesApi.list(id);
      // Le groupe a pu changer pendant la requête.
      if (groupId.value !== id) return;
      titles.value = list;
      status.value = 'ready';
    } catch (error) {
      if (groupId.value === id) status.value = 'error';
      throw error;
    }
  }

  async function add(id: string, body: AddTitleRequest): Promise<GroupTitle> {
    const title = await titlesApi.add(id, body);
    if (groupId.value === id) titles.value = [title, ...titles.value];
    return title;
  }

  function reset() {
    titles.value = [];
    groupId.value = null;
    status.value = 'idle';
  }

  return { titles, groupId, status, load, add, reset };
});
