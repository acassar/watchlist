import type { MediaInfo, MediaSourceType } from '@watchlist/shared';

/**
 * Un service d'où viennent les titres (YouTube aujourd'hui, TMDB ou saisie
 * libre plus tard). Ajouter un service = une valeur dans MediaSourceType
 * (shared), une implémentation de cette interface, et l'enregistrer dans
 * MEDIA_SOURCES (media.module.ts). Le reste (cache, ajout aux groupes) ne
 * change pas.
 */
export interface MediaSource {
  readonly type: MediaSourceType;

  /** Vrai si ce service sait lire cette URL. Aucun appel réseau. */
  canHandle(url: string): boolean;

  /**
   * Identifiant du titre chez le service, sans appel réseau, ou null si l'URL
   * n'est pas reconnue. Sert de clé de cache avec `type`.
   */
  extractId(url: string): string | null;

  /**
   * Métadonnées du titre. Lève MediaNotFoundError (titre introuvable ou privé)
   * ou MediaUnavailableError (service injoignable).
   */
  resolve(url: string): Promise<MediaInfo>;

  // Plus tard (hors MVP) : importCollection(url) pour les playlists.
}

/** Liste des sources actives, injectée dans le registre. */
export const MEDIA_SOURCES = Symbol('MEDIA_SOURCES');

/** Le titre n'existe pas, a été supprimé ou est privé. */
export class MediaNotFoundError extends Error {
  override name = 'MediaNotFoundError';
}

/** Le service ne répond pas correctement : réessayer plus tard. */
export class MediaUnavailableError extends Error {
  override name = 'MediaUnavailableError';
}
