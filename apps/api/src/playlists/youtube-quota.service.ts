import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Jour courant en UTC (le quota YouTube repart à minuit, heure du Pacifique : la marge couvre l'écart). */
function today(now = new Date()): Date {
  return new Date(now.toISOString().slice(0, 10));
}

/**
 * Part du quota YouTube réservée à la synchro des playlists. Compteur en base
 * (survit aux redémarrages), une ligne par jour, aucune donnée personnelle.
 */
@Injectable()
export class YouTubeQuotaService {
  private readonly limit: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.limit = config.get('PLAYLIST_SYNC_DAILY_UNITS');
  }

  /**
   * Réserve `units` unités sur la part du jour. Atomique ; renvoie false (rien
   * n'est réservé) si la part serait dépassée.
   */
  async tryConsume(units = 1, now = new Date()): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ units: number }[]>`
      INSERT INTO "youtube_daily_units" ("day", "units")
      SELECT ${today(now)}::date, ${units}
      WHERE ${units} <= ${this.limit}
      ON CONFLICT ("day") DO UPDATE
        SET "units" = "youtube_daily_units"."units" + ${units}
        WHERE "youtube_daily_units"."units" + ${units} <= ${this.limit}
      RETURNING "units"`;
    return rows.length > 0;
  }

  /** Quota épuisé côté YouTube (réponse quotaExceeded) : plus rien jusqu'à demain. */
  async exhaust(now = new Date()): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO "youtube_daily_units" ("day", "units")
      VALUES (${today(now)}::date, ${this.limit})
      ON CONFLICT ("day") DO UPDATE SET "units" = ${this.limit}`;
  }
}
