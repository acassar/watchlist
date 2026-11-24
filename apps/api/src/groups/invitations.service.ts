import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GROUP_MAX_ACTIVE_INVITATIONS,
  GROUP_MAX_MEMBERS,
  GroupErrorCode,
  GroupRole,
  invitationRequestSchema,
  type CreatedInvitation,
  type GroupSummary,
  type Invitation,
  type InvitationPreview,
} from '@watchlist/shared';
import type { z } from 'zod';
import { isUniqueViolation } from '../auth/auth.service.js';
import { generateToken, hashToken } from '../auth/tokens.js';
import type { Env } from '../config.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { groupNotFound, type Membership } from './group-member.guard.js';
import { assertGroupRoom, lockGroup } from './groups.service.js';
import { generateInvitationCode } from './invitation-code.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Corps de requête déjà validé : jeton du lien OU code (normalisé). */
export type InvitationLookup = z.output<typeof invitationRequestSchema>;

const withAuthor = {
  createdBy: { select: { id: true, displayName: true } },
} as const;
type InvitationRow = Prisma.InvitationGetPayload<{
  include: typeof withAuthor;
}>;

function invitationInvalid() {
  return new NotFoundException({
    code: GroupErrorCode.INVITATION_INVALID,
    message: 'Invitation invalide, expirée ou révoquée',
  });
}

/** Conditions SQL d'une invitation encore utilisable (hors limite d'utilisations). */
function activeWhere(now: Date) {
  return { revokedAt: null, expiresAt: { gt: now } } as const;
}

function isUsable(invitation: InvitationRow, now = new Date()): boolean {
  return (
    invitation.revokedAt === null &&
    invitation.expiresAt > now &&
    (invitation.maxUses === null || invitation.uses < invitation.maxUses)
  );
}

function toInvitation(row: InvitationRow): Invitation {
  return {
    id: row.id,
    code: row.code,
    expiresAt: row.expiresAt.toISOString(),
    uses: row.uses,
    maxUses: row.maxUses,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy
      ? { userId: row.createdBy.id, displayName: row.createdBy.displayName }
      : null,
  };
}

