import {
  PLAYLIST_AUTO_SYNC_INTERVAL_MS,
  type GroupPlaylists,
  type LinkPlaylistRequest,
  type PlaylistSyncResult,
} from '@watchlist/shared';
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useTitlesStore } from '@/features/titles/store';
import { playlistsApi } from './api';

/**
 * Playlists YouTube liées au groupe. La synchro « auto » part à l'ouverture de
 * l'app et au retour au premier plan ; l'API ne la fait que si la dernière a
 * plus de 4 h. Pour ne pas l'appeler à chaque retour, on retient ici quand on
 * a demandé pour la dernière fois.
 */
export const usePlaylistsStore = defineStore('playlists', () => {
  const titles = useTitlesStore();
  const state = ref<GroupPlaylists | null>(null);
  const groupId = ref<string | null>(null);
  const lastAuto = new Map<string, number>();
  let autoRunning: Promise<unknown> | null = null;

  function apply(id: string, result: PlaylistSyncResult) {
    if (groupId.value === id) state.value = result.state;
    if (result.added > 0 && titles.groupId === id) titles.refresh();
  }

  async function load(id: string): Promise<GroupPlaylists> {
    if (groupId.value !== id) state.value = null;
    groupId.value = id;
    const loaded = await playlistsApi.state(id);
    if (groupId.value === id) state.value = loaded;
    return loaded;
  }

  /** Synchro discrète à l'ouverture : jamais d'erreur affichée. */
  function autoSync(id: string, now = Date.now()) {
    const last = lastAuto.get(id);
    if (
      autoRunning ||
      (last && now - last < PLAYLIST_AUTO_SYNC_INTERVAL_MS / 4)
    ) {
      return;
    }
    lastAuto.set(id, now);
    autoRunning = playlistsApi
      .sync(id, 'auto')
      .then((result) => apply(id, result))
      .catch(() => undefined)
      .finally(() => (autoRunning = null));
  }

  async function syncNow(id: string): Promise<PlaylistSyncResult> {
    const result = await playlistsApi.sync(id, 'manual');
    apply(id, result);
    return result;
  }

  async function link(
    id: string,
    body: LinkPlaylistRequest,
  ): Promise<PlaylistSyncResult> {
    const result = await playlistsApi.link(id, body);
    groupId.value = id;
    apply(id, result);
    return result;
  }

  async function unlink(id: string) {
    const next = await playlistsApi.unlink(id);
    if (groupId.value === id) state.value = next;
  }

  function reset() {
    state.value = null;
    groupId.value = null;
    lastAuto.clear();
  }

  return { state, groupId, load, autoSync, syncNow, link, unlink, reset };
});
