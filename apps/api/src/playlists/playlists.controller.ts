import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  linkPlaylistRequestSchema,
  syncPlaylistsRequestSchema,
  type GroupPlaylists,
  type PlaylistSyncResult,
} from '@watchlist/shared';
import type { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  CurrentMembership,
  GroupMemberGuard,
  type Membership,
} from '../groups/group-member.guard.js';
import { MediaThrottlerGuard } from '../media/media-throttler.guard.js';
import { PlaylistsService } from './playlists.service.js';

type LinkBody = z.output<typeof linkPlaylistRequestSchema>;
type SyncBody = z.output<typeof syncPlaylistsRequestSchema>;

@Controller('groups/:groupId/playlists')
@UseGuards(GroupMemberGuard)
export class PlaylistsController {
  constructor(private readonly playlists: PlaylistsService) {}

  /** Ma playlist dans ce groupe, et l'état de la synchro du groupe. */
  @Get()
  state(@CurrentMembership() m: Membership): Promise<GroupPlaylists> {
    return this.playlists.state(m.groupId, m.userId);
  }

  /** Lie (ou remplace) ma playlist, puis synchronise. Une par membre et par groupe. */
  @Put('mine')
  @UseGuards(MediaThrottlerGuard)
  link(
    @CurrentMembership() m: Membership,
    @Body(new ZodValidationPipe(linkPlaylistRequestSchema)) body: LinkBody,
  ): Promise<PlaylistSyncResult> {
    return this.playlists.link(
      m.groupId,
      m.userId,
      body.url,
      body.importExisting,
    );
  }

  /** Délie ma playlist (les titres déjà ajoutés restent). */
  @Delete('mine')
  unlink(@CurrentMembership() m: Membership): Promise<GroupPlaylists> {
    return this.playlists.unlink(m.groupId, m.userId);
  }

  /** Synchronise les playlists de tous les membres (auto : 4 h, bouton : 15 min). */
  @Post('sync')
  @HttpCode(200)
  @UseGuards(MediaThrottlerGuard)
  sync(
    @CurrentMembership() m: Membership,
    @Body(new ZodValidationPipe(syncPlaylistsRequestSchema)) body: SyncBody,
  ): Promise<PlaylistSyncResult> {
    return this.playlists.sync(m.groupId, m.userId, body.mode);
  }
}
