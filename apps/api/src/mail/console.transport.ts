import { Logger } from '@nestjs/common';
import type { MailMessage, MailTransport } from './mail-transport.js';

/** Dev : affiche l'email dans les logs de l'API au lieu de l'envoyer. */
export class ConsoleMailTransport implements MailTransport {
  private readonly logger = new Logger('Mail');

  send(message: MailMessage): Promise<void> {
    this.logger.log(
      `\n──── Email (non envoyé, MAIL_TRANSPORT=console) ────\n` +
        `À : ${message.to.email}\nSujet : ${message.subject}\n\n${message.text}\n` +
        `────────────────────────────────────────────────────`,
    );
    return Promise.resolve();
  }
}
