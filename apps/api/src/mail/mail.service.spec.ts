import type { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../config.js';
import type { MailMessage, MailTransport } from './mail-transport.js';
import { MailService } from './mail.service.js';

const config = {
  get: () => 'https://canapact.test',
} as unknown as ConfigService<Env, true>;
const user = { email: 'alice@example.com', displayName: 'Alice' };

function deferredTransport() {
  let release!: () => void;
  let fail!: (error: Error) => void;
  const sent: MailMessage[] = [];
  const transport: MailTransport = {
    send: (message) => {
      sent.push(message);
      return new Promise<void>((resolve, reject) => {
        release = resolve;
        fail = reject;
      });
    },
  };
  return {
    transport,
    sent,
    release: () => release(),
    fail: (e: Error) => fail(e),
  };
}

describe('MailService', () => {
  it("n'attend pas la fin de l'envoi (la durée de réponse ne révèle pas le compte)", async () => {
    const { transport, sent, release } = deferredTransport();
    const mail = new MailService(transport, config);

    const result: unknown = mail.sendResetPassword(user, 'jeton');

    expect(result).toBeUndefined();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toContain(
      'https://canapact.test/reset-password#token=jeton',
    );

    let flushed = false;
    const flushing = mail.flush().then(() => (flushed = true));
    await Promise.resolve();
    expect(flushed).toBe(false);
    release();
    await flushing;
    expect(flushed).toBe(true);
  });

  it("journalise un échec d'envoi sans le propager", async () => {
    const { transport, fail } = deferredTransport();
    const logged = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const mail = new MailService(transport, config);

    mail.sendVerifyEmail(user, 'jeton');
    fail(new Error('Brevo indisponible'));
    await mail.flush();

    expect(logged).toHaveBeenCalledOnce();
    logged.mockRestore();
  });
});
