import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccountService } from './account.service.js';

const FIRST_RUN_DELAY_MS = 5 * 60_000;
const RUN_INTERVAL_MS = 24 * 3600 * 1000;
/**
 * Un compte jamais confirmé ne peut pas se connecter : passé ce délai (le lien
 * de confirmation expire au bout de 24 h), il est supprimé.
 */
export const UNVERIFIED_ACCOUNT_MAX_AGE_MS = 7 * 24 * 3600 * 1000;

/** Un compte sans connexion pendant ce nombre d'années est supprimé. */
export const INACTIVE_ACCOUNT_MAX_AGE_YEARS = 3;
/**
 * Délai minimal entre l'email de prévenance et la suppression (« un mois ») :
 * respecté même si la purge n'a pas tourné pendant un temps.
 */
export const INACTIVITY_NOTICE_MS = 30 * 24 * 3600 * 1000;
/**
 * Prévenances envoyées par jour au plus : le reste attend le lendemain (et sa
 * suppression recule d'autant). Garde de la marge sur le quota quotidien de
 * Brevo pour les emails de connexion.
 */
export const INACTIVITY_WARNINGS_PER_RUN = 100;

export interface PurgeReport {
  refreshTokens: number;
  emailTokens: number;
  unverifiedAccounts: number;
  inactivityWarnings: number;
  inactiveAccounts: number;
}

function yearsBefore(date: Date, years: number): Date {
  const result = new Date(date);
  result.setUTCFullYear(result.getUTCFullYear() - years);
  return result;
}

/** « 23 décembre 2026 », à l'heure de Paris (le texte de l'email). */
export function formatDeletionDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(date);
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
    private readonly accounts: AccountService,
    private readonly mail: MailService,
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
    // D'abord les suppressions : un compte prévenu aujourd'hui ne peut pas
    // être supprimé dans la foulée.
    const inactiveAccounts = await this.purgeInactiveAccounts(now);
    const inactivityWarnings = await this.warnInactiveAccounts(now);
    return {
      refreshTokens: refreshTokens.count,
      emailTokens: emailTokens.count,
      unverifiedAccounts: unverifiedAccounts.count,
      inactivityWarnings,
      inactiveAccounts,
    };
  }

  /**
   * Comptes sans connexion depuis 3 ans, prévenus il y a au moins un mois.
   * Une connexion remet la prévenance à null (RefreshTokenService) : le compte
   * sort alors de la liste. Sans prévenance partie, pas de suppression.
   */
  private async purgeInactiveAccounts(now: Date): Promise<number> {
    const where = {
      lastActiveAt: { lt: yearsBefore(now, INACTIVE_ACCOUNT_MAX_AGE_YEARS) },
      inactivityWarnedAt: {
        lte: new Date(now.getTime() - INACTIVITY_NOTICE_MS),
      },
    };
    const candidates = await this.prisma.user.findMany({
      where,
      select: { id: true },
    });
    let deleted = 0;
    for (const { id } of candidates) {
      // Même suppression que celle demandée depuis les réglages. Les critères
      // sont relus sous verrou : une connexion à la dernière minute gagne.
      const erased = await this.accounts.erase(
        id,
        async (tx) => (await tx.user.count({ where: { id, ...where } })) > 0,
      );
      if (erased) deleted++;
    }
    return deleted;
  }

  /**
   * Prévenance un mois avant les 3 ans. La date annoncée est la plus tardive
   * des deux échéances (3 ans d'inactivité, un mois après l'email) : la purge
   * ne supprime jamais plus tôt. L'email part avant de noter la prévenance :
   * s'il échoue, on réessaie le lendemain, et le compte n'est pas supprimé.
   */
  private async warnInactiveAccounts(now: Date): Promise<number> {
    const users = await this.prisma.user.findMany({
      where: {
        lastActiveAt: {
          lt: new Date(
            yearsBefore(now, INACTIVE_ACCOUNT_MAX_AGE_YEARS).getTime() +
              INACTIVITY_NOTICE_MS,
          ),
        },
        inactivityWarnedAt: null,
      },
      orderBy: { lastActiveAt: 'asc' },
      take: INACTIVITY_WARNINGS_PER_RUN,
      select: {
        id: true,
        email: true,
        displayName: true,
        lastActiveAt: true,
      },
    });
    let warned = 0;
    for (const user of users) {
      const deletionDate = new Date(
        Math.max(
          yearsBefore(
            user.lastActiveAt,
            -INACTIVE_ACCOUNT_MAX_AGE_YEARS,
          ).getTime(),
          now.getTime() + INACTIVITY_NOTICE_MS,
        ),
      );
      try {
        await this.mail.sendInactivityWarning(
          user,
          formatDeletionDate(deletionDate),
        );
      } catch (error: unknown) {
        // Pas d'adresse dans les journaux : l'identifiant suffit.
        this.logger.error(
          `Prévenance d'inactivité non envoyée (${user.id}) : ${String(error)}`,
        );
        continue;
      }
      // Seulement si la personne n'est pas revenue entre-temps.
      const { count } = await this.prisma.user.updateMany({
        where: {
          id: user.id,
          lastActiveAt: user.lastActiveAt,
          inactivityWarnedAt: null,
        },
        data: { inactivityWarnedAt: now },
      });
      warned += count;
    }
    return warned;
  }
}
