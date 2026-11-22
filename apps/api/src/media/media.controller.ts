import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { resolveMediaRequestSchema, type MediaInfo } from '@watchlist/shared';
import type { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { MediaThrottlerGuard } from './media-throttler.guard.js';
import { MediaService, toMediaInfo } from './media.service.js';

type ResolveQuery = z.output<typeof resolveMediaRequestSchema>;

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /** Aperçu d'un lien avant de l'ajouter (connexion requise, débit limité). */
  @Get('resolve')
  @UseGuards(MediaThrottlerGuard)
  async resolve(
    @Query(new ZodValidationPipe(resolveMediaRequestSchema))
    query: ResolveQuery,
  ): Promise<MediaInfo> {
    return toMediaInfo(await this.media.resolve(query.url));
  }
}
