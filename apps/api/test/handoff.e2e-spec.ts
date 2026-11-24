import request from 'supertest';
import { hashToken } from '../src/auth/tokens.js';
import {
  createTestApp,
  lastTokenSentTo,
  refreshCookieFrom,
  resetDatabase,
  type TestApp,
} from './helpers.js';

// Passage de l'ancienne adresse à APP_URL sans reconnexion (HandoffController).
describe('Changement d’adresse (e2e)', () => {
  let t: TestApp;
  const email = 'adrien@exemple.fr';
  const http = () => request(t.app.getHttpServer());

  /** Compte vérifié : renvoie la valeur du cookie de refresh. */
  async function session() {
    await http()
      .post('/api/auth/register')
      .send({ email, password: 'canape-du-soir', displayName: 'Adrien' })
      .expect(202);
    const verified = await http()
      .post('/api/auth/verify-email')
      .send({ token: lastTokenSentTo(t.mail, email) })
      .expect(200);
    return refreshCookieFrom(verified.headers)!.value;
  }

  const handoff = (path: string, cookie?: string) => {
    const req = http().get(`/api/auth/handoff${path}`);
    return cookie ? req.set('Cookie', `canapact_rt=${cookie}`) : req;
  };

  const refresh = (cookie: string) =>
    http().post('/api/auth/refresh').set('Cookie', `canapact_rt=${cookie}`);

  /** Jeton et page de destination de la redirection vers handoff-claim. */
  function claimTarget(location: string) {
    const url = new URL(location);
    expect(`${url.origin}${url.pathname}`).toBe(
      'http://canapact.test/api/auth/handoff-claim',
    );
    return {
      token: url.searchParams.get('token')!,
      next: url.searchParams.get('next')!,
    };
  }

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
    t.mail.clear();
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('passe la session à la nouvelle adresse et garde la page demandée', async () => {
    const oldCookie = await session();

    const first = await handoff('/together?g=1&x=2', oldCookie).expect(302);
    expect(first.headers['cache-control']).toBe('no-store');
    // Plus de session sur l'ancienne adresse.
    expect(first.headers['set-cookie']?.[0]).toMatch(/^canapact_rt=;/);
    const { token, next } = claimTarget(first.headers.location);
    expect(next).toBe('/together?g=1&x=2');

    // Le jeton de passage ne vit qu'une minute.
    const stored = await t.prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: hashToken(token) },
    });
    expect(stored.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(60_000);

    const claimed = await http()
      .get('/api/auth/handoff-claim')
      .query({ token, next })
      .expect(302);
    expect(claimed.headers.location).toBe(
      'http://canapact.test/together?g=1&x=2',
    );
    expect(claimed.headers['referrer-policy']).toBe('no-referrer');
    const newCookie = refreshCookieFrom(claimed.headers)!;
    expect(newCookie.raw).toContain('Path=/api/auth');
    expect(newCookie.raw).toContain('HttpOnly');

    const refreshed = await refresh(newCookie.value).expect(200);
    expect(refreshed.body.user.email).toBe(email);
  });

  it('page d’accueil : /api/auth/handoff/ renvoie vers /', async () => {
    const oldCookie = await session();
    const res = await handoff('/', oldCookie).expect(302);
    expect(claimTarget(res.headers.location).next).toBe('/');
  });

  it('sans session, redirige simplement vers la même page', async () => {
    const res = await handoff('/legal/privacy').expect(302);
    expect(res.headers.location).toBe('http://canapact.test/legal/privacy');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('session expirée ou révoquée : redirection simple, cookie effacé', async () => {
    const res = await handoff('/add', 'inconnu').expect(302);
    expect(res.headers.location).toBe('http://canapact.test/add');
    expect(res.headers['set-cookie']?.[0]).toMatch(/^canapact_rt=;/);
  });

  it('refuse les destinations hors du site', async () => {
    const oldCookie = await session();
    const res = await handoff('//evil.example/x', oldCookie).expect(302);
    const { token, next } = claimTarget(res.headers.location);
    expect(next).toBe('/');

    const claimed = await http()
      .get('/api/auth/handoff-claim')
      .query({ token, next: 'https://evil.example' })
      .expect(302);
    expect(claimed.headers.location).toBe('http://canapact.test/');
  });

  it('le jeton de passage ne sert qu’une fois, le rejouer ferme la session', async () => {
    const oldCookie = await session();
    const { token } = claimTarget(
      (await handoff('/', oldCookie).expect(302)).headers.location,
    );
    const claimed = await http()
      .get('/api/auth/handoff-claim')
      .query({ token })
      .expect(302);
    const newCookie = refreshCookieFrom(claimed.headers)!.value;

    const replay = await http()
      .get('/api/auth/handoff-claim')
      .query({ token })
      .expect(302);
    expect(replay.headers.location).toBe('http://canapact.test/');
    expect(refreshCookieFrom(replay.headers)).toBeUndefined();
    // Détection de réutilisation : toute la famille est révoquée.
    await refresh(newCookie).expect(401);
  });

  it('le jeton de passage expire au bout d’une minute', async () => {
    const oldCookie = await session();
    const { token } = claimTarget(
      (await handoff('/', oldCookie).expect(302)).headers.location,
    );
    await t.prisma.refreshToken.update({
      where: { tokenHash: hashToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const claimed = await http()
      .get('/api/auth/handoff-claim')
      .query({ token })
      .expect(302);
    expect(refreshCookieFrom(claimed.headers)).toBeUndefined();
  });

  it('l’ancien cookie ne sert plus après le passage', async () => {
    const oldCookie = await session();
    await handoff('/', oldCookie).expect(302);
    await refresh(oldCookie).expect(401);
  });
});
