import { WatchStatus } from '@watchlist/shared';

/** Distance (px) à partir de laquelle un glissé vaut un choix. */
export const SWIPE_THRESHOLD = 90;

/**
 * Avis correspondant à un glissé de la carte (maquette) : droite = « sans moi,
 * ok », haut = « ensemble », gauche = « pas pour moi ». Null : pas assez loin,
 * la carte revient en place.
 */
export function swipeChoice(dx: number, dy: number): WatchStatus | null {
  if (-dy >= SWIPE_THRESHOLD && -dy > Math.abs(dx)) return WatchStatus.TOGETHER;
  if (Math.abs(dy) > Math.abs(dx)) return null;
  if (dx >= SWIPE_THRESHOLD) return WatchStatus.OK_ALONE;
  if (dx <= -SWIPE_THRESHOLD) return WatchStatus.NOT_INTERESTED;
  return null;
}

/** Choix vers lequel le glissé en cours se dirige (pour l'étiquette de la carte). */
export function swipeHint(dx: number, dy: number): WatchStatus | null {
  return swipeChoice(dx * 2.5, dy * 2.5);
}
