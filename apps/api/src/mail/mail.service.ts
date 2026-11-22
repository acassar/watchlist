import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config.js';
import { MAIL_TRANSPORT, type MailTransport } from './mail-transport.js';
import {
  alreadyRegisteredTemplate,
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
 * Un échec d'envoi est journalisé sans faire échouer la requête : la réponse reste
 * identique que l'email existe ou non (pas d'énumération des comptes), et
 * l'utilisateur peut redemander un lien.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly appUrl: string;

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

  private link(path: string, token: string) {
    return `${this.appUrl}${path}#token=${encodeURIComponent(token)}`;
  }

  private async deliver(
    user: Recipient,
    template: Omit<Parameters<MailTransport['send']>[0], 'to'>,
  ) {
    try {
      await this.transport.send({
        to: { email: user.email, name: user.displayName },
        ...template,
      });
    } catch (error) {
      this.logger.error(
        `Échec d'envoi de « ${template.subject} »`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
