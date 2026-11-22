import { Injectable } from '@nestjs/common';
import { DISPLAY_NAME_MAX_LENGTH, GoogleErrorCode } from '@watchlist/shared';
import type { User } from '../../generated/prisma/client.js';
import { MailService } from '../../mail/mail.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  AuthService,
  isUniqueViolation,
  type Session,
} from '../auth.service.js';
import { RefreshTokenService } from '../refresh-token.service.js';
import type { GoogleProfile } from './google-profile.js';

/** Échec de connexion Google à afficher à l'utilisateur. */
export class GoogleLoginError extends Error {
  constructor(readonly code: GoogleErrorCode) {
    super(code);
    this.name = 'GoogleLoginError';
  }
}

/**
 * Connexion avec Google et liaison au compte email (décision D7).
 *
 * Google n'est cru sur l'adresse que si `email_verified` est vrai. Ensuite :
 * 1. compte déjà lié à ce compte Google : connexion ;
 * 2. aucun compte pour cette adresse : création d'un compte sans mot de passe,
 *    adresse vérifiée ;
 * 3. compte email vérifié : liaison automatique (les deux côtés ont prouvé
 *    l'accès à la boîte mail), et email d'information ;
 * 4. compte email jamais vérifié : protection contre le pré-détournement de
 *    compte. N'importe qui a pu créer ce compte avec l'adresse de quelqu'un
 *    d'autre et un mot de passe à lui, en attendant que la victime arrive par
 *    Google. Rien de ce compte n'a été prouvé : son mot de passe et ses liens
 *    en attente sont effacés, puis le compte est lié à Google. Le propriétaire
 *    pourra ajouter un mot de passe plus tard via le lien de confirmation.
 *
 * Dans l'autre sens (poser un mot de passe sur un compte Google), AuthService.register
 * exige déjà le clic sur un lien envoyé par email.
 */
@Injectable()
export class GoogleAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly mail: MailService,
  ) {}

  async login(profile: GoogleProfile, userAgent?: string): Promise<Session> {
    const user = await this.findOrLinkUser(profile);
    return this.auth.openSession(user, userAgent);
  }

  private async findOrLinkUser(
    profile: GoogleProfile,
    retried = false,
  ): Promise<User> {
    const linked = await this.prisma.user.findUnique({
      where: { googleId: profile.sub },
    });
    if (linked) return linked;

    if (!profile.email || !profile.emailVerified) {
      throw new GoogleLoginError(GoogleErrorCode.EMAIL_NOT_VERIFIED);
    }
    const email = profile.email;

    try {
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (!existing) {
        return await this.prisma.user.create({
          data: {
            email,
            googleId: profile.sub,
            displayName: displayNameFrom(profile, email),
            emailVerifiedAt: new Date(),
          },
        });
      }

      if (existing.googleId) {
        // Adresse déjà liée à un autre compte Google : on ne remplace pas en silence.
        throw new GoogleLoginError(GoogleErrorCode.ACCOUNT_CONFLICT);
      }

      if (existing.emailVerifiedAt) {
        const { count } = await this.prisma.user.updateMany({
          where: { id: existing.id, googleId: null },
          data: { googleId: profile.sub },
        });
        if (count === 0) throw new ConcurrentChange();
        const user = await this.prisma.user.findUniqueOrThrow({
          where: { id: existing.id },
        });
        this.mail.sendGoogleLinked(user);
        return user;
      }

      return await this.takeOverUnverified(existing, profile, email);
    } catch (error) {
      // Deux connexions simultanées (même compte Google ou même adresse) :
      // la seconde relit ce que la première a écrit.
      if (
        !retried &&
        (isUniqueViolation(error) || error instanceof ConcurrentChange)
      ) {
        return this.findOrLinkUser(profile, true);
      }
      throw error;
    }
  }

  /** Cas 4 : compte jamais vérifié, réattribué au propriétaire prouvé de l'adresse. */
  private async takeOverUnverified(
    existing: User,
    profile: GoogleProfile,
    email: string,
  ): Promise<User> {
    const now = new Date();
    const user = await this.prisma.$transaction(async (tx) => {
      // Liens encore valides (dont la vérification qui porte le mot de passe
      // choisi par l'inscrit inconnu) : plus jamais utilisables.
      await tx.emailToken.updateMany({
        where: { userId: existing.id, usedAt: null },
        data: { usedAt: now },
      });
      const { count } = await tx.user.updateMany({
        where: { id: existing.id, emailVerifiedAt: null, googleId: null },
        data: {
          googleId: profile.sub,
          passwordHash: null,
          emailVerifiedAt: now,
          // Le nom aussi venait de l'inscrit inconnu.
          displayName: displayNameFrom(profile, email),
        },
      });
      // Vérifié ou lié entre-temps : on annule et on relit (la transaction est défaite).
      if (count === 0) throw new ConcurrentChange();
      return tx.user.findUniqueOrThrow({ where: { id: existing.id } });
    });
    // Un compte non vérifié ne peut pas avoir de session, mais par prudence.
    await this.refreshTokens.revokeAllForUser(user.id);
    return user;
  }
}

/** Nom affiché proposé par Google, sinon la partie locale de l'adresse. */
export function displayNameFrom(profile: GoogleProfile, email: string): string {
  const name = (profile.name ?? '').trim() || email.split('@')[0] || 'Moi';
  // Même borne que le schéma Zod (unités UTF-16), sans couper un emoji en deux.
  let result = '';
  for (const { segment } of new Intl.Segmenter('fr', {
    granularity: 'grapheme',
  }).segment(name)) {
    if (result.length + segment.length > DISPLAY_NAME_MAX_LENGTH) break;
    result += segment;
  }
  return result;
}

/** Le compte a changé entre la lecture et l'écriture : on recommence une fois. */
class ConcurrentChange extends Error {}
