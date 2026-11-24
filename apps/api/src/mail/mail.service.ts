import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toLocale } from '@watchlist/shared';
import type { Env } from '../config.js';
import {
  MailQuotaExceededError,
  MailQuotaService,
} from './mail-quota.service.js';
import { MAIL_TRANSPORT, type MailTransport } from './mail-transport.js';
import {
  googleLinkedTemplate,
  inactivityWarningTemplate,
  linkPasswordTemplate,
  resetPasswordTemplate,
  verifyEmailTemplate,
} from './templates.js';

interface Recipient {
  email: string;
  displayName: string;
  /** Langue de l'email (texte libre en base, ramené à fr/en). */
  locale: string;
}

/**
 * Emails transactionnels de l'auth. Les jetons passent dans le fragment (#token=)
 * des liens : il n'est jamais envoyé au serveur, donc absent des logs du proxy.
 *
 * L'envoi part en arrière-plan, sans être attendu par la requête : sinon la durée
 * de réponse de register / resend / forgot trahirait l'existence du compte
 * (un appel HTTP à Brevo prend des centaines de millisecondes). Un échec d'envoi
 * est journalisé ; l'utilisateur peut redemander un lien. Les envois en cours
 * sont attendus à l'arrêt de l'application.
 *
 * Chaque envoi passe d'abord par le quota du jour (MailQuotaService) : une
 * fois épuisé, l'email ne part pas et c'est journalisé.
 */
@Injectable()
export class MailService implements OnApplicationShutdown {
  private readonly logger = new Logger(MailService.name);
  private readonly appUrl: string;
  private readonly pending = new Set<Promise<void>>();

  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    private readonly quota: MailQuotaService,
    config: ConfigService<Env, true>,
  ) {
    this.appUrl = config.get('APP_URL');
  }

  sendVerifyEmail(user: Recipient, token: string) {
    return this.deliver(
      user,
      verifyEmailTemplate(
        toLocale(user.locale),
        user.displayName,
        this.link('/verify-email', token),
      ),
    );
  }

  sendResetPassword(user: Recipient, token: string) {
    return this.deliver(
      user,
      resetPasswordTemplate(
        toLocale(user.locale),
        user.displayName,
        this.link('/reset-password', token),
      ),
    );
  }

  sendLinkPassword(user: Recipient, token: string) {
    return this.deliver(
      user,
      linkPasswordTemplate(
        toLocale(user.locale),
        user.displayName,
        this.link('/link-password', token),
      ),
    );
  }

  sendGoogleLinked(user: Recipient) {
    return this.deliver(
      user,
      googleLinkedTemplate(
        toLocale(user.locale),
        user.displayName,
        `${this.appUrl}/forgot-password`,
      ),
    );
  }

  /**
   * Prévenance avant suppression pour inactivité. Contrairement aux autres,
   * l'envoi est attendu et une erreur remonte : sans email parti, pas de
   * suppression (voir RetentionService).
   */
  async sendInactivityWarning(
    user: Recipient,
    deletionAt: Date,
  ): Promise<void> {
    if (!(await this.quota.tryConsume())) {
      throw new MailQuotaExceededError();
    }
    await this.transport.send({
      to: { email: user.email, name: user.displayName },
      ...inactivityWarningTemplate(
        toLocale(user.locale),
        user.displayName,
        deletionAt,
        `${this.appUrl}/login`,
      ),
    });
  }

  /** Attend les envois en cours (arrêt de l'application, tests). */
  async flush(): Promise<void> {
    await Promise.all(this.pending);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.flush();
  }

  private link(path: string, token: string) {
    return `${this.appUrl}${path}#token=${encodeURIComponent(token)}`;
  }

  private async deliver(
    user: Recipient,
    template: Omit<Parameters<MailTransport['send']>[0], 'to'>,
  ): Promise<void> {
    // Réservation sur le quota attendue (une requête en base, comme les
    // autres branches de l'auth) ; seul l'appel au fournisseur part en fond.
    if (!(await this.quota.tryConsume())) {
      this.logger.warn(
        `Quota d'emails du jour épuisé : « ${template.subject} » non envoyé`,
      );
      return;
    }
    const sending = this.transport
      .send({ to: { email: user.email, name: user.displayName }, ...template })
      .catch((error: unknown) => {
        this.logger.error(
          `Échec d'envoi de « ${template.subject} »`,
          error instanceof Error ? error.stack : String(error),
        );
      })
      .finally(() => this.pending.delete(sending));
    this.pending.add(sending);
  }
}
