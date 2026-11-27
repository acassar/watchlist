import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  GROUP_MAX_ACTIVE_TITLES,
  GROUP_MAX_TITLES,
  MediaSourceType,
  parseYouTubePlaylistId,
  PLAYLIST_AUTO_SYNC_INTERVAL_MS,
  PLAYLIST_MANUAL_SYNC_INTERVAL_MS,
  PLAYLIST_MAX_ITEMS_READ,
  PlaylistErrorCode,
  TitleErrorCode,
  youTubePlaylistUrl,
  type GroupPlaylists,
  type PlaylistSyncResult,
} from '@watchlist/shared';
import { Prisma, type GroupPlaylist } from '../generated/prisma/client.js';
import { groupNotFound } from '../groups/group-member.guard.js';
import { lockGroup } from '../groups/groups.service.js';
import { MEDIA_CACHE_MAX_AGE_MS } from '../media/media.service.js';
import {
  youTubeThumbnailUrl,
  youTubeWatchUrl,
} from '../media/youtube/youtube-url.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { countActiveTitles } from '../titles/active-titles.js';
import {
  PAGE_SIZE,
  YouTubePlaylistClient,
  type Failure,
  type PlaylistEntry,
} from './youtube-playlist.client.js';
import { YouTubeQuotaService } from './youtube-quota.service.js';

const MAX_PAGES = Math.ceil(PLAYLIST_MAX_ITEMS_READ / PAGE_SIZE);

interface Candidate {
  videoId: string;
  ownerId: string;
}

interface RunReport {
  added: number;
  waiting: number;
}

/** Arrêt de la synchro : part du quota du jour épuisée. */
class QuotaStop extends Error {}

function disabled() {
  return new ServiceUnavailableException({
    code: PlaylistErrorCode.PLAYLIST_SYNC_DISABLED,
    message: 'Synchro des playlists indisponible sur ce serveur',
  });
}

function quotaExceeded() {
  return new ServiceUnavailableException({
    code: PlaylistErrorCode.PLAYLIST_QUOTA_EXCEEDED,
    message: 'Quota YouTube du jour épuisé, réessayez demain',
  });
}

/**
 * Vidéos de plusieurs playlists, à tour de rôle (la 1re de chacun, puis la
 * 2e…) : quand la place manque, aucun membre ne prend toute la liste.
 * Une vidéo présente dans deux playlists n'est gardée qu'une fois.
 */
export function interleave(lists: Candidate[][]): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      const c = list[i];
      if (c && !seen.has(c.videoId)) {
        seen.add(c.videoId);
        out.push(c);
      }
    }
  }
  return out;
}

/**
 * Synchro des playlists YouTube des membres d'un groupe. La synchro ne fait
 * qu'ajouter : une vidéo retirée de la playlist reste dans Canapact. Les
 * vidéos arrivent sans avis (« En attente ») pour tout le monde, propriétaire
 * de la playlist compris. Liste pleine : les vidéos restent dans la playlist
 * et arrivent à une synchro suivante, dès qu'une place se libère.
 */
