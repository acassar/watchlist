import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config.js';
import { MAIL_TRANSPORT, type MailTransport } from './mail-transport.js';
import {
  alreadyRegisteredTemplate,
  googleLinkedTemplate,
  linkPasswordTemplate,
  resetPasswordTemplate,
  verifyEmailTemplate,
} from './templates.js';

interface Recipient {
  email: string;
  displayName: string;
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
 */
@Injectable()
export class MailService implements OnApplicationShutdown {
  private readonly logger = new Logger(MailService.name);
  private readonly appUrl: string;
  private readonly pending = new Set<Promise<void>>();

  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    config: ConfigService<Env, true>,
  ) {
    this.appUrl = config.get('APP_URL');
  }

  sendVerifyEmail(user: Recipient, token: string) {
    return this.deliver(
      user,
      verifyEmailTemplate(user.displayName, this.link('/verify-email', token)),
    );
  }

  sendResetPassword(user: Recipient, token: string) {
    return this.deliver(
      user,
      resetPasswordTemplate(
        user.displayName,
        this.link('/reset-password', token),
      ),
    );
  }

  sendLinkPassword(user: Recipient, token: string) {
    return this.deliver(
      user,
      linkPasswordTemplate(
        user.displayName,
        this.link('/link-password', token),
      ),
    );
  }

  sendAlreadyRegistered(user: Recipient) {
    return this.deliver(
      user,
      alreadyRegisteredTemplate(
        user.displayName,
        `${this.appUrl}/login`,
        `${this.appUrl}/forgot-password`,
      ),
    );
  }

  sendGoogleLinked(user: Recipient) {
    return this.deliver(
      user,
      googleLinkedTemplate(user.displayName, `${this.appUrl}/forgot-password`),
    );
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

  private deliver(
    user: Recipient,
    template: Omit<Parameters<MailTransport['send']>[0], 'to'>,
  ): void {
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
