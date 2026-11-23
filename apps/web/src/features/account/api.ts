import type { AccountExport, DeleteAccountRequest } from '@watchlist/shared';
import { api } from '@/api/http';

export const accountApi = {
  export: () => api<AccountExport>('/me/export'),
  delete: (body: DeleteAccountRequest) => api('/me/delete', { body }),
};

/** Propose le fichier d'export au téléchargement (rien n'est envoyé ailleurs). */
export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Laisse le temps au navigateur de lancer le téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
