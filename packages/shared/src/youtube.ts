import { findAllUrls } from './titles.js';

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

/**
 * Lien à ajouter depuis un partage (Web Share Target). Les applications ne
 * remplissent pas les champs de la même façon : l'app YouTube met souvent le
 * lien dans `text` (« Regarde ça https://youtu.be/… ») et laisse `url` vide.
 * On prend donc la première URL YouTube trouvée dans n'importe quel champ,
 * à défaut la première URL tout court (l'API dira alors si elle sait la lire).
 */
export function findSharedLink(
  fields: readonly (string | null | undefined)[],
): string | null {
  const urls = fields.flatMap((field) =>
    typeof field === 'string' ? findAllUrls(field) : [],
  );
  return (
    urls.find((url) => parseYouTubeVideoId(url) !== null) ?? urls[0] ?? null
  );
}
