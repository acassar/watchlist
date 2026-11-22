import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Identité portée par le JWT d'accès. */
export interface AuthenticatedUser {
  id: string;
}

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

/** Injecte l'utilisateur connecté (posé par JwtAuthGuard). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user)
      throw new Error('CurrentUser utilisé sur une route publique');
    return request.user;
  },
);
