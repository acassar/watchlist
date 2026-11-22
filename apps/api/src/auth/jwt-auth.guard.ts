import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthErrorCode } from '@watchlist/shared';
import type { AuthenticatedRequest } from './current-user.decorator.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

/**
 * Guard global : exige un JWT d'accès valide (`Authorization: Bearer …`)
 * sauf sur les routes marquées @Public().
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw unauthenticated();

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      request.user = { id: payload.sub };
      return true;
    } catch {
      throw unauthenticated();
    }
  }
}

function unauthenticated() {
  return new UnauthorizedException({
    code: AuthErrorCode.UNAUTHENTICATED,
    message: 'Connexion requise',
  });
}
