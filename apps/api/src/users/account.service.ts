import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ACCOUNT_EXPORT_VERSION,
  AccountErrorCode,
  AuthErrorCode,
  type AccountExport,
  type DeleteAccountRequest,
} from '@watchlist/shared';
import { PasswordService } from '../auth/password.service.js';
import { GroupsService, lockGroup } from '../groups/groups.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const iso = (date: Date) => date.toISOString();
const isoOrNull = (date: Date | null) => date?.toISOString() ?? null;

export function accountNotFound() {
  // JWT encore valide mais compte supprimé entre-temps.
  return new UnauthorizedException({
    code: AuthErrorCode.UNAUTHENTICATED,
    message: 'Compte introuvable',
  });
}

/** Droits RGPD : export des données et suppression réelle du compte. */
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly groups: GroupsService,
  ) {}

  /** Tout ce que la base contient sur la personne (voir AccountExport). */
  async export(userId: string): Promise<AccountExport> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        refreshTokens: {
          where: { revokedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'asc' },
        },
        memberships: {
          include: {
            group: {
              include: {
                members: {
                  where: { userId: { not: userId } },
                  include: { user: { select: { displayName: true } } },
                  orderBy: { joinedAt: 'asc' },
                },
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        addedTitles: {
          include: { group: true, mediaItem: true },
          orderBy: { addedAt: 'asc' },
        },
        statuses: {
          include: {
            groupTitle: { include: { group: true, mediaItem: true } },
          },
          orderBy: { updatedAt: 'asc' },
        },
        createdInvitations: {
          include: { group: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!user) throw accountNotFound();

    return {
      format: 'canapact-export',
      version: ACCOUNT_EXPORT_VERSION,
      exportedAt: iso(new Date()),
      account: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        emailVerifiedAt: isoOrNull(user.emailVerifiedAt),
        hasPassword: user.passwordHash !== null,
        googleId: user.googleId,
        createdAt: iso(user.createdAt),
        updatedAt: iso(user.updatedAt),
      },
      sessions: user.refreshTokens.map((t) => ({
        createdAt: iso(t.createdAt),
        expiresAt: iso(t.expiresAt),
        userAgent: t.userAgent,
      })),
      groups: user.memberships.map((m) => ({
        id: m.group.id,
        name: m.group.name,
        role: m.role,
        joinedAt: iso(m.joinedAt),
        otherMembers: m.group.members.map((o) => o.user.displayName),
      })),
      addedTitles: user.addedTitles.map((t) => ({
        groupId: t.group.id,
        groupName: t.group.name,
        title: t.mediaItem.title,
        url: t.mediaItem.url,
        source: t.mediaItem.source,
        addedAt: iso(t.addedAt),
        watchedTogetherAt: isoOrNull(t.watchedTogetherAt),
      })),
      statuses: user.statuses.map((s) => ({
        groupId: s.groupTitle.group.id,
        groupName: s.groupTitle.group.name,
        title: s.groupTitle.mediaItem.title,
        url: s.groupTitle.mediaItem.url,
        status: s.status,
        watchedAloneAt: isoOrNull(s.watchedAloneAt),
        updatedAt: iso(s.updatedAt),
      })),
      invitations: user.createdInvitations.map((i) => ({
        groupId: i.group.id,
        groupName: i.group.name,
        code: i.code,
        createdAt: iso(i.createdAt),
        expiresAt: iso(i.expiresAt),
        revokedAt: isoOrNull(i.revokedAt),
        uses: i.uses,
        maxUses: i.maxUses,
      })),
    };
  }

  /**
   * Suppression réelle (pas un compte « désactivé ») :
   * - dans chaque groupe, la personne part comme si elle le quittait : ses avis
   *   disparaissent, ses invitations actives sont révoquées, la propriété passe
   *   au membre arrivé le plus tôt, et un groupe dont elle était seule membre
   *   est supprimé avec ses titres ;
   * - puis la ligne `users` est supprimée. La base fait le reste : sessions et
   *   jetons par email en cascade ; titres ajoutés et invitations gardés avec
   *   un auteur nul (« ancien membre »).
   */
  async delete(userId: string, body: DeleteAccountRequest): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw accountNotFound();
    if (body.confirmEmail !== user.email) {
      throw new BadRequestException({
        code: AccountErrorCode.CONFIRMATION_MISMATCH,
        message: 'L’adresse ne correspond pas à ce compte',
      });
    }
    if (
      user.passwordHash !== null &&
      !(await this.passwords.verify(user.passwordHash, body.password ?? ''))
    ) {
      throw new UnauthorizedException({
        code: AuthErrorCode.INVALID_CREDENTIALS,
        message: 'Mot de passe incorrect',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const memberships = await tx.groupMember.findMany({
        where: { userId },
        select: { groupId: true },
      });
      // Verrous toujours pris dans le même ordre : deux suppressions
      // simultanées dans des groupes communs ne peuvent pas s'interbloquer.
      const groupIds = memberships.map((m) => m.groupId).sort();
      for (const groupId of groupIds) {
        if (await lockGroup(tx, groupId)) {
          await this.groups.depart(tx, groupId, userId);
        }
      }
      // deleteMany : pas d'erreur si une requête parallèle l'a déjà supprimé.
      await tx.user.deleteMany({ where: { id: userId } });
    });
  }
}
