import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config.js';
import { MEDIA_SOURCES, type MediaSource } from './media-source.js';
import { MediaSourceRegistry } from './media-source.registry.js';
import { MediaThrottlerGuard } from './media-throttler.guard.js';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import { YouTubeSource } from './youtube/youtube.source.js';

@Module({
  controllers: [MediaController],
  providers: [
    {
      provide: YouTubeSource,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new YouTubeSource(config.get('YOUTUBE_API_KEY')),
    },
    {
      // Nouvelle source (TMDB, saisie libre…) : l'ajouter à cette liste.
      provide: MEDIA_SOURCES,
      inject: [YouTubeSource],
      useFactory: (youtube: YouTubeSource): MediaSource[] => [youtube],
    },
    MediaSourceRegistry,
    MediaService,
    MediaThrottlerGuard,
  ],
  exports: [MediaService, MediaThrottlerGuard],
})
export class MediaModule {}
