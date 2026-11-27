import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { parseIsoDuration } from '../media/youtube/youtube-url.js';

const API = 'https://www.googleapis.com/youtube/v3';
const TIMEOUT_MS = 8000;
/** Maximum de l'API par page ou par appel groupé. */
export const PAGE_SIZE = 50;
const MAX_TEXT = 300;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const errorSchema = z.object({
  error: z
    .object({
      errors: z.array(z.object({ reason: z.string().optional() })).optional(),
    })
    .optional(),
});

const playlistsSchema = z.object({ items: z.array(z.unknown()) });

const playlistItemsSchema = z.object({
  nextPageToken: z.string().optional(),
  items: z.array(
    z.object({
      snippet: z
        .object({
          /** Date d'ajout de la vidéo à la playlist. */
          publishedAt: z.string().optional(),
          resourceId: z.object({ videoId: z.string().optional() }).optional(),
        })
        .optional(),
      status: z.object({ privacyStatus: z.string().optional() }).optional(),
    }),
  ),
});

const videosSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      snippet: z
        .object({ title: z.string(), channelTitle: z.string().optional() })
        .optional(),
      contentDetails: z.object({ duration: z.string() }).optional(),
    }),
  ),
});

export interface PlaylistEntry {
  videoId: string;
  /** Ajoutée à la playlist à cette date (null si YouTube ne la donne pas). */
  addedAt: Date | null;
}

export interface VideoDetails {
  videoId: string;
  title: string;
  author: string | null;
  durationSec: number | null;
}

/** not-found : privée, supprimée ou inexistante. quota : quota YouTube épuisé. */
export type Failure = 'not-found' | 'unavailable' | 'quota';

const clip = (value: string) => value.trim().slice(0, MAX_TEXT);

/**
 * Lecture des playlists avec l'API YouTube Data v3 (clé du serveur, sans
 * OAuth). Chaque appel coûte 1 unité de quota : le service appelant les
 * réserve avant (YouTubeQuotaService). La clé est dans l'URL : jamais
 * journalisée.
 */
export class YouTubePlaylistClient {
  private readonly logger = new Logger(YouTubePlaylistClient.name);

  constructor(
    private readonly apiKey: string | undefined,
    private readonly fetchFn: typeof fetch = (input, init) =>
      fetch(input, init),
  ) {}

  get enabled(): boolean {
    return !!this.apiKey;
  }

  /** La playlist existe et se lit avec une clé (publique ou non répertoriée). 1 unité. */
  async exists(playlistId: string): Promise<true | Failure> {
    const reply = await this.call('playlists', {
      part: 'id',
      id: playlistId,
      fields: 'items(id)',
    });
    if (typeof reply === 'string') return reply;
    const parsed = playlistsSchema.safeParse(reply.body);
    if (!parsed.success) return 'unavailable';
    // Une playlist privée n'est simplement pas renvoyée.
    return parsed.data.items.length > 0 ? true : 'not-found';
  }

  /**
   * Une page de la playlist (50 vidéos), dans l'ordre de la playlist. Les
   * vidéos privées ou supprimées sont écartées. 1 unité.
   */
  async page(
    playlistId: string,
    pageToken?: string,
  ): Promise<{ entries: PlaylistEntry[]; next: string | null } | Failure> {
    const reply = await this.call('playlistItems', {
      part: 'snippet,status',
      playlistId,
      maxResults: String(PAGE_SIZE),
      fields:
        'nextPageToken,items(snippet(publishedAt,resourceId(videoId)),status(privacyStatus))',
      ...(pageToken ? { pageToken } : {}),
    });
    if (typeof reply === 'string') return reply;
    const parsed = playlistItemsSchema.safeParse(reply.body);
    if (!parsed.success) return 'unavailable';
    const entries: PlaylistEntry[] = [];
    for (const item of parsed.data.items) {
      const videoId = item.snippet?.resourceId?.videoId;
      const privacy = item.status?.privacyStatus;
      if (!videoId || !VIDEO_ID.test(videoId)) continue;
      if (privacy === 'private' || privacy === 'privacyStatusUnspecified') {
        continue;
      }
      const addedAt = item.snippet?.publishedAt
        ? new Date(item.snippet.publishedAt)
        : null;
      entries.push({
        videoId,
        addedAt: addedAt && !isNaN(addedAt.getTime()) ? addedAt : null,
      });
    }
    return { entries, next: parsed.data.nextPageToken ?? null };
  }

  /**
   * Titre, chaîne et durée de 50 vidéos au plus, en un appel (1 unité). Une
   * vidéo absente de la réponse est privée ou supprimée.
   */
  async videos(ids: string[]): Promise<VideoDetails[] | Failure> {
    if (ids.length === 0) return [];
    const reply = await this.call('videos', {
      part: 'snippet,contentDetails',
      id: ids.slice(0, PAGE_SIZE).join(','),
      maxResults: String(PAGE_SIZE),
      fields: 'items(id,snippet(title,channelTitle),contentDetails(duration))',
    });
    if (typeof reply === 'string') return reply;
    const parsed = videosSchema.safeParse(reply.body);
    if (!parsed.success) return 'unavailable';
    return parsed.data.items
      .filter((item) => item.snippet?.title)
      .map((item) => ({
        videoId: item.id,
        title: clip(item.snippet!.title),
        author: item.snippet?.channelTitle
          ? clip(item.snippet.channelTitle)
          : null,
        durationSec: item.contentDetails
          ? parseIsoDuration(item.contentDetails.duration)
          : null,
      }));
  }

  private async call(
    resource: string,
    params: Record<string, string>,
  ): Promise<{ body: unknown } | Failure> {
    if (!this.apiKey) return 'unavailable';
    const query = new URLSearchParams({ ...params, key: this.apiKey });
    try {
      const response = await this.fetchFn(`${API}/${resource}?${query}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.ok) return { body: await response.json() };
      const reasons =
        errorSchema
          .safeParse(await response.json().catch(() => ({})))
          .data?.error?.errors?.map((e) => e.reason) ?? [];
      if (
        reasons.some((r) => r === 'quotaExceeded' || r === 'dailyLimitExceeded')
      ) {
        this.logger.warn(`API YouTube Data : quota épuisé (${resource})`);
        return 'quota';
      }
      // 404 playlistNotFound ; 403 playlistItemsNotAccessible (privée). Un
      // autre 403 (clé refusée, API non activée) ne dit rien de la playlist.
      if (
        response.status === 404 ||
        reasons.some(
          (r) =>
            r === 'playlistItemsNotAccessible' || r === 'playlistForbidden',
        )
      ) {
        return 'not-found';
      }
      this.logger.warn(`API YouTube Data : ${response.status} (${resource})`);
      return 'unavailable';
    } catch (error) {
      this.logger.warn(
        `API YouTube Data injoignable (${resource}) : ${String(error)}`,
      );
      return 'unavailable';
    }
  }
}
