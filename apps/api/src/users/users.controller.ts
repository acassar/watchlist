import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  deleteAccountRequestSchema,
  updateLocaleRequestSchema,
  type AccountExport,
  type AuthUser,
  type DeleteAccountRequest,
  type UpdateLocaleRequest,
} from '@watchlist/shared';
import type { Response } from 'express';
import { toAuthUser } from '../auth/auth.service.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/current-user.decorator.js';
import { clearRefreshCookie } from '../auth/refresh-cookie.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { Env } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccountService, accountNotFound } from './account.service.js';

@Controller('me')
export class UsersController {
  private readonly secureCookie: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly account: AccountService,
    config: ConfigService<Env, true>,
  ) {
    this.secureCookie = config.get('COOKIE_SECURE');
  }

  /** Profil de l'utilisateur connecté. */
  @Get()
  async me(@CurrentUser() current: AuthenticatedUser): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: current.id },
    });
    if (!user) throw accountNotFound();
    return toAuthUser(user);
  }

  /** Langue de l'interface et des emails. */
  @Patch('locale')
  async updateLocale(
    @CurrentUser() current: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateLocaleRequestSchema))
    body: UpdateLocaleRequest,
  ): Promise<AuthUser> {
    const { count } = await this.prisma.user.updateMany({
      where: { id: current.id },
      data: { locale: body.locale },
    });
    if (count === 0) throw accountNotFound();
    return this.me(current);
  }

  /** Export RGPD : un fichier JSON téléchargé tel quel. */
  @Get('export')
  @Header('Content-Disposition', 'attachment; filename="canapact-export.json"')
  @Header('Cache-Control', 'no-store')
  export(@CurrentUser() current: AuthenticatedUser): Promise<AccountExport> {
    return this.account.export(current.id);
  }

  /**
   * Suppression du compte. Limitée en débit par IP comme la connexion : elle
   * vérifie un mot de passe.
   */
  @Post('delete')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() current: AuthenticatedUser,
    @Body(new ZodValidationPipe(deleteAccountRequestSchema))
    body: DeleteAccountRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.account.delete(current, body);
    clearRefreshCookie(res, this.secureCookie);
  }
}
