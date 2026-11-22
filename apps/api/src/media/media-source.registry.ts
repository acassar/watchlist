import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { TitleErrorCode, type MediaSourceType } from '@watchlist/shared';
import { MEDIA_SOURCES, type MediaSource } from './media-source.js';

/** Trouve la source qui sait lire une URL, parmi celles enregistrées. */
@Injectable()
export class MediaSourceRegistry {
  constructor(
    @Inject(MEDIA_SOURCES) private readonly sources: readonly MediaSource[],
  ) {}

  /** Lève 400 UNSUPPORTED_URL si aucune source ne reconnaît le lien. */
  find(url: string): MediaSource {
    const source = this.sources.find((s) => s.canHandle(url));
    if (!source) {
      throw new BadRequestException({
        code: TitleErrorCode.UNSUPPORTED_URL,
        message: 'Lien non pris en charge',
      });
    }
    return source;
  }

  /** La source d'un type donné (null si elle n'est plus active). */
  byType(type: MediaSourceType): MediaSource | null {
    return this.sources.find((s) => s.type === type) ?? null;
  }
}
