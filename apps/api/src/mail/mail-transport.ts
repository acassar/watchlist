/** Un email prêt à partir. */
export interface MailMessage {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
}

/**
 * Adaptateur d'envoi. Le reste de l'API ne connaît que cette interface :
 * changer de fournisseur = une nouvelle implémentation.
 */
export interface MailTransport {
  send(message: MailMessage): Promise<void>;
}

/** Jeton d'injection Nest du transport choisi par MAIL_TRANSPORT. */
export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');
