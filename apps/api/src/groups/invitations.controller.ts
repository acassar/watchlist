import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  invitationRequestSchema,
  type GroupSummary,
  type InvitationPreview,
} from '@watchlist/shared';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  InvitationsService,
  type InvitationLookup,
} from './invitations.service.js';

/**
 * Côté invité. Connexion requise ; limité en débit (AUTH_RATE_LIMIT par minute
 * et par IP) pour qu'on ne puisse pas essayer des codes au hasard.
 * Le jeton voyage dans le corps (POST), jamais dans l'URL.
 */
@UseGuards(ThrottlerGuard)
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(invitationRequestSchema))
    body: InvitationLookup,
  ): Promise<InvitationPreview> {
    return this.invitations.preview(user.id, body);
  }

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(invitationRequestSchema))
    body: InvitationLookup,
  ): Promise<GroupSummary> {
    return this.invitations.accept(user.id, body);
  }
}
