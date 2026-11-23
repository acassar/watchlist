import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { REFRESH_TOKEN_TTL_MS } from './auth.constants.js';
import { generateToken, hashToken } from './tokens.js';

/** Précision de users.last_active_at (purge des comptes inactifs). */
const ACTIVITY_PRECISION_MS = 24 * 3600 * 1000;

export type RotateResult =
  | {
      ok: true;
      token: string;
      userId: string;
      /** Heure de la connexion qui a ouvert cette session (voir authTime). */
      authTime: Date;
    }
  | { ok: false };

/**
 * Refresh tokens rotatifs : chaque utilisation en délivre un nouveau et révoque
 * l'ancien. Réutiliser un jeton déjà révoqué trahit un vol : toute la famille
 * (la session de cet appareil) est alors révoquée.
 */
@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ouvre une nouvelle session (nouvelle famille). */
  issue(userId: string, userAgent?: string): Promise<string> {
    return this.create(userId, randomUUID(), userAgent);
  }

  async rotate(rawToken: string, userAgent?: string): Promise<RotateResult> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!existing) return { ok: false };

    if (existing.revokedAt) {
      await this.revokeFamily(existing.familyId);
      return { ok: false };
    }
    if (existing.expiresAt <= new Date()) return { ok: false };

    // Révocation conditionnelle : si deux requêtes utilisent le même jeton en même
    // temps, une seule gagne ; l'autre est traitée comme une réutilisation.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: existing.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) {
      await this.revokeFamily(existing.familyId);
      return { ok: false };
    }

    const token = await this.create(
      existing.userId,
      existing.familyId,
      userAgent,
    );
    return {
      ok: true,
      token,
      userId: existing.userId,
      authTime: await this.authTime(existing.familyId, existing.createdAt),
    };
  }

  /**
   * Heure de la connexion : le premier jeton de la famille. La purge supprime
   * les jetons expirés (30 jours) : l'heure obtenue n'est alors jamais plus
   * récente que la réalité de moins de 30 jours, donc jamais « récente ».
   */
  private async authTime(familyId: string, fallback: Date): Promise<Date> {
    const first = await this.prisma.refreshToken.findFirst({
      where: { familyId },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    return first?.createdAt ?? fallback;
  }

  /** Déconnexion de cet appareil. */
  async revoke(rawToken: string): Promise<void> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (existing) await this.revokeFamily(existing.familyId);
  }

  /** Déconnexion de tous les appareils (ex. après un changement de mot de passe). */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeFamily(familyId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async create(userId: string, familyId: string, userAgent?: string) {
    const token = generateToken();
    // Connexion ou rafraîchissement (toutes les 15 minutes d'utilisation au
    // plus) : la personne est active, la purge des comptes inactifs repart de
    // zéro et une éventuelle prévenance est oubliée (voir RetentionService).
    // Au plus une écriture par jour (users.updated_at ne bouge pas à chaque
    // rafraîchissement), sauf pour effacer une prévenance.
    const now = new Date();
    await this.prisma.user.updateMany({
      where: {
        id: userId,
        OR: [
          {
            lastActiveAt: {
              lt: new Date(now.getTime() - ACTIVITY_PRECISION_MS),
            },
          },
          { inactivityWarnedAt: { not: null } },
        ],
      },
      data: { lastActiveAt: now, inactivityWarnedAt: null },
    });
    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        userAgent: userAgent?.slice(0, 255),
      },
    });
    return token;
  }
}
