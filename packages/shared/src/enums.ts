/** Avis d'un membre sur un titre. L'absence d'avis (pas de ligne en base) vaut PENDING. */
export const WatchStatus = {
  OK_ALONE: 'OK_ALONE',
  TOGETHER: 'TOGETHER',
  NOT_INTERESTED: 'NOT_INTERESTED',
} as const;
export type WatchStatus = (typeof WatchStatus)[keyof typeof WatchStatus];

/** Statut tel qu'affiché : un avis donné, ou PENDING. */
export type MemberStatus = WatchStatus | 'PENDING';

/**
 * Services d'où viennent les titres. Ajouter un service = une valeur ici
 * + une implémentation de MediaSource côté API.
 */
export const MediaSourceType = {
  YOUTUBE: 'YOUTUBE',
  TMDB: 'TMDB',
  MANUAL: 'MANUAL',
} as const;
export type MediaSourceType =
  (typeof MediaSourceType)[keyof typeof MediaSourceType];

export const GroupRole = {
  OWNER: 'OWNER',
  MEMBER: 'MEMBER',
} as const;
export type GroupRole = (typeof GroupRole)[keyof typeof GroupRole];