@Injectable()
export class PlaylistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly youtube: YouTubePlaylistClient,
    private readonly quota: YouTubeQuotaService,
  ) {}

  async state(
    groupId: string,
    userId: string,
    now = new Date(),
  ): Promise<GroupPlaylists> {
    const [group, playlists] = await Promise.all([
      this.prisma.group.findUnique({
        where: { id: groupId },
        select: { playlistsSyncedAt: true, playlistsWaiting: true },
      }),
      this.prisma.groupPlaylist.findMany({ where: { groupId } }),
    ]);
    if (!group) throw groupNotFound();
    const mine = playlists.find((p) => p.userId === userId);
    const syncedAt = group.playlistsSyncedAt;
    const next = syncedAt
      ? new Date(syncedAt.getTime() + PLAYLIST_MANUAL_SYNC_INTERVAL_MS)
      : null;
    return {
      enabled: this.youtube.enabled,
      mine: mine
        ? {
            playlistId: mine.playlistId,
            url: youTubePlaylistUrl(mine.playlistId),
            linkedAt: mine.linkedAt.toISOString(),
            importExisting: mine.importFrom === null,
            error: mine.error === 'NOT_FOUND' ? 'NOT_FOUND' : null,
          }
        : null,
      linkedCount: playlists.length,
      lastSyncedAt: syncedAt?.toISOString() ?? null,
      nextManualSyncAt: next && next > now ? next.toISOString() : null,
      waiting: playlists.length > 0 ? group.playlistsWaiting : 0,
    };
  }

  /**
   * Lie (ou remplace) ma playlist dans ce groupe, puis synchronise le groupe
   * tout de suite pour que ses vidéos apparaissent.
   */
  async link(
    groupId: string,
    userId: string,
    url: string,
    importExisting: boolean,
  ): Promise<PlaylistSyncResult> {
    if (!this.youtube.enabled) throw disabled();
    const parsed = parseYouTubePlaylistId(url);
    if (!parsed.ok) {
      throw new BadRequestException({
        code: parsed.reason,
        message: 'Ce lien ne mène pas à une playlist lisible',
      });
    }
    if (!(await this.quota.tryConsume(groupId))) throw quotaExceeded();
    const found = await this.youtube.exists(parsed.playlistId);
    if (found !== true) {
      if (found === 'quota') {
        await this.quota.exhaust();
        throw quotaExceeded();
      }
      if (found === 'not-found') {
        throw new NotFoundException({
          code: PlaylistErrorCode.PLAYLIST_NOT_FOUND,
          message: 'Playlist introuvable ou privée',
        });
      }
      throw new BadGatewayException({
        code: TitleErrorCode.MEDIA_UNAVAILABLE,
        message: 'YouTube ne répond pas, réessayez plus tard',
      });
    }

    const now = new Date();
    const data = {
      playlistId: parsed.playlistId,
      linkedAt: now,
      importFrom: importExisting ? null : now,
      error: null,
    };
    try {
      await this.prisma.groupPlaylist.upsert({
        where: { groupId_userId: { groupId, userId } },
        create: { groupId, userId, ...data },
        update: data,
      });
    } catch (error) {
      // Parti du groupe entre le guard et l'écriture.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw groupNotFound();
      }
      throw error;
    }
    await this.prisma.group.update({
      where: { id: groupId },
      data: { playlistsSyncedAt: now },
    });
    const report = await this.run(groupId, now);
    return {
      synced: true,
      ...report,
      state: await this.state(groupId, userId),
    };
  }

  async unlink(groupId: string, userId: string): Promise<GroupPlaylists> {
    await this.prisma.groupPlaylist.deleteMany({ where: { groupId, userId } });
    return this.state(groupId, userId);
  }

  /**
   * auto : à l'ouverture de l'app, ne fait rien si la dernière synchro a
   * moins de 4 h. manual : le bouton, refusé si elle a moins de 15 min.
   */
  async sync(
    groupId: string,
    userId: string,
    mode: 'auto' | 'manual',
    now = new Date(),
  ): Promise<PlaylistSyncResult> {
    const skipped = async (): Promise<PlaylistSyncResult> => {
      const state = await this.state(groupId, userId, now);
      return { synced: false, added: 0, waiting: state.waiting, state };
    };
    if (!this.youtube.enabled) {
      if (mode === 'manual') throw disabled();
      return skipped();
    }
    if ((await this.prisma.groupPlaylist.count({ where: { groupId } })) === 0) {
      return skipped();
    }

    // Réservation atomique : deux ouvertures simultanées ne lancent qu'une synchro.
    const interval =
      mode === 'auto'
        ? PLAYLIST_AUTO_SYNC_INTERVAL_MS
        : PLAYLIST_MANUAL_SYNC_INTERVAL_MS;
    const before = new Date(now.getTime() - interval);
    const claimed = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE groups SET playlists_synced_at = ${now}
      WHERE id = ${groupId}::uuid
        AND (playlists_synced_at IS NULL OR playlists_synced_at <= ${before})
      RETURNING id`;
    if (claimed.length === 0) {
      if (mode === 'auto') return skipped();
      const state = await this.state(groupId, userId, now);
      throw new HttpException(
        {
          code: PlaylistErrorCode.PLAYLIST_SYNC_TOO_SOON,
          message: 'Déjà synchronisé il y a moins de 15 minutes',
          retryAt: state.nextManualSyncAt,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const report = await this.run(groupId, now);
    return {
      synced: true,
      ...report,
      state: await this.state(groupId, userId),
    };
  }

  /** Lit les playlists du groupe et ajoute les nouvelles vidéos qui ont une place. */
  private async run(groupId: string, now: Date): Promise<RunReport> {
    const playlists = await this.prisma.groupPlaylist.findMany({
      where: { groupId },
      orderBy: [{ linkedAt: 'asc' }, { userId: 'asc' }],
    });

    const lists: Candidate[][] = [];
    try {
      for (const playlist of playlists) {
        const entries = await this.read(playlist);
        if (!entries) continue;
        lists.push(
          entries
            .filter(
              (e) =>
                !playlist.importFrom ||
                (e.addedAt !== null && e.addedAt >= playlist.importFrom),
            )
            .map((e) => ({ videoId: e.videoId, ownerId: playlist.userId })),
        );
      }
    } catch (error) {
      if (!(error instanceof QuotaStop)) throw error;
      // Quota épuisé en cours de lecture : on ajoute ce qu'on a déjà lu.
    }

    let candidates = interleave(lists);
    if (candidates.length > 0) {
      const already = await this.prisma.groupTitle.findMany({
        where: {
          groupId,
          mediaItem: {
            source: MediaSourceType.YOUTUBE,
            externalId: { in: candidates.map((c) => c.videoId) },
          },
        },
        select: { mediaItem: { select: { externalId: true } } },
      });
      const known = new Set(already.map((t) => t.mediaItem.externalId));
      candidates = candidates.filter((c) => !known.has(c.videoId));
    }

    const room = await this.room(this.prisma, groupId);
    const accepted: { candidate: Candidate; mediaItemId: string }[] = [];
    let cursor = 0;
    while (accepted.length < room && cursor < candidates.length) {
      const batch = candidates.slice(
        cursor,
        cursor + Math.min(PAGE_SIZE, room - accepted.length),
      );
      const items = await this.mediaItems(
        groupId,
        batch.map((c) => c.videoId),
        now,
      );
      if (!items) break; // YouTube injoignable ou quota : ce sera pour la prochaine fois.
      cursor += batch.length;
      for (const candidate of batch) {
        const id = items.get(candidate.videoId);
        // Absente : vidéo privée ou supprimée, ignorée.
        if (id) accepted.push({ candidate, mediaItemId: id });
      }
    }

    const added = await this.prisma.$transaction(async (tx) => {
      if (!(await lockGroup(tx, groupId))) return 0;
      // Revu sous verrou : un ajout a pu prendre une place entre-temps.
      const slots = Math.min(accepted.length, await this.room(tx, groupId));
      if (slots <= 0) return 0;
      const owners = new Set(
        (
          await tx.groupMember.findMany({
            where: { groupId },
            select: { userId: true },
          })
        ).map((m) => m.userId),
      );
      const { count } = await tx.groupTitle.createMany({
        data: accepted.slice(0, slots).map(({ candidate, mediaItemId }, i) => ({
          groupId,
          mediaItemId,
          addedById: owners.has(candidate.ownerId) ? candidate.ownerId : null,
          // Dans l'ordre de la playlist : la première vidéo en tête de liste.
          addedAt: new Date(now.getTime() - i),
        })),
        skipDuplicates: true,
      });
      return count;
    });

    const waiting = candidates.length - cursor + (accepted.length - added);
    await this.prisma.group.updateMany({
      where: { id: groupId },
      data: { playlistsWaiting: Math.max(0, waiting) },
    });
    return { added, waiting: Math.max(0, waiting) };
  }

  /** Places libres : sous les 50 titres en cours et les 2 000 titres au total. */
  private async room(
    db: Parameters<typeof countActiveTitles>[0],
    groupId: string,
  ): Promise<number> {
    const active = await countActiveTitles(db, groupId);
    const total = await db.groupTitle.count({ where: { groupId } });
    return Math.max(
      0,
      Math.min(GROUP_MAX_ACTIVE_TITLES - active, GROUP_MAX_TITLES - total),
    );
  }

  /**
   * Vidéos de la playlist, dans son ordre (PLAYLIST_MAX_ITEMS_READ au plus).
   * Null si elle n'a pas pu être lue (introuvable : signalé au propriétaire).
   */
  private async read(playlist: GroupPlaylist): Promise<PlaylistEntry[] | null> {
    const entries: PlaylistEntry[] = [];
    let token: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      if (!(await this.quota.tryConsume(playlist.groupId))) {
        throw new QuotaStop();
      }
      const result = await this.youtube.page(playlist.playlistId, token);
      if (typeof result === 'string') {
        await this.failed(playlist, result);
        return page === 0 ? null : entries;
      }
      entries.push(...result.entries);
      if (!result.next) break;
      token = result.next;
    }
    if (playlist.error) {
      await this.prisma.groupPlaylist.updateMany({
        where: { groupId: playlist.groupId, userId: playlist.userId },
        data: { error: null },
      });
    }
    return entries;
  }

  private async failed(playlist: GroupPlaylist, failure: Failure) {
    if (failure === 'quota') {
      await this.quota.exhaust();
      throw new QuotaStop();
    }
    if (failure === 'not-found') {
      await this.prisma.groupPlaylist.updateMany({
        where: { groupId: playlist.groupId, userId: playlist.userId },
        data: { error: 'NOT_FOUND' },
      });
    }
  }

  /**
   * Entrées du cache `media_items` de ces vidéos (id YouTube → id en base),
   * demandées en un appel à YouTube pour celles qui n'y sont pas ou plus
   * fraîches (règle des 30 jours). Null si YouTube n'a pas pu répondre.
   */
  private async mediaItems(
    groupId: string,
    videoIds: string[],
    now: Date,
  ): Promise<Map<string, string> | null> {
    const fresh = await this.prisma.mediaItem.findMany({
      where: {
        source: MediaSourceType.YOUTUBE,
        externalId: { in: videoIds },
        fetchedAt: { gt: new Date(now.getTime() - MEDIA_CACHE_MAX_AGE_MS) },
      },
      select: { id: true, externalId: true },
    });
    const ids = new Map(fresh.map((m) => [m.externalId, m.id]));
    const missing = videoIds.filter((id) => !ids.has(id));
    if (missing.length === 0) return ids;

    if (!(await this.quota.tryConsume(groupId))) return null;
    const details = await this.youtube.videos(missing);
    if (typeof details === 'string') {
      if (details === 'quota') await this.quota.exhaust();
      return null;
    }
    for (const video of details) {
      const data = {
        url: youTubeWatchUrl(video.videoId),
        title: video.title,
        thumbnailUrl: youTubeThumbnailUrl(video.videoId),
        author: video.author,
        durationSec: video.durationSec,
        fetchedAt: new Date(),
      };
      const item = await this.prisma.mediaItem.upsert({
        where: {
          source_externalId: {
            source: MediaSourceType.YOUTUBE,
            externalId: video.videoId,
          },
        },
        create: {
          source: MediaSourceType.YOUTUBE,
          externalId: video.videoId,
          ...data,
        },
        update: data,
        select: { id: true },
      });
      ids.set(video.videoId, item.id);
    }
    return ids;
  }
}
