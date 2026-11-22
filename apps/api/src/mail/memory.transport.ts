import type { MailMessage, MailTransport } from './mail-transport.js';

/** Tests : garde les emails en mémoire pour que les tests lisent les liens envoyés. */
export class MemoryMailTransport implements MailTransport {
  readonly outbox: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.outbox.push(message);
    return Promise.resolve();
  }

  /** Derniers emails reçus par une adresse, le plus récent en dernier. */
  to(email: string): MailMessage[] {
    return this.outbox.filter((message) => message.to.email === email);
  }

  clear() {
    this.outbox.length = 0;
  }
}
