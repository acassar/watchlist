import type { MediaInfo } from '@watchlist/shared';

/**
 * Nom affiché d'un titre. Une vidéo supprimée ou devenue privée n'a plus de
 * titre stocké (règles de l'API YouTube) : on affiche « Vidéo indisponible ».
 */
export function mediaTitle(
  media: Pick<MediaInfo, 'title' | 'unavailable'>,
  t: (key: string) => string,
): string {
  return media.unavailable ? t('titles.unavailable') : media.title;
}
