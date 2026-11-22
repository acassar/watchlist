import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config.js';
import { BrevoMailTransport } from './brevo.transport.js';
import { ConsoleMailTransport } from './console.transport.js';
import { MAIL_TRANSPORT, type MailTransport } from './mail-transport.js';
import { MailService } from './mail.service.js';
import { MemoryMailTransport } from './memory.transport.js';

@Global()
@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): MailTransport => {
        switch (config.get('MAIL_TRANSPORT', { infer: true })) {
          case 'brevo':
            return new BrevoMailTransport(config.get('BREVO_API_KEY') ?? '', {
              email: config.get('MAIL_FROM_EMAIL'),
              name: config.get('MAIL_FROM_NAME'),
            });
          case 'memory':
            return new MemoryMailTransport();
          default:
            return new ConsoleMailTransport();
        }
      },
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
