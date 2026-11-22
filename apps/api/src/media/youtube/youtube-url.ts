/** Un identifiant de vidéo YouTube : 11 caractères base64url. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

/** Chemins de la forme /<préfixe>/<id>. */
const PATH_PREFIXES = new Set(['shorts', 'live', 'embed', 'v', 'e']);

/**
 * Id de la vidéo d'un lien YouTube, ou null. Formats reconnus : watch?v=,
 * youtu.be/, /shorts/, /live/, /embed/, sur youtube.com et ses variantes
 * (m., music., nocookie). Une playlist seule n'est pas une vidéo (import de
 * playlist : hors MVP).
 */
export function parseYouTubeVideoId(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);

  let id: string | null | undefined;
  if (host === 'youtu.be') {
    id = segments[0];
  } else if (YOUTUBE_HOSTS.has(host)) {
    if (segments[0] === 'watch') id = url.searchParams.get('v');
    else if (segments.length >= 2 && PATH_PREFIXES.has(segments[0]))
      id = segments[1];
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

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
