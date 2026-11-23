import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';

const FIRST_RUN_DELAY_MS = 5 * 60_000;
const RUN_INTERVAL_MS = 24 * 3600 * 1000;
/**
 * Un compte jamais confirmé ne peut pas se connecter : passé ce délai (le lien
 * de confirmation expire au bout de 24 h), il est supprimé.
 */
export const UNVERIFIED_ACCOUNT_MAX_AGE_MS = 7 * 24 * 3600 * 1000;

export interface PurgeReport {
  refreshTokens: number;
  emailTokens: number;
  unverifiedAccounts: number;
}

/**
 * Limitation de la conservation (RGPD, art. 5.1.e) : chaque jour, on supprime
 * ce qui ne sert plus. Les durées sont celles de la politique de
 * confidentialité : la modifier ici, c'est la modifier là-bas.
 */
@Injectable()
export class RetentionService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(RetentionService.name);
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<unknown> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.get('RETENTION_PURGE_ENABLED')) return;
    const tick = () => {
      if (this.running) return;
      this.running = this.purge()
        .then((report) => {
          if (Object.values(report).some(Boolean)) {
            this.logger.log(`Purge : ${JSON.stringify(report)}`);
          }
        })
        .catch((error: unknown) =>
          this.logger.error(`Purge : ${String(error)}`),
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

  async purge(now = new Date()): Promise<PurgeReport> {
    // Un jeton révoqué reste jusqu'à son expiration : s'il revient avant, on
    // sait qu'il a été volé (voir RefreshTokenService). Après, il ne sert plus.
    const refreshTokens = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    const emailTokens = await this.prisma.emailToken.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    const unverifiedAccounts = await this.prisma.user.deleteMany({
      where: {
        emailVerifiedAt: null,
        googleId: null,
        createdAt: {
          lt: new Date(now.getTime() - UNVERIFIED_ACCOUNT_MAX_AGE_MS),
        },
        // Lien de confirmation renvoyé récemment (nouvelle inscription sur la
        // même adresse, « renvoyer le lien ») : on lui laisse sa chance.
        emailTokens: { none: { expiresAt: { gte: now } } },
      },
    });
    return {
      refreshTokens: refreshTokens.count,
      emailTokens: emailTokens.count,
      unverifiedAccounts: unverifiedAccounts.count,
    };
  }
}
