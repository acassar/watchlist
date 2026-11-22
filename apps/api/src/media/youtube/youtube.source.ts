import { Logger } from '@nestjs/common';
import { MediaSourceType, type MediaInfo } from '@watchlist/shared';
import { z } from 'zod';
import {
  MediaNotFoundError,
  MediaUnavailableError,
  type MediaSource,
} from '../media-source.js';
import {
  parseIsoDuration,
  parseYouTubeVideoId,
  youTubeThumbnailUrl,
  youTubeWatchUrl,
} from './youtube-url.js';

const OEMBED_ENDPOINT = 'https://www.youtube.com/oembed';
const DATA_API_ENDPOINT = 'https://www.googleapis.com/youtube/v3/videos';
const TIMEOUT_MS = 5000;
/** Un titre YouTube fait au plus 100 caractères ; marge pour les autres champs. */
const MAX_TEXT = 300;

const oEmbedSchema = z.object({
  title: z.string().min(1),
  author_name: z.string().optional(),
});

const videosSchema = z.object({
  items: z.array(
    z.object({
      snippet: z
        .object({ title: z.string(), channelTitle: z.string().optional() })
        .optional(),
      contentDetails: z.object({ duration: z.string() }).optional(),
    }),
  ),
});

type Lookup<T> = T | 'not-found' | 'unavailable';

interface Basics {
  title: string;
  author: string | null;
}

interface Details extends Basics {
  durationSec: number | null;
}

const clip = (value: string) => value.trim().slice(0, MAX_TEXT);

/**
 * Vidéos YouTube. Deux appels en parallèle :
 * - oEmbed (sans clé) : titre et chaîne ;
 * - API Data v3 (clé côté serveur, facultative) : durée, et titre/chaîne de
 *   secours quand oEmbed refuse (intégration désactivée par l'auteur).
 * Sans clé, tout marche sauf la durée (null).
 */
export class YouTubeSource implements MediaSource {
  readonly type = MediaSourceType.YOUTUBE;
  private readonly logger = new Logger(YouTubeSource.name);

  constructor(
    private readonly apiKey: string | undefined,
    // Résolu à chaque appel (et non capturé ici) pour que les tests puissent le remplacer.
    private readonly fetchFn: typeof fetch = (input, init) =>
      fetch(input, init),
  ) {}

  canHandle(url: string): boolean {
    return this.extractId(url) !== null;
  }

  extractId(url: string): string | null {
    return parseYouTubeVideoId(url);
  }

  async resolve(url: string): Promise<MediaInfo> {
    const id = this.extractId(url);
    if (!id) throw new MediaNotFoundError('Lien YouTube non reconnu');

    const [basics, details] = await Promise.all([
      this.fetchOEmbed(id),
      this.fetchDetails(id),
    ]);

    const found =
      typeof basics === 'object'
        ? basics
        : typeof details === 'object' && details.title
          ? details
          : null;
    if (!found) {
      if (basics === 'not-found' || details === 'not-found') {
        throw new MediaNotFoundError(`Vidéo ${id} introuvable`);
      }
      throw new MediaUnavailableError('YouTube ne répond pas');
    }

    return {
      source: this.type,
      externalId: id,
      url: youTubeWatchUrl(id),
      title: found.title,
      author: found.author,
      thumbnailUrl: youTubeThumbnailUrl(id),
      durationSec: typeof details === 'object' ? details.durationSec : null,
    };
  }

  /** oEmbed : 401/403 = privée ou intégration désactivée, 400/404 = inexistante. */
  private async fetchOEmbed(id: string): Promise<Lookup<Basics>> {
    const query = new URLSearchParams({
      url: youTubeWatchUrl(id),
      format: 'json',
    });
    try {
      const response = await this.fetchFn(`${OEMBED_ENDPOINT}?${query}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if ([400, 401, 403, 404].includes(response.status)) return 'not-found';
      if (!response.ok) {
        this.logger.warn(`oEmbed a répondu ${response.status} pour ${id}`);
        return 'unavailable';
      }
      const data = oEmbedSchema.parse(await response.json());
      return {
        title: clip(data.title),
        author: data.author_name ? clip(data.author_name) : null,
      };
    } catch (error) {
      this.logger.warn(`oEmbed injoignable pour ${id} : ${String(error)}`);
      return 'unavailable';
    }
  }

  /**
   * API Data v3 : 1 unité de quota par appel (10 000 par jour gratuites).
   * Sans clé ou en cas d'échec : 'unavailable', la durée restera inconnue.
   * L'URL contient la clé : elle n'est jamais journalisée.
   */
  private async fetchDetails(id: string): Promise<Lookup<Details>> {
    if (!this.apiKey) return 'unavailable';
    const query = new URLSearchParams({
      part: 'snippet,contentDetails',
      id,
      key: this.apiKey,
      fields: 'items(snippet(title,channelTitle),contentDetails(duration))',
    });
    try {
      const response = await this.fetchFn(`${DATA_API_ENDPOINT}?${query}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        // 403 quotaExceeded, clé invalide… : on continue sans la durée.
        this.logger.warn(`API YouTube Data : ${response.status} pour ${id}`);
        return 'unavailable';
      }
      const item = videosSchema.parse(await response.json()).items[0];
      if (!item) return 'not-found';
      return {
        title: clip(item.snippet?.title ?? ''),
        author: item.snippet?.channelTitle
          ? clip(item.snippet.channelTitle)
          : null,
        durationSec: item.contentDetails
          ? parseIsoDuration(item.contentDetails.duration)
          : null,
      };
    } catch (error) {
      this.logger.warn(`API YouTube Data injoignable : ${String(error)}`);
      return 'unavailable';
    }
  }
}
