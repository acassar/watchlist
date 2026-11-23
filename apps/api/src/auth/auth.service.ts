import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  AuthErrorCode,
  type AuthUser,
  type LoginRequest,
  type RegisterRequest,
  type ResetPasswordRequest,
} from '@watchlist/shared';
import type { User } from '../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  LINK_PASSWORD_TTL_MS,
  RESET_PASSWORD_TTL_MS,
  VERIFY_EMAIL_TTL_MS,
} from './auth.constants.js';
import { EmailTokenService } from './email-token.service.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenService } from './refresh-token.service.js';

/** Session ouverte : JWT d'accès pour le corps de la réponse, refresh token pour le cookie. */
export interface Session {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    emailVerified: user.emailVerifiedAt !== null,
    hasPassword: user.passwordHash !== null,
  };
}

function invalidToken() {
  return new UnauthorizedException({
    code: AuthErrorCode.INVALID_TOKEN,
    message: 'Lien invalide ou expiré',
  });
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly emailTokens: EmailTokenService,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Inscription. La réponse est toujours la même (« vérifiez vos emails ») pour ne
   * pas révéler si un compte existe ; c'est l'email reçu qui diffère :
   * - adresse inconnue : création du compte + lien de vérification ;
   * - compte sans mot de passe (créé via Google) : lien pour choisir un mot de
   *   passe. Celui tapé à l'inscription est ignoré : sinon un inconnu pourrait
   *   s'inscrire avec l'adresse d'un compte Google et attendre que le vrai
   *   propriétaire clique « oui » dans l'email pour entrer avec son mot de passe à lui ;
   * - compte jamais vérifié : nouveau lien de vérification qui porte le mot de
   *   passe choisi cette fois-ci (appliqué au clic, voir verifyEmail) ;
   * - compte actif : email « vous avez déjà un compte ».
   */
  async register(dto: RegisterRequest): Promise<void> {
    // Hachage dans tous les cas : la durée de réponse ne trahit pas la branche suivie.
    const passwordHash = await this.passwords.hash(dto.password);
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!existing) {
      const user = await this.prisma.user
        .create({
          data: {
            email: dto.email,
            passwordHash,
            displayName: dto.displayName,
          },
        })
        .catch((error: unknown) => {
          // Deux inscriptions simultanées avec la même adresse : la seconde ne fait rien.
          if (isUniqueViolation(error)) return null;
          throw error;
        });
      if (!user) return;
      await this.sendVerification(user, passwordHash);
      return;
    }

    if (existing.passwordHash === null) {
      const token = await this.emailTokens.create(
        existing.id,
        'LINK_PASSWORD',
        LINK_PASSWORD_TTL_MS,
      );
      if (token) this.mail.sendLinkPassword(existing, token);
      return;
    }

    if (existing.emailVerifiedAt === null) {
      await this.sendVerification(existing, passwordHash);
      return;
    }

    this.mail.sendAlreadyRegistered(existing);
  }

  /** Renvoie le lien de vérification si le compte existe et n'est pas encore vérifié. */
  async resendVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerifiedAt) return;
    await this.sendVerification(user);
  }

  /** Clic sur le lien de vérification : active le compte et ouvre une session. */
  async verifyEmail(rawToken: string, userAgent?: string): Promise<Session> {
    const token = await this.emailTokens.consume(rawToken, 'VERIFY_EMAIL');
    if (!token) throw invalidToken();

    const user = await this.prisma.user.update({
      where: { id: token.userId },
      data: {
        emailVerifiedAt: new Date(),
        // Le mot de passe retenu est celui de l'inscription qui a produit ce lien.
        ...(token.passwordHash ? { passwordHash: token.passwordHash } : {}),
      },
    });
    return this.openSession(user, userAgent);
  }

  async login(dto: LoginRequest, userAgent?: string): Promise<Session> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    const valid = await this.passwords.verify(
      user?.passwordHash ?? null,
      dto.password,
    );
    if (!user || !valid) {
      throw new UnauthorizedException({
        code: AuthErrorCode.INVALID_CREDENTIALS,
        message: 'Email ou mot de passe incorrect',
      });
    }
    if (!user.emailVerifiedAt) {
      // Révélé seulement à qui connaît le bon mot de passe.
      throw new ForbiddenException({
        code: AuthErrorCode.EMAIL_NOT_VERIFIED,
        message: 'Adresse email pas encore confirmée',
      });
    }
    return this.openSession(user, userAgent);
  }

  /** Échange un refresh token contre un nouveau couple (rotation). */
  async refresh(rawToken: string, userAgent?: string): Promise<Session> {
    const result = await this.refreshTokens.rotate(rawToken, userAgent);
    if (!result.ok) {
      throw new UnauthorizedException({
        code: AuthErrorCode.UNAUTHENTICATED,
        message: 'Session expirée',
      });
    }
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: result.userId },
    });
    return {
      accessToken: await this.signAccessToken(user.id, result.authTime),
      refreshToken: result.token,
      user: toAuthUser(user),
    };
  }

  logout(rawToken: string): Promise<void> {
    return this.refreshTokens.revoke(rawToken);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;
    const token = await this.emailTokens.create(
      user.id,
      'RESET_PASSWORD',
      RESET_PASSWORD_TTL_MS,
    );
    if (token) this.mail.sendResetPassword(user, token);
  }

  /**
   * Nouveau mot de passe via le lien reçu par email. Le clic prouve l'accès à la
   * boîte mail : l'adresse est considérée vérifiée. Toutes les sessions sont fermées.
   */
  async resetPassword(dto: ResetPasswordRequest): Promise<void> {
    const passwordHash = await this.passwords.hash(dto.password);
    const token = await this.emailTokens.consume(dto.token, 'RESET_PASSWORD');
    if (!token) throw invalidToken();

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: token.userId },
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      },
    });
    await this.refreshTokens.revokeAllForUser(user.id);
  }

  /**
   * Ajout d'un mot de passe à un compte qui n'en avait pas (Google), via le lien
   * reçu par email. Le mot de passe est choisi ici, par la personne qui a ouvert
   * la boîte mail, jamais repris de l'inscription qui a déclenché l'envoi.
   */
  async confirmLinkPassword(
    dto: ResetPasswordRequest,
    userAgent?: string,
  ): Promise<Session> {
    const passwordHash = await this.passwords.hash(dto.password);
    const token = await this.emailTokens.consume(dto.token, 'LINK_PASSWORD');
    if (!token) throw invalidToken();

    const current = await this.prisma.user.findUniqueOrThrow({
      where: { id: token.userId },
    });
    const user = await this.prisma.user.update({
      where: { id: current.id },
      data: {
        passwordHash,
        emailVerifiedAt: current.emailVerifiedAt ?? new Date(),
      },
    });
    return this.openSession(user, userAgent);
  }

  private async sendVerification(user: User, passwordHash?: string) {
    const token = await this.emailTokens.create(
      user.id,
      'VERIFY_EMAIL',
      VERIFY_EMAIL_TTL_MS,
      passwordHash,
    );
    if (token) this.mail.sendVerifyEmail(user, token);
  }

  /** Ouvre une session (JWT + refresh token) pour un utilisateur déjà authentifié. */
  async openSession(user: User, userAgent?: string): Promise<Session> {
    return {
      accessToken: await this.signAccessToken(user.id, new Date()),
      refreshToken: await this.refreshTokens.issue(user.id, userAgent),
      user: toAuthUser(user),
    };
  }

  /**
   * `auth_time` (claim standard OpenID) : heure de la connexion, conservée au
   * fil des rafraîchissements. Les actions sensibles exigent une connexion
   * récente quand aucun mot de passe ne peut être redemandé.
   */
  private signAccessToken(userId: string, authTime: Date) {
    return this.jwt.signAsync({
      sub: userId,
      auth_time: Math.floor(authTime.getTime() / 1000),
    });
  }
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
