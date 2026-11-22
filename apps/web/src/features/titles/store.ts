import {
  ACTIVE_VIEWS,
  TitleView,
  titleViewFor,
  type AddTitleRequest,
  type GroupTitle,
  type WatchStatus,
} from '@watchlist/shared';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useAuthStore } from '@/features/auth/store';
import { titlesApi } from './api';

/** Changement local appliqué avant la réponse de l'API (mise à jour optimiste). */
type Patch = {
  status?: WatchStatus;
  watchedAloneAt?: string | null;
  watchedTogetherAt?: string | null;
};

/**
 * Titres du groupe affiché, rangés par vue. Sans temps réel (décision D8) :
 * la liste se recharge au retour sur l'app et après chaque action.
 */
export const useTitlesStore = defineStore('titles', () => {
  const auth = useAuthStore();
  /** Mes listes actives (toutes vues confondues). */
  const titles = ref<GroupTitle[]>([]);
  /** Historique (vus, écartés), chargé à la demande. */
  const history = ref<GroupTitle[]>([]);
  /** Groupe dont `titles` est la liste (null : rien de chargé). */
  const groupId = ref<string | null>(null);
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const historyStatus = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const byView = computed(() => {
    const lists: Record<TitleView, GroupTitle[]> = {
      ALONE: [],
      TOGETHER: [],
      WAITING: [],
      PENDING: [],
      HIDDEN: [],
      ARCHIVED: [],
    };
    for (const title of titles.value) lists[title.view].push(title);
    return lists;
  });
  /** Pastille de l'onglet « Mon avis ». */
  const pendingCount = computed(() => byView.value.PENDING.length);

  function switchTo(id: string) {
    if (groupId.value === id) return;
    titles.value = [];
    history.value = [];
    groupId.value = id;
    status.value = 'idle';
    historyStatus.value = 'idle';
  }

  async function load(id: string) {
    switchTo(id);
    // Rechargement discret : la liste déjà affichée reste en place.
    if (status.value !== 'ready') status.value = 'loading';
    try {
      const list = await titlesApi.list(id);
      // Le groupe a pu changer pendant la requête.
      if (groupId.value !== id) return;
      titles.value = list;
      status.value = 'ready';
    } catch (error) {
      if (groupId.value === id && status.value !== 'ready') {
        status.value = 'error';
      }
      throw error;
    }
  }

  async function loadHistory(id: string) {
    switchTo(id);
    if (historyStatus.value !== 'ready') historyStatus.value = 'loading';
    try {
      const list = await titlesApi.history(id);
      if (groupId.value !== id) return;
      history.value = list;
      historyStatus.value = 'ready';
    } catch (error) {
      if (groupId.value === id && historyStatus.value !== 'ready') {
        historyStatus.value = 'error';
      }
      throw error;
    }
  }

  /** Recharge ce qui est affiché (retour au premier plan, après une action). */
  function refresh() {
    const id = groupId.value;
    if (!id) return;
    load(id).catch(() => undefined);
    if (historyStatus.value !== 'idle') loadHistory(id).catch(() => undefined);
  }

  async function add(id: string, body: AddTitleRequest): Promise<GroupTitle> {
    const title = await titlesApi.add(id, body);
    if (groupId.value === id) {
      titles.value = [title, ...titles.value.filter((t) => t.id !== title.id)];
      refresh();
    }
    return title;
  }

  /** Applique un changement à un titre, et recalcule sa vue comme l'API. */
  function patched(title: GroupTitle, patch: Patch): GroupTitle {
    const me = auth.user?.id ?? '';
    const members = title.members.map((m) =>
      m.userId === me
        ? {
            ...m,
            status: patch.status ?? m.status,
            watchedAloneAt:
              patch.watchedAloneAt !== undefined
                ? patch.watchedAloneAt
                : m.watchedAloneAt,
            // Un avis donné engage, même arrivé après l'ajout du titre.
            counted: m.counted || patch.status !== undefined,
          }
        : m,
    );
    const watchedTogetherAt =
      patch.watchedTogetherAt !== undefined
        ? patch.watchedTogetherAt
        : title.watchedTogetherAt;
    const mine = members.find((m) => m.userId === me);
    return {
      ...title,
      members,
      watchedTogetherAt,
      myStatus: mine?.status ?? title.myStatus,
      myWatchedAloneAt: mine?.watchedAloneAt ?? null,
      view: titleViewFor({ watchedTogetherAt, members }, me),
    };
  }

  /** Remplace (ou retire) un titre dans les listes affichées. */
  function put(title: GroupTitle) {
    const active = ACTIVE_VIEWS.includes(title.view);
    const index = titles.value.findIndex((t) => t.id === title.id);
    if (active && index >= 0) titles.value.splice(index, 1, title);
    else if (index >= 0) titles.value.splice(index, 1);
    else if (active) titles.value = [title, ...titles.value];

    const h = history.value.findIndex((t) => t.id === title.id);
    if (!active && h >= 0) history.value.splice(h, 1, title);
    else if (h >= 0) history.value.splice(h, 1);
    else if (!active && historyStatus.value !== 'idle') {
      history.value = [title, ...history.value];
    }
  }

  /**
   * Action sur un titre : effet immédiat à l'écran, appel à l'API, puis
   * rechargement (un autre membre a pu agir entre-temps). En cas d'échec, le
   * rechargement remet l'écran d'accord avec le serveur.
   */
  async function act(
    title: GroupTitle,
    patch: Patch,
    call: (groupId: string) => Promise<GroupTitle>,
  ): Promise<GroupTitle> {
    const id = groupId.value;
    if (!id) throw new Error('Aucun groupe');
    put(patched(title, patch));
    try {
      const updated = await call(id);
      if (groupId.value === id) put(updated);
      return updated;
    } finally {
      if (groupId.value === id) refresh();
    }
  }

  const setStatus = (title: GroupTitle, value: WatchStatus) =>
    act(title, { status: value }, (id) =>
      titlesApi.setStatus(id, title.id, value),
    );

  const setWatchedAlone = (title: GroupTitle, watched: boolean) =>
    act(
      title,
      {
        watchedAloneAt: watched ? new Date().toISOString() : null,
        // Comme l'API : vu seul sans avis = « sans moi, ok ».
        status:
          watched && title.myStatus === 'PENDING' ? 'OK_ALONE' : undefined,
      },
      (id) => titlesApi.setWatchedAlone(id, title.id, watched),
    );

  const setWatchedTogether = (title: GroupTitle, watched: boolean) =>
    act(
      title,
      { watchedTogetherAt: watched ? new Date().toISOString() : null },
      (id) => titlesApi.setWatchedTogether(id, title.id, watched),
    );

  function reset() {
    titles.value = [];
    history.value = [];
    groupId.value = null;
    status.value = 'idle';
    historyStatus.value = 'idle';
  }

  return {
    titles,
    history,
    groupId,
    status,
    historyStatus,
    byView,
    pendingCount,
    load,
    loadHistory,
    refresh,
    add,
    setStatus,
    setWatchedAlone,
    setWatchedTogether,
    reset,
  };
});
