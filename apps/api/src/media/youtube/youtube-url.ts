/**
 * Lecture des liens YouTube : dans le paquet partagé, car le front en a besoin
 * aussi pour trouver le lien dans un partage Android.
 */
export { parseYouTubeVideoId } from '@watchlist/shared';

/** Lien canonique, enregistré en base quel que soit le format collé. */
export function youTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Miniature servie par YouTube (hotlink, décision D6). Construite à partir de
 * l'id plutôt que reprise de la réponse : on n'affiche jamais une URL d'image
 * venue d'ailleurs. `mqdefault` = 320×180, en 16:9 sans bandes noires.
 */
export function youTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

/**
 * Durée ISO 8601 de l'API Data (« PT1H2M3S ») en secondes. Null si illisible,
 * ou 0 (« P0D » : direct en cours ou à venir).
 */
export function parseIsoDuration(value: string): number | null {
  const match = value.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/,
  );
  if (!match) return null;
  const [, d = '0', h = '0', m = '0', s = '0'] = match;
  const total = +d * 86_400 + +h * 3600 + +m * 60 + +s;
  return total > 0 ? total : null;
}
