import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  addTitleRequestSchema,
  setStatusRequestSchema,
  watchedTogetherRequestSchema,
  type GroupTitle,
} from '@watchlist/shared';
import type { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  CurrentMembership,
  GroupMemberGuard,
  type Membership,
} from '../groups/group-member.guard.js';
import { MediaThrottlerGuard } from '../media/media-throttler.guard.js';
import { TitlesService } from './titles.service.js';

type AddTitleBody = z.output<typeof addTitleRequestSchema>;
type SetStatusBody = z.output<typeof setStatusRequestSchema>;
// Sans corps de requête : maintenant.
const watchedTogetherBodySchema = watchedTogetherRequestSchema.optional();
type WatchedTogetherBody = z.output<typeof watchedTogetherBodySchema>;

@Controller('groups/:groupId/titles')
@UseGuards(GroupMemberGuard)
export class TitlesController {
  constructor(private readonly titles: TitlesService) {}

  /** Mes listes actives ; chaque titre dit dans quelle vue il se range. */
  @Get()
  list(@CurrentMembership() m: Membership): Promise<GroupTitle[]> {
    return this.titles.list(m.groupId, m.userId);
  }

  /** Vus ensemble, archivés, vus seul, pas pour moi. */
  @Get('history')
  history(@CurrentMembership() m: Membership): Promise<GroupTitle[]> {
    return this.titles.history(m.groupId, m.userId);
  }

  /** N'importe quel membre peut ajouter. Débit limité : résout le lien chez YouTube. */
  @Post()
  @UseGuards(MediaThrottlerGuard)
  add(
    @CurrentMembership() m: Membership,
    @Body(new ZodValidationPipe(addTitleRequestSchema)) body: AddTitleBody,
  ): Promise<GroupTitle> {
    return this.titles.add(m.groupId, m.userId, body.url, body.status);
  }

  @Put(':titleId/status')
  setStatus(
    @CurrentMembership() m: Membership,
    @Param('titleId') titleId: string,
    @Body(new ZodValidationPipe(setStatusRequestSchema)) body: SetStatusBody,
  ): Promise<GroupTitle> {
    return this.titles.setStatus(m.groupId, m.userId, titleId, body.status);
  }

  @Put(':titleId/watched-alone')
  watchedAlone(
    @CurrentMembership() m: Membership,
    @Param('titleId') titleId: string,
  ): Promise<GroupTitle> {
    return this.titles.setWatchedAlone(m.groupId, m.userId, titleId, true);
  }

  @Delete(':titleId/watched-alone')
  unwatchedAlone(
    @CurrentMembership() m: Membership,
    @Param('titleId') titleId: string,
  ): Promise<GroupTitle> {
    return this.titles.setWatchedAlone(m.groupId, m.userId, titleId, false);
  }

  @Put(':titleId/watched-together')
  watchedTogether(
    @CurrentMembership() m: Membership,
    @Param('titleId') titleId: string,
    @Body(new ZodValidationPipe(watchedTogetherBodySchema))
    body: WatchedTogetherBody,
  ): Promise<GroupTitle> {
    return this.titles.setWatchedTogether(
      m.groupId,
      m.userId,
      titleId,
      body?.watchedAt ? new Date(body.watchedAt) : new Date(),
    );
  }

  @Delete(':titleId/watched-together')
  unwatchedTogether(
    @CurrentMembership() m: Membership,
    @Param('titleId') titleId: string,
  ): Promise<GroupTitle> {
    return this.titles.setWatchedTogether(m.groupId, m.userId, titleId, null);
  }
}