@Injectable()
export class InvitationsService {
  private readonly appUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.appUrl = config.get('APP_URL');
  }

  /** Invitations encore utilisables du groupe, les plus récentes d'abord. */
  async list(groupId: string): Promise<Invitation[]> {
    const rows = await this.prisma.invitation.findMany({
      where: { groupId, ...activeWhere(new Date()) },
      include: withAuthor,
      orderBy: { createdAt: 'desc' },
    });
    return rows.filter((row) => isUsable(row)).map(toInvitation);
  }

  async create(
    membership: Membership,
    options: { expiresInDays: number; maxUses: number | null },
  ): Promise<CreatedInvitation> {
    const { groupId, userId } = membership;
    const token = generateToken();
    const expiresAt = new Date(Date.now() + options.expiresInDays * DAY_MS);
    // Collision de code très improbable (31^8 combinaisons) : on retente quand même.
    for (let attempt = 0; ; attempt++) {
      try {
        const row = await this.prisma.$transaction(async (tx) => {
          // Sous le verrou du groupe : la limite d'invitations tient même avec
          // des créations simultanées, et un membre qui part en même temps ne
          // laisse pas derrière lui une invitation active (detachMember a déjà
          // révoqué les siennes, et l'appartenance est relue ici).
          if (!(await lockGroup(tx, groupId))) throw groupNotFound();
          const member = await tx.groupMember.findUnique({
            where: { groupId_userId: { groupId, userId } },
          });
          if (!member) throw groupNotFound();

          const now = new Date();
          const active = await tx.invitation.findMany({
            where: { groupId, ...activeWhere(now) },
            select: { uses: true, maxUses: true },
          });
          const usable = active.filter(
            (i) => i.maxUses === null || i.uses < i.maxUses,
          );
          if (usable.length >= GROUP_MAX_ACTIVE_INVITATIONS) {
            throw new ConflictException({
              code: GroupErrorCode.TOO_MANY_INVITATIONS,
              message: "Trop d'invitations en cours : révoquez-en une",
            });
          }

          return tx.invitation.create({
            data: {
              groupId,
              createdById: userId,
              tokenHash: hashToken(token),
              code: generateInvitationCode(),
              expiresAt,
              maxUses: options.maxUses,
            },
            include: withAuthor,
          });
        });
        // Fragment (#) : le jeton ne part ni dans les logs du serveur ni dans le Referer.
        return {
          ...toInvitation(row),
          url: `${this.appUrl}/join#token=${token}`,
        };
      } catch (error) {
        if (!isUniqueViolation(error) || attempt >= 4) throw error;
      }
    }
  }

  /** Révoque une invitation : son auteur ou le propriétaire du groupe. */
  async revoke(membership: Membership, invitationId: string): Promise<void> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, groupId: membership.groupId },
    });
    if (!invitation) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Invitation introuvable',
      });
    }
    if (
      membership.role !== GroupRole.OWNER &&
      invitation.createdById !== membership.userId
    ) {
      throw new ForbiddenException({
        code: GroupErrorCode.OWNER_ONLY,
        message:
          "Seuls son auteur et le propriétaire peuvent révoquer l'invitation",
      });
    }
    if (invitation.revokedAt) return;
    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { revokedAt: new Date() },
    });
  }

  /** Ce que l'invité voit avant d'accepter. */
  async preview(
    userId: string,
    lookup: InvitationLookup,
  ): Promise<InvitationPreview> {
    const invitation = await this.findUsable(lookup);
    const group = await this.prisma.group.findUnique({
      where: { id: invitation.groupId },
      include: { _count: { select: { members: true } } },
    });
    // Groupe supprimé entre-temps (dernier membre parti) : invitation morte.
    if (!group) throw invitationInvalid();
    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId } },
    });
    return {
      groupId: group.id,
      groupName: group.name,
      memberCount: group._count.members,
      invitedBy: invitation.createdBy?.displayName ?? null,
      alreadyMember: membership !== null,
    };
  }

  /**
   * Rejoint le groupe de l'invitation. Déjà membre : renvoie le groupe sans
   * consommer d'utilisation.
   */
  async accept(
    userId: string,
    lookup: InvitationLookup,
  ): Promise<GroupSummary> {
    const found = await this.findUsable(lookup);

    return this.prisma.$transaction(async (tx) => {
      if (!(await lockGroup(tx, found.groupId))) throw invitationInvalid();
      // Relue sous verrou : elle a pu être révoquée ou épuisée entre-temps.
      const invitation = await tx.invitation.findUnique({
        where: { id: found.id },
        include: withAuthor,
      });
      if (!invitation || !isUsable(invitation)) throw invitationInvalid();

      const members = await tx.groupMember.findMany({
        where: { groupId: invitation.groupId },
        select: { userId: true, role: true },
      });
      const group = await tx.group.findUniqueOrThrow({
        where: { id: invitation.groupId },
      });
      const existing = members.find((m) => m.userId === userId);
      if (existing) {
        return {
          id: group.id,
          name: group.name,
          role: existing.role,
          memberCount: members.length,
        };
      }
      if (members.length >= GROUP_MAX_MEMBERS) {
        throw new ConflictException({
          code: GroupErrorCode.GROUP_FULL,
          message: 'Ce groupe est complet',
        });
      }
      await assertGroupRoom(tx, userId);

      await tx.groupMember.create({
        data: { groupId: group.id, userId, role: GroupRole.MEMBER },
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { uses: { increment: 1 } },
      });
      return {
        id: group.id,
        name: group.name,
        role: GroupRole.MEMBER,
        memberCount: members.length + 1,
      };
    });
  }

  private async findUsable(lookup: InvitationLookup): Promise<InvitationRow> {
    const invitation = await this.prisma.invitation.findUnique({
      where:
        'token' in lookup
          ? { tokenHash: hashToken(lookup.token) }
          : { code: lookup.code },
      include: withAuthor,
    });
    if (!invitation || !isUsable(invitation)) throw invitationInvalid();
    return invitation;
  }
}
