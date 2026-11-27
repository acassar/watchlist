import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { GoogleStrategy } from '../src/auth/google/google.strategy.js';
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
    'TRUNCATE TABLE users, refresh_tokens, email_tokens, groups, group_members, invitations, media_items, group_titles, member_statuses, mail_daily_counts, email_changes CASCADE',
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

/** Profil renvoyé par l'endpoint userinfo de Google (champs OpenID Connect). */
export interface FakeGoogleUser {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

/**
 * Remplace les deux appels réseau de la stratégie Google (échange du code,
 * lecture du profil) : tout le reste (redirection, cookie d'état, PKCE, liaison
 * des comptes) passe par le vrai code. Renvoie de quoi choisir le prochain
 * profil et inspecter le dernier échange.
 */
export function mockGoogle(app: INestApplication) {
  const strategy = app.get(GoogleStrategy) as unknown as {
    _oauth2: {
      getOAuthAccessToken: (
        code: string,
        params: Record<string, string>,
        cb: (err: unknown, accessToken?: string) => void,
      ) => void;
    };
    userProfile: (
      accessToken: string,
      done: (err: unknown, profile?: unknown) => void,
    ) => void;
  };
  const state: {
    next: FakeGoogleUser | null;
    lastTokenRequest: { code: string; params: Record<string, string> } | null;
  } = { next: null, lastTokenRequest: null };

  strategy._oauth2.getOAuthAccessToken = (code, params, cb) => {
    state.lastTokenRequest = { code, params };
    cb(null, 'fake-access-token');
  };
  strategy.userProfile = (_accessToken, done) => {
    const user = state.next;
    if (!user) return done(new Error('Aucun profil Google simulé'));
    done(null, {
      provider: 'google',
      id: user.sub,
      displayName: user.name ?? '',
      emails: user.email ? [{ value: user.email }] : undefined,
      _json: user,
    });
  };
  return state;
}

/** Crée un compte vérifié et renvoie son id et un en-tête d'auth prêt à l'emploi. */
export async function createUser(t: TestApp, displayName: string) {
  const user = await t.prisma.user.create({
    data: {
      email: `${displayName.toLowerCase()}@exemple.fr`,
      displayName,
      emailVerifiedAt: new Date(),
    },
  });
  // Connexion « à l'instant » (auth_time) : comme après un vrai login.
  const token = await t.app
    .get(JwtService)
    .signAsync({ sub: user.id, auth_time: Math.floor(Date.now() / 1000) });
  return { id: user.id, auth: { authorization: `Bearer ${token}` } };
}
