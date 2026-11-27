import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AuthErrorCode,
  EMAIL_CHANGE_MAX,
  EMAIL_CHANGE_WINDOW_DAYS,
  type ChangeEmailRequest,
  type ChangePasswordRequest,
  type ResetPasswordRequest,
} from '@watchlist/shared';
import type { Prisma, User } from '../generated/prisma/client.js';
import { MailQuotaService } from '../mail/mail-quota.service.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CHANGE_EMAIL_TTL_MS, REVERT_EMAIL_TTL_MS } from './auth.constants.js';
import { isUniqueViolation } from './auth.service.js';
import { EmailTokenService } from './email-token.service.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { generateToken, hashToken } from './tokens.js';

type Tx = Prisma.TransactionClient;

const WINDOW_MS = EMAIL_CHANGE_WINDOW_DAYS * 24 * 3600 * 1000;

function invalidToken() {
  return new UnauthorizedException({
    code: AuthErrorCode.INVALID_TOKEN,
    message: 'Lien invalide ou expiré',
  });
}

function wrongPassword() {
  return new UnauthorizedException({
    code: AuthErrorCode.INVALID_CREDENTIALS,
    message: 'Mot de passe incorrect',
  });
}

function emailTaken() {
  return new ConflictException({
    code: AuthErrorCode.EMAIL_ALREADY_REGISTERED,
    message: 'Cette adresse a déjà un compte',
  });
}

