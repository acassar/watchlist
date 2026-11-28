import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  changeEmailRequestSchema,
  changePasswordRequestSchema,
  resetPasswordRequestSchema,
  tokenRequestSchema,
  type ChangeEmailRequest,
  type ChangePasswordRequest,
  type ResetPasswordRequest,
  type TokenRequest,
} from '@watchlist/shared';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CredentialsService } from './credentials.service.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from './current-user.decorator.js';
import { Public } from './public.decorator.js';
import { readRefreshCookie } from './refresh-cookie.js';

/**
 * Mot de passe et adresse depuis les réglages. Sous /auth pour recevoir le
 * cookie de session (limité à ce chemin) : l'appareil qui change le mot de
 * passe reste connecté. Limité en débit par IP : le mot de passe est redemandé.
 */
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class CredentialsController {
  constructor(private readonly credentials: CredentialsService) {}

  @Post('password/change')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() current: AuthenticatedUser,
    @Body(new ZodValidationPipe(changePasswordRequestSchema))
    body: ChangePasswordRequest,
    @Req() req: Request,
  ): Promise<void> {
    await this.credentials.changePassword(
      current.id,
      body,
      readRefreshCookie(req),
    );
  }

  @Post('email/change')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestEmailChange(
    @CurrentUser() current: AuthenticatedUser,
    @Body(new ZodValidationPipe(changeEmailRequestSchema))
    body: ChangeEmailRequest,
  ): Promise<void> {
    await this.credentials.requestEmailChange(current.id, body);
  }

  /** Lien reçu à la nouvelle adresse : ouvert sur n'importe quel appareil. */
  @Public()
  @Post('email/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmEmailChange(
    @Body(new ZodValidationPipe(tokenRequestSchema)) body: TokenRequest,
  ): Promise<void> {
    await this.credentials.confirmEmailChange(body.token);
  }

  /** « Ce n'est pas moi », depuis l'ancienne adresse. */
  @Public()
  @Post('email/revert')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revertEmailChange(
    @Body(new ZodValidationPipe(resetPasswordRequestSchema))
    body: ResetPasswordRequest,
  ): Promise<void> {
    await this.credentials.revertEmailChange(body);
  }
}
