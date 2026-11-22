import type { MailMessage, MailTransport } from './mail-transport.js';

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

/** Prod : envoi via l'API transactionnelle de Brevo (société et données dans l'UE). */
export class BrevoMailTransport implements MailTransport {
  constructor(
    private readonly apiKey: string,
    private readonly sender: { email: string; name: string },
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async send(message: MailMessage): Promise<void> {
    const response = await this.fetchFn(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: this.sender,
        to: [message.to],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      // Le corps de Brevo décrit l'erreur sans contenir l'email : on peut le journaliser.
      const detail = await response.text().catch(() => '');
      throw new Error(`Brevo a refusé l'email (${response.status}) ${detail}`);
    }
  }
}
