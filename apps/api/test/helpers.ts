import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { MAIL_TRANSPORT } from '../src/mail/mail-transport.js';
import { MemoryMailTransport } from '../src/mail/memory.transport.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

export interface TestApp {
  app: INestApplication<App>;
  prisma: PrismaService;
  mail: MemoryMailTransport;
}

export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return {
    app,
    prisma: app.get(PrismaService),
    mail: app.get<MemoryMailTransport>(MAIL_TRANSPORT),
  };
}

/** Vide les tables entre deux tests. */
export async function resetDatabase(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE users, refresh_tokens, email_tokens CASCADE',
  );
}

/** Extrait le jeton du dernier lien envoyé à cette adresse. */
export function lastTokenSentTo(mail: MemoryMailTransport, email: string) {
  const message = mail.to(email).at(-1);
  const match = message?.text.match(/#token=([\w-]+)/);
  if (!match) throw new Error(`Aucun lien envoyé à ${email}`);
  return match[1];
}

/** Valeur du cookie de refresh posé par une réponse, ou undefined. */
export function refreshCookieFrom(headers: Record<string, unknown>) {
  const cookies = (headers['set-cookie'] as string[] | undefined) ?? [];
  const cookie = cookies.find((c) => c.startsWith('canapact_rt='));
  const value = cookie?.split(';')[0].split('=')[1];
  return value ? { value, raw: cookie! } : undefined;
}
