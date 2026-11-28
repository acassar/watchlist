import type {
  GroupPlaylists,
  LinkPlaylistRequest,
  PlaylistSyncResult,
} from '@watchlist/shared';
import { api } from '@/api/http';

const base = (groupId: string) =>
  `/groups/${encodeURIComponent(groupId)}/playlists`;

export const playlistsApi = {
  state: (groupId: string) => api<GroupPlaylists>(base(groupId)),
  link: (groupId: string, body: LinkPlaylistRequest) =>
    api<PlaylistSyncResult>(`${base(groupId)}/mine`, { method: 'PUT', body }),
  unlink: (groupId: string) =>
    api<GroupPlaylists>(`${base(groupId)}/mine`, { method: 'DELETE' }),
  sync: (groupId: string, mode: 'auto' | 'manual') =>
    api<PlaylistSyncResult>(`${base(groupId)}/sync`, { body: { mode } }),
};
