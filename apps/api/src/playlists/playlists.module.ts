import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config.js';
import { GroupsModule } from '../groups/groups.module.js';
import { MediaModule } from '../media/media.module.js';
import { PlaylistsController } from './playlists.controller.js';
import { PlaylistsService } from './playlists.service.js';
import { YouTubePlaylistClient } from './youtube-playlist.client.js';
import { YouTubeQuotaService } from './youtube-quota.service.js';

@Module({
  imports: [GroupsModule, MediaModule],
  controllers: [PlaylistsController],
  providers: [
    {
      provide: YouTubePlaylistClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new YouTubePlaylistClient(config.get('YOUTUBE_API_KEY')),
    },
    YouTubeQuotaService,
    PlaylistsService,
  ],
})
export class PlaylistsModule {}
