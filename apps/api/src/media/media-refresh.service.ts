import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MediaNotFoundError } from './media-source.js';
import { MediaSourceRegistry } from './media-source.registry.js';
import { MEDIA_STORAGE_MAX_AGE_MS } from './media.service.js';

const FIRST_RUN_DELAY_MS = 60_000;
const RUN_INTERVAL_MS = 6 * 3600 * 1000;
/** Titres rafraîchis par passage : 1 unité de quota YouTube chacun. */
const BATCH_SIZE = 500;

export interface RefreshReport {
  refreshed: number;
  gone: number;
  failed: number;
  deleted: number;
}

/**
 * Respect de la durée de conservation des données YouTube (30 jours au plus
 * sans rafraîchissement) : toutes les 6 heures, les entrées du cache plus
 * vieilles que MEDIA_STORAGE_MAX_AGE_MS sont redemandées au service si un
 * groupe les a dans sa liste, et supprimées sinon.
 */
@Injectable()
export class MediaRefreshService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(MediaRefreshService.name);
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<unknown> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: MediaSourceRegistry,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.get('MEDIA_REFRESH_ENABLED')) return;
    const tick = () => {
      if (this.running) return;
      this.running = this.refreshStale()
        .then((report) => {
          if (Object.values(report).some(Boolean)) {
            this.logger.log(`Cache des titres : ${JSON.stringify(report)}`);
          }
        })
        .catch((error: unknown) =>
          this.logger.error(`Rafraîchissement du cache : ${String(error)}`),
        )
        .finally(() => (this.running = null));
    };
    this.timer = setTimeout(() => {
      tick();
      this.timer = setInterval(tick, RUN_INTERVAL_MS).unref();
    }, FIRST_RUN_DELAY_MS).unref();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    await this.running;
  }

  async refreshStale(now = new Date()): Promise<RefreshReport> {
    const cutoff = new Date(now.getTime() - MEDIA_STORAGE_MAX_AGE_MS);
    const report: RefreshReport = {
      refreshed: 0,
      gone: 0,
      failed: 0,
      deleted: 0,
    };

    // Plus dans aucune liste : rien à garder.
    report.deleted = (
      await this.prisma.mediaItem.deleteMany({
        where: { fetchedAt: { lt: cutoff }, groupTitles: { none: {} } },
      })
    ).count;

    const stale = await this.prisma.mediaItem.findMany({
      where: { fetchedAt: { lt: cutoff }, groupTitles: { some: {} } },
      orderBy: { fetchedAt: 'asc' },
      take: BATCH_SIZE,
    });
    for (const item of stale) {
      const source = this.registry.byType(item.source);
      if (!source) {
        report.failed++;
        continue;
      }
      try {
        const info = await source.resolve(item.url);
        await this.prisma.mediaItem.update({
          where: { id: item.id },
          data: {
            url: info.url,
            title: info.title,
            thumbnailUrl: info.thumbnailUrl,
            author: info.author,
            durationSec: info.durationSec,
            unavailable: false,
            fetchedAt: new Date(),
          },
        });
        report.refreshed++;
      } catch (error) {
        if (!(error instanceof MediaNotFoundError)) {
          // Service injoignable : nouvel essai au prochain passage.
          report.failed++;
          continue;
        }
        // Vidéo supprimée ou devenue privée : elle reste dans les listes
        // (c'est l'historique du groupe), mais on ne peut plus rafraîchir ses
        // données, donc on les efface. Seul l'identifiant reste : si la vidéo
        // revient, un nouvel ajout ou un aperçu la restaure aussitôt, sinon le
        // passage suivant (dans 29 jours).
        await this.prisma.mediaItem.update({
          where: { id: item.id },
          data: {
            title: '',
            author: null,
            thumbnailUrl: null,
            durationSec: null,
            unavailable: true,
            fetchedAt: new Date(),
          },
        });
        report.gone++;
      }
    }
    return report;
  }
}
