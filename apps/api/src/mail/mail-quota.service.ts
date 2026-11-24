import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Envoi refusé : le quota d'emails du jour est épuisé. */
export class MailQuotaExceededError extends Error {
  constructor() {
    super("Quota d'emails du jour épuisé");
    this.name = 'MailQuotaExceededError';
  }
}

/** Jour courant en UTC, au format attendu par une colonne DATE. */
function today(now = new Date()): Date {
  return new Date(now.toISOString().slice(0, 10));
}

/**
 * Compteur caché des emails du jour. Au-delà du quota de Brevo, les envois
 * sont refusés sans que l'utilisateur le sache : on préfère s'arrêter juste
 * avant et le lui dire.
 */
@Injectable()
export class MailQuotaService {
  private readonly limit: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.limit = config.get('MAIL_DAILY_LIMIT');
  }

  /** Quota du jour épuisé : plus aucun email ne partira avant demain. */
  async isExhausted(now = new Date()): Promise<boolean> {
    const row = await this.prisma.mailDailyCount.findUnique({
      where: { day: today(now) },
    });
    return (row?.count ?? 0) >= this.limit;
  }

  /**
   * Réserve un envoi sur le quota du jour. Atomique : deux requêtes
   * simultanées ne peuvent pas dépasser la limite. Renvoie false si le
   * quota est épuisé (l'email ne doit pas partir).
   */
  async tryConsume(now = new Date()): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "mail_daily_counts" ("day", "count")
      VALUES (${today(now)}::date, 1)
      ON CONFLICT ("day") DO UPDATE
        SET "count" = "mail_daily_counts"."count" + 1
        WHERE "mail_daily_counts"."count" < ${this.limit}
      RETURNING "count"`;
    return rows.length > 0;
  }
}
