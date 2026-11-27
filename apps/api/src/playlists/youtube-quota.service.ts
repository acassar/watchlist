import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Jour courant en UTC (le quota YouTube repart à minuit, heure du Pacifique : la marge couvre l'écart). */
function today(now = new Date()): Date {
  return new Date(now.toISOString().slice(0, 10));
}

/** Annule la transaction : la part globale du jour est épuisée. */
class GlobalQuotaFull extends Error {}

/**
 * Part du quota YouTube réservée à la synchro des playlists, et part de
 * chaque groupe dans celle-ci. Compteurs en base (survivent aux
 * redémarrages), une ligne par jour (et par groupe), aucune donnée
 * personnelle.
 */
@Injectable()
export class YouTubeQuotaService {
  private readonly limit: number;
  private readonly groupLimit: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.limit = config.get('PLAYLIST_SYNC_DAILY_UNITS');
    this.groupLimit = config.get('PLAYLIST_SYNC_GROUP_DAILY_UNITS');
  }

  /**
   * Réserve `units` unités pour ce groupe, sur sa part du jour et sur la part
   * globale. Atomique ; renvoie false (rien n'est réservé) si l'une des deux
   * serait dépassée.
   */
  async tryConsume(
    groupId: string,
    units = 1,
    now = new Date(),
  ): Promise<boolean> {
    const day = today(now);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const mine = await tx.$queryRaw<{ units: number }[]>`
          INSERT INTO "youtube_group_daily_units" ("day", "group_id", "units")
          SELECT ${day}::date, ${groupId}::uuid, ${units}
          WHERE ${units} <= ${this.groupLimit}
          ON CONFLICT ("day", "group_id") DO UPDATE
            SET "units" = "youtube_group_daily_units"."units" + ${units}
            WHERE "youtube_group_daily_units"."units" + ${units} <= ${this.groupLimit}
          RETURNING "units"`;
        if (mine.length === 0) return false;
        const all = await tx.$queryRaw<{ units: number }[]>`
          INSERT INTO "youtube_daily_units" ("day", "units")
          SELECT ${day}::date, ${units}
          WHERE ${units} <= ${this.limit}
          ON CONFLICT ("day") DO UPDATE
            SET "units" = "youtube_daily_units"."units" + ${units}
            WHERE "youtube_daily_units"."units" + ${units} <= ${this.limit}
          RETURNING "units"`;
        if (all.length === 0) throw new GlobalQuotaFull();
        return true;
      });
    } catch (error) {
      if (error instanceof GlobalQuotaFull) return false;
      throw error;
    }
  }

  /** Quota épuisé côté YouTube (réponse quotaExceeded) : plus rien jusqu'à demain. */
  async exhaust(now = new Date()): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO "youtube_daily_units" ("day", "units")
      VALUES (${today(now)}::date, ${this.limit})
      ON CONFLICT ("day") DO UPDATE SET "units" = ${this.limit}`;
  }
}
