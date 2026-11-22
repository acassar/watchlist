import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createInvitationRequestSchema,
  groupRequestSchema,
  type CreatedInvitation,
  type GroupDetail,
  type GroupRequest,
  type GroupSummary,
  type Invitation,
} from '@watchlist/shared';
import type { z } from 'zod';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  CurrentMembership,
  GroupMemberGuard,
  OwnerOnly,
  type Membership,
} from './group-member.guard.js';
import { GroupsService } from './groups.service.js';
import { InvitationsService } from './invitations.service.js';

type CreateInvitationBody = z.output<typeof createInvitationRequestSchema>;

/** 404 plutôt que 400 sur un identifiant mal formé : il ne désigne rien. */
const uuid = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND });

@Controller('groups')
export class GroupsController {
  constructor(
    private readonly groups: GroupsService,
    private readonly invitations: InvitationsService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<GroupSummary[]> {
    return this.groups.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(groupRequestSchema)) body: GroupRequest,
  ): Promise<GroupDetail> {
    return this.groups.create(user.id, body.name);
  }

  @Get(':groupId')
  @UseGuards(GroupMemberGuard)
  detail(@CurrentMembership() m: Membership): Promise<GroupDetail> {
    return this.groups.detail(m.groupId, m.userId);
  }

  @Patch(':groupId')
  @UseGuards(GroupMemberGuard)
  @OwnerOnly()
  rename(
    @CurrentMembership() m: Membership,
    @Body(new ZodValidationPipe(groupRequestSchema)) body: GroupRequest,
  ): Promise<GroupDetail> {
    return this.groups.rename(m.groupId, m.userId, body.name);
  }

  @Post(':groupId/leave')
  @UseGuards(GroupMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  leave(@CurrentMembership() m: Membership): Promise<void> {
    return this.groups.leave(m.groupId, m.userId);
  }

  @Delete(':groupId/members/:userId')
  @UseGuards(GroupMemberGuard)
  @OwnerOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @CurrentMembership() m: Membership,
    @Param('userId', uuid) userId: string,
  ): Promise<void> {
    return this.groups.removeMember(m.groupId, m.userId, userId);
  }

  @Get(':groupId/invitations')
  @UseGuards(GroupMemberGuard)
  listInvitations(@CurrentMembership() m: Membership): Promise<Invitation[]> {
    return this.invitations.list(m.groupId);
  }

  /** Tout membre peut inviter : c'est un groupe d'amis, pas une organisation. */
  @Post(':groupId/invitations')
  @UseGuards(GroupMemberGuard)
  createInvitation(
    @CurrentMembership() m: Membership,
    @Body(new ZodValidationPipe(createInvitationRequestSchema))
    body: CreateInvitationBody,
  ): Promise<CreatedInvitation> {
    return this.invitations.create(m, body);
  }

  @Delete(':groupId/invitations/:invitationId')
  @UseGuards(GroupMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeInvitation(
    @CurrentMembership() m: Membership,
    @Param('invitationId', uuid) invitationId: string,
  ): Promise<void> {
    return this.invitations.revoke(m, invitationId);
  }
}
