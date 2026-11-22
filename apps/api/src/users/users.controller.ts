import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import { AuthErrorCode, type AuthUser } from '@watchlist/shared';
import { toAuthUser } from '../auth/auth.service.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('me')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /** Profil de l'utilisateur connecté. */
  @Get()
  async me(@CurrentUser() current: AuthenticatedUser): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: current.id },
    });
    if (!user) {
      // JWT encore valide mais compte supprimé entre-temps.
      throw new UnauthorizedException({
        code: AuthErrorCode.UNAUTHENTICATED,
        message: 'Compte introuvable',
      });
    }
    return toAuthUser(user);
  }
}
