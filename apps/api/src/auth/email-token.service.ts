import { Injectable } from '@nestjs/common';
import type { EmailTokenType } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EMAIL_RESEND_COOLDOWN_MS } from './auth.constants.js';
import { generateToken, hashToken } from './tokens.js';

/** Jetons à usage unique envoyés par email (vérification, reset, ajout de mot de passe). */
@Injectable()
export class EmailTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée un jeton, sauf si un jeton du même type vient d'être envoyé à ce compte
   * (renvoie alors null) : empêche d'inonder une boîte mail via nos formulaires.
   */
  async create(
    userId: string,
    type: EmailTokenType,
    ttlMs: number,
    passwordHash?: string,
  ): Promise<string | null> {
    const recent = await this.prisma.emailToken.findFirst({
      where: {
        userId,
        type,
        createdAt: { gt: new Date(Date.now() - EMAIL_RESEND_COOLDOWN_MS) },
      },
      select: { id: true },
    });
    if (recent) return null;

    const token = generateToken();
    await this.prisma.emailToken.create({
      data: {
        userId,
        type,
        tokenHash: hashToken(token),
        passwordHash,
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
    return token;
  }

  /**
   * Consomme un jeton valide (non utilisé, non expiré, du bon type) de façon
   * atomique, et invalide les autres jetons du même type pour ce compte.
   * Renvoie null si le jeton est inconnu, expiré ou déjà utilisé.
   */
  async consume(rawToken: string, type: EmailTokenType) {
    const tokenHash = hashToken(rawToken);
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.emailToken.updateMany({
        where: { tokenHash, type, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (count === 0) return null;
      const token = await tx.emailToken.findUniqueOrThrow({
        where: { tokenHash },
      });
      await tx.emailToken.updateMany({
        where: { userId: token.userId, type, usedAt: null },
        data: { usedAt: now },
      });
      return token;
    });
  }
}