function changeLimit() {
  return new HttpException(
    {
      code: AuthErrorCode.EMAIL_CHANGE_LIMIT,
      message: `Au plus ${EMAIL_CHANGE_MAX} changements d'adresse sur ${EMAIL_CHANGE_WINDOW_DAYS} jours`,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

/**
 * Compte qui « tient » une adresse : vérifié, ou créé par Google. Un compte
 * jamais confirmé ne la tient pas : il est supprimé quand le propriétaire de
 * la boîte la prend pour son compte (il a cliqué sur un lien envoyé là-bas).
 */
const holdsEmail = (user: Pick<User, 'emailVerifiedAt' | 'googleId'>) =>
  user.emailVerifiedAt !== null || user.googleId !== null;

/**
 * Changement de mot de passe et d'adresse depuis les réglages. Réservé aux
 * comptes qui ont un mot de passe : il est redemandé à chaque fois.
 *
 * Adresse : un lien part à la nouvelle adresse et le changement ne se fait
 * qu'au clic. L'ancienne adresse est alors prévenue, avec un lien « ce n'est
 * pas moi » (7 jours) qui remet l'ancienne adresse, fait choisir un nouveau
 * mot de passe et ferme toutes les sessions. Au plus EMAIL_CHANGE_MAX
 * changements confirmés sur EMAIL_CHANGE_WINDOW_DAYS jours glissants.
 */
@Injectable()
export class CredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly emailTokens: EmailTokenService,
    private readonly mail: MailService,
    private readonly mailQuota: MailQuotaService,
  ) {}

  /**
   * Nouveau mot de passe. Les autres appareils sont déconnectés, celui-ci
   * (cookie `currentRefreshToken`) reste connecté. Un avis part à l'adresse du
   * compte ; quota épuisé, le changement se fait quand même sans avis.
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordRequest,
    currentRefreshToken?: string,
  ): Promise<void> {
    const user = await this.userWithPassword(userId, dto.currentPassword);
    const passwordHash = await this.passwords.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    await this.refreshTokens.revokeOthers(user.id, currentRefreshToken);
    // Un lien « mot de passe oublié » encore valide ne doit pas défaire ce choix.
    await this.emailTokens.invalidate(user.id, 'RESET_PASSWORD');
    await this.mail.sendPasswordChanged(user);
  }

  /** Demande de changement d'adresse : lien de confirmation à la nouvelle. */
  async requestEmailChange(
    userId: string,
    dto: ChangeEmailRequest,
  ): Promise<void> {
    const user = await this.userWithPassword(userId, dto.password);
    if (dto.newEmail === user.email) {
      throw new BadRequestException({
        code: AuthErrorCode.SAME_EMAIL,
        message: 'C’est déjà l’adresse de ce compte',
      });
    }
    if ((await this.recentChanges(this.prisma, user.id)) >= EMAIL_CHANGE_MAX) {
      throw changeLimit();
    }
    const holder = await this.prisma.user.findUnique({
      where: { email: dto.newEmail },
    });
    if (holder && holdsEmail(holder)) throw emailTaken();
    await this.assertMailAvailable();

    const token = await this.emailTokens.create(
      user.id,
      'CHANGE_EMAIL',
      CHANGE_EMAIL_TTL_MS,
      undefined,
      { email: dto.newEmail },
    );
    if (!token) {
      throw new HttpException(
        {
          code: AuthErrorCode.TOO_MANY_REQUESTS,
          message: 'Un lien vient de partir, patientez une minute',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.mail.sendChangeEmail(user, dto.newEmail, token);
  }

  /**
   * Clic sur le lien reçu à la nouvelle adresse : l'adresse change, et
   * l'ancienne reçoit l'avis avec le lien d'annulation. Refusé quand le quota
   * du jour est épuisé (le lien reste valable) : l'avis doit partir.
   */
  async confirmEmailChange(rawToken: string): Promise<void> {
    const pending = await this.emailTokens.find(rawToken, 'CHANGE_EMAIL');
    if (!pending?.email) throw invalidToken();
    await this.assertMailAvailable();
    const newEmail = pending.email;

    const result = await this.prisma
      .$transaction(async (tx) => {
        await lockUser(tx, pending.userId);
        if (
          (await this.recentChanges(tx, pending.userId)) >= EMAIL_CHANGE_MAX
        ) {
          throw changeLimit();
        }
        if (!(await consumeInTx(tx, pending.id, pending.userId))) {
          throw invalidToken();
        }
        await this.freeEmail(tx, newEmail, pending.userId);

        const before = await tx.user.findUniqueOrThrow({
          where: { id: pending.userId },
        });
        const user = await tx.user.update({
          where: { id: before.id },
          data: { email: newEmail, emailVerifiedAt: new Date() },
        });
        await tx.emailChange.create({ data: { userId: user.id } });
        // Un changement plus ancien encore annulable vise une adresse qui
        // n'est plus celle d'avant : seul le dernier avis garde son lien.
        await tx.emailToken.updateMany({
          where: { userId: user.id, type: 'REVERT_EMAIL', usedAt: null },
          data: { usedAt: new Date() },
        });
        const revert = generateToken();
        await tx.emailToken.create({
          data: {
            userId: user.id,
            type: 'REVERT_EMAIL',
            tokenHash: hashToken(revert),
            email: before.email,
            googleId: before.googleId,
            expiresAt: new Date(Date.now() + REVERT_EMAIL_TTL_MS),
          },
        });
        return { user, oldEmail: before.email, revert };
      })
      .catch((error: unknown) => {
        // Inscription ou autre changement vers la même adresse au même instant.
        if (isUniqueViolation(error)) throw emailTaken();
        throw error;
      });

    await this.mail.sendEmailChanged(
      result.user,
      result.oldEmail,
      newEmail,
      result.revert,
    );
  }

  /**
   * « Ce n'est pas moi », depuis l'ancienne adresse : elle revient sur le
   * compte avec le mot de passe choisi ici, toutes les sessions sont fermées
   * et le changement en attente est annulé. Liaison Google : celle d'avant le
   * changement est remise. Inchangée, elle reste ; liée ou remplacée depuis
   * (quelqu'un a pu lier son propre compte Google via la nouvelle adresse),
   * elle est retirée au profit de l'ancienne, ou d'aucune.
   */
  async revertEmailChange(dto: ResetPasswordRequest): Promise<void> {
    const pending = await this.emailTokens.find(dto.token, 'REVERT_EMAIL');
    if (!pending?.email) throw invalidToken();
    const oldEmail = pending.email;
    const passwordHash = await this.passwords.hash(dto.password);

    await this.prisma
      .$transaction(async (tx) => {
        await lockUser(tx, pending.userId);
        const holder = await tx.user.findUnique({ where: { email: oldEmail } });
        if (holder && holder.id !== pending.userId && holdsEmail(holder)) {
          throw new ConflictException({
            code: AuthErrorCode.EMAIL_TAKEN,
            message: 'Cette adresse est utilisée par un autre compte',
          });
        }
        if (!(await consumeInTx(tx, pending.id, pending.userId))) {
          throw invalidToken();
        }
        await this.freeEmail(tx, oldEmail, pending.userId);
        // L'ancien compte Google a pu être lié ailleurs depuis : alors aucun.
        const googleTaken =
          pending.googleId !== null &&
          (await tx.user.count({
            where: { googleId: pending.googleId, id: { not: pending.userId } },
          })) > 0;
        await tx.user.update({
          where: { id: pending.userId },
          data: {
            email: oldEmail,
            emailVerifiedAt: new Date(),
            passwordHash,
            googleId: googleTaken ? null : pending.googleId,
          },
        });
        await tx.emailToken.updateMany({
          where: {
            userId: pending.userId,
            type: { in: ['CHANGE_EMAIL', 'RESET_PASSWORD'] },
            usedAt: null,
          },
          data: { usedAt: new Date() },
        });
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) {
          throw new ConflictException({
            code: AuthErrorCode.EMAIL_TAKEN,
            message: 'Cette adresse est utilisée par un autre compte',
          });
        }
        throw error;
      });
    await this.refreshTokens.revokeAllForUser(pending.userId);
  }

  private async userWithPassword(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException({
        code: AuthErrorCode.UNAUTHENTICATED,
        message: 'Compte introuvable',
      });
    }
    if (user.passwordHash === null) {
      throw new BadRequestException({
        code: AuthErrorCode.NO_PASSWORD,
        message: 'Réservé aux comptes avec un mot de passe',
      });
    }
    if (!(await this.passwords.verify(user.passwordHash, password))) {
      throw wrongPassword();
    }
    return user;
  }

  private recentChanges(db: Tx | PrismaService, userId: string) {
    return db.emailChange.count({
      where: { userId, changedAt: { gt: new Date(Date.now() - WINDOW_MS) } },
    });
  }

  /** Supprime un compte jamais confirmé qui occupe l'adresse (voir holdsEmail). */
  private async freeEmail(tx: Tx, email: string, userId: string) {
    const holder = await tx.user.findUnique({ where: { email } });
    if (!holder || holder.id === userId) return;
    if (holdsEmail(holder)) throw emailTaken();
    await tx.user.delete({ where: { id: holder.id } });
  }

  private async assertMailAvailable(): Promise<void> {
    if (await this.mailQuota.isExhausted()) {
      throw new ServiceUnavailableException({
        code: AuthErrorCode.MAIL_QUOTA_EXCEEDED,
        message: "Trop d'emails envoyés aujourd'hui, réessayez demain",
      });
    }
  }
}

/** Sérialise les changements d'adresse d'un même compte (limite, conflits). */
async function lockUser(tx: Tx, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'user-email:' + userId}))`;
}

/** Consomme le jeton dans la transaction ; false s'il vient d'être utilisé. */
async function consumeInTx(tx: Tx, tokenId: string, userId: string) {
  const now = new Date();
  const { count } = await tx.emailToken.updateMany({
    where: { id: tokenId, userId, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (count === 0) return false;
  const { type } = await tx.emailToken.findUniqueOrThrow({
    where: { id: tokenId },
    select: { type: true },
  });
  // Les autres liens du même type ne servent plus.
  await tx.emailToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: now },
  });
  return true;
}
