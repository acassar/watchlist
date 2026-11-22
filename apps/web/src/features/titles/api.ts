import type { AddTitleRequest, GroupTitle, MediaInfo } from '@watchlist/shared';
import { api } from '@/api/http';

const titles = (groupId: string) =>
  `/groups/${encodeURIComponent(groupId)}/titles`;

export const titlesApi = {
  /** Aperçu d'un lien avant de l'ajouter. */
  resolve: (url: string) =>
    api<MediaInfo>(`/media/resolve?${new URLSearchParams({ url })}`),
  list: (groupId: string) => api<GroupTitle[]>(titles(groupId)),
  add: (groupId: string, body: AddTitleRequest) =>
    api<GroupTitle>(titles(groupId), { body }),
};
