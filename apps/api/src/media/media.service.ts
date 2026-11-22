import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TitleErrorCode, type MediaInfo } from '@watchlist/shared';
import type { MediaItem } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MediaNotFoundError, MediaUnavailableError } from './media-source.js';
import { MediaSourceRegistry } from './media-source.registry.js';

/**
 * Les règles de l'API YouTube interdisent de garder ses données plus de
 * 30 jours sans les rafraîchir : au-delà, on redemande avant de resservir.
 */
export const MEDIA_CACHE_MAX_AGE_MS = 30 * 24 * 3600 * 1000;

export function toMediaInfo(item: MediaItem): MediaInfo {
  return {
    source: item.source,
    externalId: item.externalId,
    url: item.url,
    title: item.title,
    thumbnailUrl: item.thumbnailUrl,
    author: item.author,
    durationSec: item.durationSec,
  };
}

/**
 * Résout une URL en titre, avec le cache partagé `media_items` : une vidéo
 * ajoutée par plusieurs groupes (ou prévisualisée puis ajoutée) n'est
 * demandée qu'une fois au service.
 */
@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: MediaSourceRegistry,
  ) {}

  async resolve(url: string): Promise<MediaItem> {
    const source = this.registry.find(url);
    const externalId = source.extractId(url)!;
    const cached = await this.prisma.mediaItem.findUnique({
      where: { source_externalId: { source: source.type, externalId } },
    });
    if (
      cached &&
      Date.now() - cached.fetchedAt.getTime() < MEDIA_CACHE_MAX_AGE_MS
    ) {
      return cached;
    }

    let info: MediaInfo;
    try {
      info = await source.resolve(url);
    } catch (error) {
      if (error instanceof MediaNotFoundError) {
        throw new NotFoundException({
          code: TitleErrorCode.MEDIA_NOT_FOUND,
          message: 'Titre introuvable ou privé',
        });
      }
      if (error instanceof MediaUnavailableError) {
        throw new BadGatewayException({
          code: TitleErrorCode.MEDIA_UNAVAILABLE,
          message: 'Le service ne répond pas, réessayez plus tard',
        });
      }
      throw error;
    }

    const data = {
      url: info.url,
      title: info.title,
      thumbnailUrl: info.thumbnailUrl,
      author: info.author,
      durationSec: info.durationSec,
      fetchedAt: new Date(),
    };
    // Upsert natif (INSERT … ON CONFLICT) : deux ajouts simultanés de la même vidéo ne se gênent pas.
    return this.prisma.mediaItem.upsert({
      where: { source_externalId: { source: info.source, externalId } },
      create: { source: info.source, externalId, ...data },
      update: data,
    });
  }
}
