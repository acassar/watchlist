import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { addTitleRequestSchema, type GroupTitle } from '@watchlist/shared';
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

@Controller('groups/:groupId/titles')
@UseGuards(GroupMemberGuard)
export class TitlesController {
  constructor(private readonly titles: TitlesService) {}

  @Get()
  list(@CurrentMembership() m: Membership): Promise<GroupTitle[]> {
    return this.titles.list(m.groupId, m.userId);
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
}
