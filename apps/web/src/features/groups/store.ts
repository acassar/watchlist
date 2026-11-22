import type { GroupDetail, GroupSummary } from '@watchlist/shared';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useAuthStore } from '@/features/auth/store';
import { groupsApi } from './api';
import { activeGroupMemory } from './storage';

function toSummary(group: GroupDetail | GroupSummary): GroupSummary {
  const { id, name, role, memberCount } = group;
  return { id, name, role, memberCount };
}

/**
 * Mes groupes et le groupe actif. Un seul groupe affiché à la fois ; le
 * dernier ouvert est retenu sur l'appareil.
 */
export const useGroupsStore = defineStore('groups', () => {
  const auth = useAuthStore();
  const groups = ref<GroupSummary[]>([]);
  /** `idle` tant que la liste n'a jamais été chargée. */
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const activeGroupId = ref<string | null>(null);
  let loadPromise: Promise<void> | null = null;

  const activeGroup = computed(
    () =>
      groups.value.find((g) => g.id === activeGroupId.value) ??
      groups.value[0] ??
      null,
  );
  const hasNoGroup = computed(
    () => status.value === 'ready' && groups.value.length === 0,
  );

  function sortAndSet(list: GroupSummary[]) {
    groups.value = [...list].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }

  /** Charge (ou recharge) mes groupes. Les appels simultanés partagent la même requête. */
  function load(): Promise<void> {
    loadPromise ??= (async () => {
      if (status.value !== 'ready') status.value = 'loading';
      try {
        sortAndSet(await groupsApi.list());
        status.value = 'ready';
        const remembered = auth.user
          ? activeGroupMemory.get(auth.user.id)
          : null;
        if (!activeGroupId.value && remembered)
          activeGroupId.value = remembered;
      } catch (error) {
        if (status.value !== 'ready') status.value = 'error';
        throw error;
      }
    })().finally(() => {
      loadPromise = null;
    });
    return loadPromise;
  }

  function select(groupId: string) {
    activeGroupId.value = groupId;
    if (auth.user) activeGroupMemory.set(auth.user.id, groupId);
  }

  /** Ajoute ou met à jour un groupe dans la liste. */
  function upsert(group: GroupDetail | GroupSummary) {
    const summary = toSummary(group);
    sortAndSet([...groups.value.filter((g) => g.id !== summary.id), summary]);
  }

  async function create(name: string): Promise<GroupDetail> {
    const group = await groupsApi.create(name);
    upsert(group);
    select(group.id);
    status.value = 'ready';
    return group;
  }

  /** Après avoir rejoint (ou constaté qu'on était déjà membre). */
  function joined(group: GroupSummary) {
    upsert(group);
    select(group.id);
    status.value = 'ready';
  }

  async function leave(groupId: string) {
    await groupsApi.leave(groupId);
    remove(groupId);
  }

  /** Retire un groupe de la liste (quitté, ou devenu introuvable). */
  function remove(groupId: string) {
    groups.value = groups.value.filter((g) => g.id !== groupId);
    if (activeGroupId.value === groupId) {
      activeGroupId.value = null;
      if (auth.user) activeGroupMemory.set(auth.user.id, null);
    }
  }

  /** À la déconnexion : rien ne doit rester pour le compte suivant. */
  function reset() {
    groups.value = [];
    status.value = 'idle';
    activeGroupId.value = null;
  }

  return {
    groups,
    status,
    activeGroupId,
    activeGroup,
    hasNoGroup,
    load,
    select,
    upsert,
    create,
    joined,
    leave,
    remove,
    reset,
  };
});
