import type {
  AddTitleRequest,
  GroupTitle,
  MediaInfo,
  WatchStatus,
} from '@watchlist/shared';
import { api } from '@/api/http';

const titles = (groupId: string) =>
  `/groups/${encodeURIComponent(groupId)}/titles`;
const title = (groupId: string, titleId: string) =>
  `${titles(groupId)}/${encodeURIComponent(titleId)}`;

export const titlesApi = {
  /** Aperçu d'un lien avant de l'ajouter. */
  resolve: (url: string) =>
    api<MediaInfo>(`/media/resolve?${new URLSearchParams({ url })}`),
  /** Mes listes actives. */
  list: (groupId: string) => api<GroupTitle[]>(titles(groupId)),
  /** Vus ensemble, archivés, vus seul, pas pour moi. */
  history: (groupId: string) => api<GroupTitle[]>(`${titles(groupId)}/history`),
  add: (groupId: string, body: AddTitleRequest) =>
    api<GroupTitle>(titles(groupId), { body }),
  setStatus: (groupId: string, titleId: string, status: WatchStatus) =>
    api<GroupTitle>(`${title(groupId, titleId)}/status`, {
      method: 'PUT',
      body: { status },
    }),
  setWatchedAlone: (groupId: string, titleId: string, watched: boolean) =>
    api<GroupTitle>(`${title(groupId, titleId)}/watched-alone`, {
      method: watched ? 'PUT' : 'DELETE',
    }),
  setWatchedTogether: (groupId: string, titleId: string, watched: boolean) =>
    api<GroupTitle>(`${title(groupId, titleId)}/watched-together`, {
      method: watched ? 'PUT' : 'DELETE',
      body: watched ? {} : undefined,
    }),
};
