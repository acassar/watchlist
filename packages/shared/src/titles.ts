import { z } from 'zod';
import {
  WatchStatus,
  type MediaSourceType,
  type MemberStatus,
} from './enums.js';
import type { TitleView } from './views.js';

/**
 * Contrats de l'ajout de titres (étape 5). Le front ne sait rien des services
 * (YouTube, plus tard TMDB…) : il envoie une URL, l'API trouve la source qui
 * sait la lire (abstraction MediaSource).
 */

/** Une URL plus longue n'est pas un lien de partage normal. */
export const MEDIA_URL_MAX_LENGTH = 2048;
/** Garde-fou contre l'abus : une watchlist de couple n'en approche pas. */
export const GROUP_MAX_TITLES = 2000;
/**
 * Titres « en cours » (pas encore vus ensemble) par groupe. Limite volontaire
 * pour garder une liste qu'on regarde vraiment : marquer un titre « vu
 * ensemble » libère une place.
 */
export const GROUP_MAX_ACTIVE_TITLES = 50;

/** Toutes les URL http(s) d'un texte, dans l'ordre. */
export function findAllUrls(text: string): string[] {
  return [...text.matchAll(/https?:\/\/[^\s<>"'«»]+/gi)].map((match) =>
    // Ponctuation de fin de phrase collée au lien.
    match[0].replace(/[).,;:!?]+$/, ''),
  );
}

/**
 * Première URL http(s) trouvée dans un texte. Le presse-papiers ou un partage
 * contient souvent plus que le lien (« Regarde ça ! https://youtu.be/… »).
 */
export function findFirstUrl(text: string): string | null {
  return findAllUrls(text)[0] ?? null;
}

export const mediaUrlSchema = z
  .string({ error: 'validation.required' })
  .trim()
  .min(1, { error: 'validation.required' })
  .max(MEDIA_URL_MAX_LENGTH, { error: 'validation.mediaUrl' })
  // On accepte un texte qui contient le lien, pas seulement le lien.
  .transform((value, ctx) => {
    const url = findFirstUrl(value);
    if (!url) {
      ctx.addIssue({ code: 'custom', message: 'validation.mediaUrl' });
      return z.NEVER;
    }
    return url;
  });

export const resolveMediaRequestSchema = z.object({ url: mediaUrlSchema });
export type ResolveMediaRequest = z.input<typeof resolveMediaRequestSchema>;

export const addTitleRequestSchema = z.object({
  url: mediaUrlSchema,
  /** Avis de la personne qui ajoute. « Sans moi, ok » par défaut. */
  status: z
    .enum(WatchStatus, { error: 'validation.invalid' })
    .default(WatchStatus.OK_ALONE),
});
export type AddTitleRequest = z.input<typeof addTitleRequestSchema>;

/** Métadonnées d'un titre, quel que soit son service d'origine. */
export interface MediaInfo {
  source: MediaSourceType;
  /** Identifiant chez le service (ex. l'id de la vidéo YouTube). */
  externalId: string;
  /** Lien canonique vers le titre. */
  url: string;
  title: string;
  /** Hotlink chez le service (pas de copie chez nous). */
  thumbnailUrl: string | null;
  /** Chaîne YouTube, réalisateur… */
  author: string | null;
  /** Null si inconnue (pas de clé API, direct en cours…). */
  durationSec: number | null;
  /**
   * Vidéo supprimée ou devenue privée : titre, chaîne et miniature sont
   * effacés (règles de l'API YouTube), l'interface affiche « Vidéo
   * indisponible ».
   */
  unavailable?: boolean;
}

/** Avis d'un membre actuel du groupe sur un titre. */
export interface TitleMember {
  userId: string;
  displayName: string;
  status: MemberStatus;
  /** « Vu seul » : le titre ne sort que des listes de ce membre. */
  watchedAloneAt: string | null;
}

/** Titre de la liste d'un groupe, vu par le membre connecté. */
export interface GroupTitle {
  id: string;
  media: MediaInfo;
  addedAt: string;
  /** Null si l'auteur a supprimé son compte. */
  addedBy: {
    userId: string;
    displayName: string;
    /** A quitté le groupe : affiché « ancien membre ». */
    formerMember: boolean;
  } | null;
  /** Mon avis ; PENDING si je n'en ai pas encore donné. */
  myStatus: MemberStatus;
  myWatchedAloneAt: string | null;
  /** Vu ensemble : sorti des listes de tout le groupe. */
  watchedTogetherAt: string | null;
  /** Membres actuels, moi en premier puis par ordre d'arrivée. */
  members: TitleMember[];
  /** Où le titre se range pour moi (calculé par l'API). */
  view: TitleView;
}

export const TitleErrorCode = {
  /** Aucune source ne sait lire ce lien (pas un lien YouTube, par exemple). */
  UNSUPPORTED_URL: 'UNSUPPORTED_URL',
  /** Vidéo introuvable, privée ou supprimée. */
  MEDIA_NOT_FOUND: 'MEDIA_NOT_FOUND',
  /** Le service ne répond pas : réessayer plus tard. */
  MEDIA_UNAVAILABLE: 'MEDIA_UNAVAILABLE',
  TITLE_ALREADY_IN_GROUP: 'TITLE_ALREADY_IN_GROUP',
  TOO_MANY_TITLES: 'TOO_MANY_TITLES',
  /** Trop de titres en cours (GROUP_MAX_ACTIVE_TITLES). */
  TOO_MANY_ACTIVE_TITLES: 'TOO_MANY_ACTIVE_TITLES',
} as const;
export type TitleErrorCode =
  (typeof TitleErrorCode)[keyof typeof TitleErrorCode];

/** Durée lisible : « 4:05 », « 1:02:03 ». */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = String(s % 60).padStart(2, '0');
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}
