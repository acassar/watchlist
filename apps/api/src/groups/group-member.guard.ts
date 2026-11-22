import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GroupErrorCode, GroupRole } from '@watchlist/shared';
import type { AuthenticatedRequest } from '../auth/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Appartenance de l'utilisateur connecté au groupe de la route. */
export interface Membership {
  groupId: string;
  userId: string;
  role: GroupRole;
}

type MemberRequest = AuthenticatedRequest & { membership?: Membership };

const OWNER_ONLY_KEY = 'groupOwnerOnly';

/** Réserve la route au propriétaire du groupe (403 OWNER_ONLY sinon). */
export const OwnerOnly = () => SetMetadata(OWNER_ONLY_KEY, true);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function groupNotFound() {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: 'Groupe introuvable',
  });
}

/**
 * Guard « membre du groupe » : la route doit avoir un paramètre `:groupId`.
 * Un non-membre reçoit 404, comme pour un groupe qui n'existe pas : on ne
 * révèle pas l'existence des groupes des autres. Réutilisé par les titres et
 * les statuts (étapes 5 et 6).
 */
@Injectable()
export class GroupMemberGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<MemberRequest>();
    const groupId = request.params.groupId;
    const userId = request.user?.id;
    if (typeof groupId !== 'string' || !UUID.test(groupId) || !userId) {
      throw groupNotFound();
    }

    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { role: true },
    });
    if (!member) throw groupNotFound();

    const ownerOnly = this.reflector.getAllAndOverride<boolean>(
      OWNER_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (ownerOnly && member.role !== GroupRole.OWNER) {
      throw new ForbiddenException({
        code: GroupErrorCode.OWNER_ONLY,
        message: 'Réservé au propriétaire du groupe',
      });
    }

    request.membership = { groupId, userId, role: member.role };
    return true;
  }
}

/** Injecte l'appartenance vérifiée par GroupMemberGuard. */
export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Membership => {
    const request = ctx.switchToHttp().getRequest<MemberRequest>();
    if (!request.membership)
      throw new Error('CurrentMembership utilisé sans GroupMemberGuard');
    return request.membership;
  },
);
