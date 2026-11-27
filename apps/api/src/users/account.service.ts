import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ACCOUNT_EXPORT_VERSION,
  AccountErrorCode,
  AuthErrorCode,
  REAUTH_MAX_AGE_SECONDS,
  toLocale,
  type AccountExport,
  youTubePlaylistUrl,
  type DeleteAccountRequest,
} from '@watchlist/shared';
import type { AuthenticatedUser } from '../auth/current-user.decorator.js';
import { PasswordService } from '../auth/password.service.js';
import { GroupsService, lockGroup } from '../groups/groups.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const iso = (date: Date) => date.toISOString();
const isoOrNull = (date: Date | null) => date?.toISOString() ?? null;
const isRecent = (authTime: Date | null) =>
  authTime !== null &&
  Date.now() - authTime.getTime() <= REAUTH_MAX_AGE_SECONDS * 1000;

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
        // Tout ce qui est stocké, y compris les jetons révoqués gardés jusqu'à
        // leur expiration (ils portent le navigateur utilisé).
        refreshTokens: { orderBy: { createdAt: 'asc' } },
        emailTokens: { orderBy: { createdAt: 'asc' } },
        memberships: {
          include: {
            playlist: true,
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

    // Titres ajoutés et invitations restent liés à la personne après son départ
    // d'un groupe. Elle n'en voit alors plus le nom ni l'avancement : ce sont
    // désormais les données des autres membres.
    const memberOf = new Set(user.memberships.map((m) => m.groupId));
    const groupName = (group: { id: string; name: string }) =>
      memberOf.has(group.id) ? group.name : null;
    const now = new Date();

    return {
      format: 'canapact-export',
      version: ACCOUNT_EXPORT_VERSION,
      exportedAt: iso(new Date()),
      account: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        locale: toLocale(user.locale),
        emailVerifiedAt: isoOrNull(user.emailVerifiedAt),
        hasPassword: user.passwordHash !== null,
        googleId: user.googleId,
        createdAt: iso(user.createdAt),
        updatedAt: iso(user.updatedAt),
        lastActiveAt: iso(user.lastActiveAt),
        inactivityWarnedAt: isoOrNull(user.inactivityWarnedAt),
      },
      sessions: user.refreshTokens.map((t) => ({
        createdAt: iso(t.createdAt),
        expiresAt: iso(t.expiresAt),
        revokedAt: isoOrNull(t.revokedAt),
        active: t.revokedAt === null && t.expiresAt > now,
        userAgent: t.userAgent,
      })),
      emailLinks: user.emailTokens.map((t) => ({
        type: t.type,
        createdAt: iso(t.createdAt),
        expiresAt: iso(t.expiresAt),
        usedAt: isoOrNull(t.usedAt),
      })),
      groups: user.memberships.map((m) => ({
        id: m.group.id,
        name: m.group.name,
        role: m.role,
        joinedAt: iso(m.joinedAt),
        otherMembers: m.group.members.map((o) => o.user.displayName),
        playlist: m.playlist
          ? {
              url: youTubePlaylistUrl(m.playlist.playlistId),
              linkedAt: iso(m.playlist.linkedAt),
              importFrom: isoOrNull(m.playlist.importFrom),
            }
          : null,
      })),
      addedTitles: user.addedTitles.map((t) => ({
        groupId: t.group.id,
        groupName: groupName(t.group),
        title: t.mediaItem.title,
        url: t.mediaItem.url,
        source: t.mediaItem.source,
        addedAt: iso(t.addedAt),
        watchedTogetherAt: memberOf.has(t.group.id)
          ? isoOrNull(t.watchedTogetherAt)
          : null,
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
        groupName: groupName(i.group),
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
  async delete(
    current: AuthenticatedUser,
    body: DeleteAccountRequest,
  ): Promise<void> {
    const userId = current.id;
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
    if (user.passwordHash === null && !isRecent(current.authTime)) {
      // Pas de mot de passe à redemander : on exige une connexion Google
      // récente, sinon un téléphone déverrouillé suffirait (l'adresse s'affiche
      // dans les réglages).
      throw new ForbiddenException({
        code: AccountErrorCode.REAUTH_REQUIRED,
        message: 'Reconnectez-vous pour confirmer la suppression',
      });
    }

    await this.erase(userId);
  }

  /**
   * Suppression réelle, sans vérification d'identité : pour delete() ci-dessus
   * et la purge des comptes inactifs. `stillEligible` est relu une fois le
   * compte verrouillé (plus aucune connexion ne peut le modifier) : s'il
   * renvoie false, rien n'est supprimé et erase() renvoie false.
   */
  async erase(
    userId: string,
    stillEligible?: (tx: Prisma.TransactionClient) => Promise<boolean>,
  ): Promise<boolean> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const departed = new Set<string>();
        const departAll = async () => {
          const memberships = await tx.groupMember.findMany({
            where: { userId, groupId: { notIn: [...departed] } },
            select: { groupId: true },
          });
          // Verrous toujours pris dans le même ordre : deux suppressions
          // simultanées dans des groupes communs ne peuvent pas s'interbloquer.
          for (const groupId of memberships.map((m) => m.groupId).sort()) {
            if (await lockGroup(tx, groupId)) {
              await this.groups.depart(tx, groupId, userId);
            }
            departed.add(groupId);
          }
        };
        await departAll();
        // Verrou sur le compte : tant qu'il est tenu, aucun groupe ne peut être
        // créé ni rejoint à son nom (la clé étrangère attend). Un groupe créé
        // juste avant est rattrapé par le second passage, sinon il resterait
        // sans membre ni propriétaire après la cascade.
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
        if (stillEligible && !(await stillEligible(tx)))
          throw new NotEligible();
        await departAll();
        // deleteMany : pas d'erreur si une requête parallèle l'a déjà supprimé.
        await tx.user.deleteMany({ where: { id: userId } });
      });
      return true;
    } catch (error) {
      // Annule aussi les départs de groupe déjà faits dans la transaction.
      if (error instanceof NotEligible) return false;
      throw error;
    }
  }
}

class NotEligible extends Error {}
