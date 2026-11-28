import { z } from 'zod';
import { mediaUrlSchema } from './titles.js';

/**
 * Synchro d'une playlist YouTube par membre : chacun peut lier une playlist
 * publique ou non répertoriée à son groupe, et ses nouvelles vidéos arrivent
 * dans la liste. Lue avec la clé API du serveur, sans OAuth : la liste
 * « À regarder plus tard » et les playlists privées sont hors d'atteinte.
 */

/** À l'ouverture de l'app, le groupe est resynchronisé s'il ne l'a pas été depuis 4 h. */
export const PLAYLIST_AUTO_SYNC_INTERVAL_MS = 4 * 3600 * 1000;
/** Bouton « Synchroniser » : une fois toutes les 15 min par groupe. */
export const PLAYLIST_MANUAL_SYNC_INTERVAL_MS = 15 * 60 * 1000;
/**
 * Vidéos lues au plus par playlist (pages de 50, 1 unité de quota chacune).
 * Au-delà, les vidéos du bas de la playlist sont ignorées.
 */
export const PLAYLIST_MAX_ITEMS_READ = 200;

/** Un id de playlist YouTube (PL…, UU…, OL…, etc.). */
const PLAYLIST_ID = /^[A-Za-z0-9_-]{10,64}$/;

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
]);

/**
 * Listes propres au compte que l'API ne lit pas avec une simple clé :
 * À regarder plus tard (WL), vidéos aimées (LL, LM), mix générés (RD…).
 */
const PRIVATE_LISTS = /^(WL|LL|LM)$|^RD/;

export type PlaylistIdParse =
  | { ok: true; playlistId: string }
  | { ok: false; reason: 'INVALID_PLAYLIST_URL' | 'PLAYLIST_NOT_SUPPORTED' };

/** Id de la playlist d'un lien YouTube (`?list=`), ou la raison du refus. */
export function parseYouTubePlaylistId(raw: string): PlaylistIdParse {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'INVALID_PLAYLIST_URL' };
  }
  const host = url.hostname.toLowerCase();
  const list = url.searchParams.get('list');
  if (
    (url.protocol !== 'https:' && url.protocol !== 'http:') ||
    !YOUTUBE_HOSTS.has(host) ||
    !list
  ) {
    return { ok: false, reason: 'INVALID_PLAYLIST_URL' };
  }
  if (PRIVATE_LISTS.test(list)) {
    return { ok: false, reason: 'PLAYLIST_NOT_SUPPORTED' };
  }
  if (!PLAYLIST_ID.test(list)) {
    return { ok: false, reason: 'INVALID_PLAYLIST_URL' };
  }
  return { ok: true, playlistId: list };
}

/** Lien canonique d'une playlist. */
export function youTubePlaylistUrl(playlistId: string): string {
  return `https://www.youtube.com/playlist?list=${playlistId}`;
}

export const linkPlaylistRequestSchema = z.object({
  url: mediaUrlSchema,
  /** Importer aussi les vidéos déjà dans la playlist (sinon : seulement les suivantes). */
  importExisting: z.boolean({ error: 'validation.invalid' }),
});
export type LinkPlaylistRequest = z.input<typeof linkPlaylistRequestSchema>;

export const syncPlaylistsRequestSchema = z.object({
  /** auto : à l'ouverture, seulement après 4 h ; manual : le bouton, après 15 min. */
  mode: z.enum(['auto', 'manual'], { error: 'validation.invalid' }),
});
export type SyncPlaylistsRequest = z.input<typeof syncPlaylistsRequestSchema>;

/** Ma playlist liée à un groupe. */
export interface MyPlaylist {
  playlistId: string;
  url: string;
  linkedAt: string;
  /** Les vidéos présentes au moment de la liaison ont été importées. */
  importExisting: boolean;
  /**
   * NOT_FOUND : playlist devenue privée ou supprimée à la dernière synchro.
   * TOO_LONG : plus de PLAYLIST_MAX_ITEMS_READ vidéos, celles du bas ne sont
   * pas lues.
   */
  error: 'NOT_FOUND' | 'TOO_LONG' | null;
}

/** État de la synchro des playlists d'un groupe, vu par un membre. */
export interface GroupPlaylists {
  /** Faux si le serveur n'a pas de clé API YouTube : la fonction est masquée. */
  enabled: boolean;
  mine: MyPlaylist | null;
  /** Membres du groupe qui ont lié une playlist (moi compris). */
  linkedCount: number;
  lastSyncedAt: string | null;
  /** Le bouton « Synchroniser » est utilisable à partir de cette date. */
  nextManualSyncAt: string | null;
  /** Vidéos qui attendent une place (liste pleine) à la dernière synchro. */
  waiting: number;
}

export interface PlaylistSyncResult {
  /** Faux : synchro automatique inutile (faite il y a moins de 4 h). */
  synced: boolean;
  /** Titres ajoutés à la liste. */
  added: number;
  /** Vidéos qui attendent une place. */
  waiting: number;
  state: GroupPlaylists;
}

export const PlaylistErrorCode = {
  /** Pas un lien de playlist YouTube. */
  INVALID_PLAYLIST_URL: 'INVALID_PLAYLIST_URL',
  /** À regarder plus tard, vidéos aimées, mix : illisibles sans OAuth. */
  PLAYLIST_NOT_SUPPORTED: 'PLAYLIST_NOT_SUPPORTED',
  /** Playlist privée, supprimée ou inexistante. */
  PLAYLIST_NOT_FOUND: 'PLAYLIST_NOT_FOUND',
  /** Synchronisée il y a moins de 15 min. */
  PLAYLIST_SYNC_TOO_SOON: 'PLAYLIST_SYNC_TOO_SOON',
  /** Pas de clé API YouTube sur ce serveur. */
  PLAYLIST_SYNC_DISABLED: 'PLAYLIST_SYNC_DISABLED',
  /** Part du quota YouTube du jour épuisée : réessayer demain. */
  PLAYLIST_QUOTA_EXCEEDED: 'PLAYLIST_QUOTA_EXCEEDED',
} as const;
export type PlaylistErrorCode =
  (typeof PlaylistErrorCode)[keyof typeof PlaylistErrorCode];
