import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GroupErrorCode,
  GroupRole,
  type GroupDetail,
  type GroupSummary,
} from '@watchlist/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { groupNotFound } from './group-member.guard.js';

export type Tx = Prisma.TransactionClient;

/**
 * Verrouille la ligne du groupe jusqu'à la fin de la transaction : toutes les
 * modifications d'appartenance d'un même groupe passent l'une après l'autre
 * (limite de membres, passation de propriété, dernier qui part).
 * Renvoie false si le groupe n'existe plus.
 */
export async function lockGroup(tx: Tx, groupId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM groups WHERE id = ${groupId}::uuid FOR UPDATE`;
  return rows.length > 0;
}

export function ownerOnly() {
  return new ForbiddenException({
    code: GroupErrorCode.OWNER_ONLY,
    message: 'Réservé au propriétaire du groupe',
  });
}

const memberCount = { _count: { select: { members: true } } } as const;

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Mes groupes, par ordre alphabétique. */
  async list(userId: string): Promise<GroupSummary[]> {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId },
      include: { group: { include: memberCount } },
    });
    return memberships
      .map(({ group, role }) => ({
        id: group.id,
        name: group.name,
        role,
        memberCount: group._count.members,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }

  /** Crée un groupe dont l'utilisateur est le propriétaire (et, pour l'instant, le seul membre). */
  async create(userId: string, name: string): Promise<GroupDetail> {
    const group = await this.prisma.group.create({
      data: { name, members: { create: { userId, role: GroupRole.OWNER } } },
    });
    return this.detail(group.id, userId);
  }

  async detail(groupId: string, userId: string): Promise<GroupDetail> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: { user: { select: { displayName: true } } },
          orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
        },
      },
    });
    const me = group?.members.find((m) => m.userId === userId);
    if (!group || !me) throw groupNotFound();

    const members = group.members
      .map((m) => ({
        userId: m.userId,
        displayName: m.user.displayName,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      }))
      // Propriétaire d'abord (tri stable : le reste garde l'ordre d'arrivée).
      .sort(
        (a, b) =>
          Number(b.role === GroupRole.OWNER) -
          Number(a.role === GroupRole.OWNER),
      );

    return {
      id: group.id,
      name: group.name,
      role: me.role,
      memberCount: members.length,
      createdAt: group.createdAt.toISOString(),
      members,
    };
  }

  async rename(groupId: string, userId: string, name: string) {
    await this.prisma.group.update({ where: { id: groupId }, data: { name } });
    return this.detail(groupId, userId);
  }

  /**
   * Quitter un groupe. Le dernier membre qui part supprime le groupe ; un
   * propriétaire qui part passe la main au membre arrivé le plus tôt.
   */
  async leave(groupId: string, userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (!(await lockGroup(tx, groupId))) throw groupNotFound();
      const members = await tx.groupMember.findMany({
        where: { groupId },
        orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
      });
      const me = members.find((m) => m.userId === userId);
      if (!me) throw groupNotFound();

      const others = members.filter((m) => m.userId !== userId);
      if (others.length === 0) {
        // Cascade : membres, invitations (et plus tard titres et statuts).
        await tx.group.delete({ where: { id: groupId } });
        return;
      }
      if (me.role === GroupRole.OWNER) {
        await tx.groupMember.update({
          where: { groupId_userId: { groupId, userId: others[0].userId } },
          data: { role: GroupRole.OWNER },
        });
      }
      await this.detachMember(tx, groupId, userId);
    });
  }

  /** Le propriétaire retire un membre du groupe. */
  async removeMember(
    groupId: string,
    ownerId: string,
    targetId: string,
  ): Promise<void> {
    if (targetId === ownerId) {
      throw new BadRequestException({
        code: GroupErrorCode.CANNOT_REMOVE_SELF,
        message: 'Pour partir, quittez le groupe',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      if (!(await lockGroup(tx, groupId))) throw groupNotFound();
      // Le guard a vérifié le rôle avant le verrou : relu ici, car le
      // propriétaire a pu partir entre-temps (sur un autre appareil) et passer
      // la main justement au membre visé. Sans ça, le groupe resterait sans
      // propriétaire.
      const actor = await tx.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: ownerId } },
      });
      if (!actor) throw groupNotFound();
      if (actor.role !== GroupRole.OWNER) throw ownerOnly();
      const target = await tx.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: targetId } },
      });
      if (!target) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Ce membre ne fait pas partie du groupe',
        });
      }
      await this.detachMember(tx, groupId, targetId);
    });
  }

  /**
   * Ce qui arrive à un membre qui part (de lui-même ou retiré) :
   * - son appartenance disparaît ;
   * - ses invitations encore actives sont révoquées (il ne fait plus partie du groupe) ;
   * - à partir de l'étape 6 : ses statuts sont supprimés, ses titres restent
   *   avec l'auteur « ancien membre ».
   */
  private async detachMember(tx: Tx, groupId: string, userId: string) {
    await tx.invitation.updateMany({
      where: { groupId, createdById: userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.groupMember.delete({
      where: { groupId_userId: { groupId, userId } },
    });
  }
}
