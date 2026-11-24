import { createHash } from 'node:crypto';
import request from 'supertest';
import {
  createTestApp,
  lastTokenSentTo,
  mockGoogle,
  refreshCookieFrom,
  resetDatabase,
  type FakeGoogleUser,
  type TestApp,
} from './helpers.js';

// Nécessite une base Postgres (`pnpm db:up`) et DATABASE_URL.
describe('Connexion avec Google (e2e)', () => {
  let t: TestApp;
  let google: ReturnType<typeof mockGoogle>;
  const email = 'adrien@exemple.fr';
  const password = 'canape-du-soir';
  const googleUser: FakeGoogleUser = {
    sub: 'google-sub-1',
    email,
    email_verified: true,
    name: 'Adrien Google',
  };

  const http = () => request(t.app.getHttpServer());

  /** Départ vers Google : renvoie l'URL de Google et le cookie d'état posé. */
  async function start(next?: string, locale?: string) {
    const res = await http()
      .get('/api/auth/google')
      .query({
        ...(next === undefined ? {} : { next }),
        ...(locale === undefined ? {} : { locale }),
      })
      .expect(302);
    const location = new URL(res.headers.location as string);
    const cookies = (res.headers['set-cookie'] as unknown as string[]) ?? [];
    const stateCookie = cookies.find((c) => c.startsWith('canapact_oauth='));
    return { location, stateCookie };
  }

  /** Aller-retour complet chez Google avec le profil donné. */
  async function signInWithGoogle(
    user: FakeGoogleUser,
    next?: string,
    locale?: string,
  ) {
    google.next = user;
    const { location, stateCookie } = await start(next, locale);
    return http()
      .get('/api/auth/google/callback')
      .query({ code: 'code-google', state: location.searchParams.get('state') })
      .set('Cookie', stateCookie!.split(';')[0])
      .expect(302);
  }

  const register = (body: Record<string, string> = {}) =>
    http()
      .post('/api/auth/register')
      .send({ email, password, displayName: 'Adrien', ...body })
      .expect(202);

  beforeAll(async () => {
    t = await createTestApp();
    google = mockGoogle(t.app);
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
    t.mail.clear();
    google.next = null;
    google.lastTokenRequest = null;
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('annonce que Google est disponible', async () => {
    const res = await http().get('/api/auth/providers').expect(200);
    expect(res.body).toEqual({ google: true });
  });

  describe('aller-retour OAuth', () => {
    it('redirige vers Google avec state, PKCE et cookie d’état Lax', async () => {
      const { location, stateCookie } = await start('/together');

      expect(location.origin).toBe('https://accounts.google.com');
      const params = location.searchParams;
      expect(params.get('client_id')).toBe(
        'e2e-client-id.apps.googleusercontent.com',
      );
      expect(params.get('redirect_uri')).toBe(
        'http://canapact.test/api/auth/google/callback',
      );
      expect(params.get('scope')).toBe('openid profile email');
      expect(params.get('code_challenge_method')).toBe('S256');
      expect(params.get('code_challenge')).toEqual(expect.any(String));
      expect(params.get('state')).toEqual(expect.any(String));
      expect(params.get('prompt')).toBe('select_account');

      expect(stateCookie).toContain('HttpOnly');
      expect(stateCookie).toContain('SameSite=Lax');
      expect(stateCookie).toContain('Path=/api/auth/google');
    });

    it('envoie à Google le vérificateur PKCE qui correspond au challenge', async () => {
      google.next = googleUser;
      const { location, stateCookie } = await start();
      await http()
        .get('/api/auth/google/callback')
        .query({ code: 'code-123', state: location.searchParams.get('state') })
        .set('Cookie', stateCookie!.split(';')[0])
        .expect(302);

      const verifier = google.lastTokenRequest?.params.code_verifier ?? '';
      const challenge = createHash('sha256')
        .update(verifier)
        .digest('base64url');
      expect(challenge).toBe(location.searchParams.get('code_challenge'));
      expect(google.lastTokenRequest?.code).toBe('code-123');
    });

    it('refuse un retour sans cookie d’état (CSRF de connexion)', async () => {
      google.next = googleUser;
      const { location } = await start();
      const res = await http()
        .get('/api/auth/google/callback')
        .query({ code: 'x', state: location.searchParams.get('state') })
        .expect(302);

      expect(res.headers.location).toBe(
        'http://canapact.test/login?error=google_failed',
      );
      expect(refreshCookieFrom(res.headers)).toBeUndefined();
      expect(await t.prisma.user.count()).toBe(0);
    });

    it('refuse un state qui ne correspond pas au cookie', async () => {
      google.next = googleUser;
      const { stateCookie } = await start();
      const res = await http()
        .get('/api/auth/google/callback')
        .query({ code: 'x', state: 'state-d-un-autre' })
        .set('Cookie', stateCookie!.split(';')[0])
        .expect(302);
      expect(res.headers.location).toContain('error=google_failed');
    });

    it('refuse un cookie d’état falsifié', async () => {
      google.next = googleUser;
      const { location, stateCookie } = await start();
      const [, value] = stateCookie!.split(';')[0].split('=');
      const [payload] = decodeURIComponent(value).split('.');
      const res = await http()
        .get('/api/auth/google/callback')
        .query({ code: 'x', state: location.searchParams.get('state') })
        .set('Cookie', `canapact_oauth=${payload}.signature-inventee`)
        .expect(302);
      expect(res.headers.location).toContain('error=google_failed');
    });

    it('ne rejoue pas un cookie d’état : il est effacé au retour', async () => {
      const res = await signInWithGoogle(googleUser);
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies.find((c) => c.startsWith('canapact_oauth='))).toMatch(
        /Expires=Thu, 01 Jan 1970/,
      );
    });

    it('revient sur la connexion avec un message si l’utilisateur annule', async () => {
      await start();
      const res = await http()
        .get('/api/auth/google/callback')
        .query({ error: 'access_denied' })
        .expect(302);
      expect(res.headers.location).toBe(
        'http://canapact.test/login?error=google_cancelled',
      );
    });

    it('renvoie vers la page demandée, jamais vers un autre site', async () => {
      const ok = await signInWithGoogle(googleUser, '/together?g=1');
      expect(ok.headers.location).toBe('http://canapact.test/together?g=1');

      const evil = await signInWithGoogle(googleUser, '//evil.example');
      expect(evil.headers.location).toBe('http://canapact.test/');
    });

    it('répond 404 sur une route inconnue sous /google', async () => {
      await http().get('/api/auth/google/autre').expect(404);
    });
  });

  describe('création et liaison des comptes', () => {
    it('crée un compte vérifié sans mot de passe et ouvre une session', async () => {
      const res = await signInWithGoogle(googleUser);

      const user = await t.prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user).toMatchObject({
        googleId: 'google-sub-1',
        passwordHash: null,
        displayName: 'Adrien Google',
      });
      expect(user.emailVerifiedAt).not.toBeNull();

      const cookie = refreshCookieFrom(res.headers);
      expect(cookie?.raw).toContain('SameSite=Strict');
      const refreshed = await http()
        .post('/api/auth/refresh')
        .set('Cookie', `canapact_rt=${cookie!.value}`)
        .expect(200);
      expect(refreshed.body.user).toMatchObject({ email, emailVerified: true });
      expect(t.mail.to(email)).toHaveLength(0);
    });

    it('crée le compte dans la langue de l’écran de départ', async () => {
      await signInWithGoogle(googleUser, undefined, 'en');
      const user = await t.prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.locale).toBe('en');
    });

    it('garde la langue d’un compte existant et ignore une langue inconnue', async () => {
      await signInWithGoogle(googleUser, undefined, 'de');
      expect(
        (await t.prisma.user.findUniqueOrThrow({ where: { email } })).locale,
      ).toBe('fr');
      await signInWithGoogle(googleUser, undefined, 'en');
      expect(
        (await t.prisma.user.findUniqueOrThrow({ where: { email } })).locale,
      ).toBe('fr');
    });

    it('reconnaît un compte déjà lié, même si l’adresse Google a changé', async () => {
      await signInWithGoogle(googleUser);
      const res = await signInWithGoogle({
        ...googleUser,
        email: 'nouvelle@exemple.fr',
      });

      expect(refreshCookieFrom(res.headers)).toBeDefined();
      expect(await t.prisma.user.count()).toBe(1);
      // L'adresse du compte Canapact ne suit pas celle de Google.
      const user = await t.prisma.user.findFirstOrThrow();
      expect(user.email).toBe(email);
    });

    it('normalise l’adresse donnée par Google', async () => {
      await signInWithGoogle({ ...googleUser, email: 'Adrien@Exemple.FR' });
      await t.prisma.user.findUniqueOrThrow({ where: { email } });
    });

    it('refuse une adresse que Google ne garantit pas', async () => {
      const res = await signInWithGoogle({
        ...googleUser,
        email_verified: false,
      });
      expect(res.headers.location).toBe(
        'http://canapact.test/login?error=google_email_not_verified',
      );
      expect(await t.prisma.user.count()).toBe(0);
    });

    it('lie automatiquement un compte email vérifié et prévient par email', async () => {
      await register();
      await http()
        .post('/api/auth/verify-email')
        .send({ token: lastTokenSentTo(t.mail, email) })
        .expect(200);
      t.mail.clear();

      const res = await signInWithGoogle(googleUser);
      expect(refreshCookieFrom(res.headers)).toBeDefined();

      const user = await t.prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.googleId).toBe('google-sub-1');
      expect(user.displayName).toBe('Adrien');
      expect(t.mail.to(email).at(-1)?.subject).toBe(
        'Votre compte Google est lié à Canapact',
      );
      // Le mot de passe reste valable.
      await http()
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);
    });

    it('refuse de lier une adresse déjà liée à un autre compte Google', async () => {
      await signInWithGoogle(googleUser);
      const res = await signInWithGoogle({
        ...googleUser,
        sub: 'google-sub-2',
      });
      expect(res.headers.location).toBe(
        'http://canapact.test/login?error=google_account_conflict',
      );
      const user = await t.prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.googleId).toBe('google-sub-1');
    });

    it('supporte deux retours simultanés pour le même nouveau compte', async () => {
      google.next = googleUser;
      const [a, b] = await Promise.all([start(), start()]);
      const callback = (s: Awaited<ReturnType<typeof start>>) =>
        http()
          .get('/api/auth/google/callback')
          .query({ code: 'c', state: s.location.searchParams.get('state') })
          .set('Cookie', s.stateCookie!.split(';')[0])
          .expect(302);
      const results = await Promise.all([callback(a), callback(b)]);
      for (const res of results) {
        expect(refreshCookieFrom(res.headers)).toBeDefined();
      }
      expect(await t.prisma.user.count()).toBe(1);
    });
  });

  describe('pré-détournement de compte', () => {
    // Un inconnu crée un compte avec l'adresse de la victime et son propre mot
    // de passe, sans pouvoir le vérifier, puis attend que la victime arrive par Google.
    const attackerPassword = 'mot-de-passe-pirate';

    beforeEach(async () => {
      await register({ password: attackerPassword, displayName: 'Pirate' });
      t.mail.clear();
    });

    it('efface le mot de passe et le nom posés par l’inscrit inconnu', async () => {
      const res = await signInWithGoogle(googleUser);
      expect(refreshCookieFrom(res.headers)).toBeDefined();

      const user = await t.prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user).toMatchObject({
        googleId: 'google-sub-1',
        passwordHash: null,
        displayName: 'Adrien Google',
      });
      expect(user.emailVerifiedAt).not.toBeNull();

      await http()
        .post('/api/auth/login')
        .send({ email, password: attackerPassword })
        .expect(401);
    });

    it('invalide le lien de vérification qui portait le mot de passe de l’inconnu', async () => {
      // Lien envoyé à la boîte de la victime, que l'on retrouve via un renvoi.
      await t.prisma.emailToken.updateMany({
        data: { createdAt: new Date(0) },
      });
      await http()
        .post('/api/auth/verify-email/resend')
        .send({ email })
        .expect(202);
      const pendingToken = lastTokenSentTo(t.mail, email);

      await signInWithGoogle(googleUser);

      await http()
        .post('/api/auth/verify-email')
        .send({ token: pendingToken })
        .expect(401);
      const user = await t.prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.passwordHash).toBeNull();
    });

    it('laisse ensuite le vrai propriétaire choisir son mot de passe par email', async () => {
      await signInWithGoogle(googleUser);
      // L'inconnu revient à la charge avec une nouvelle inscription.
      await register({ password: 'mot-de-passe-de-l-inconnu' });

      expect(t.mail.to(email).at(-1)?.subject).toBe(
        'Ajouter un mot de passe à votre compte',
      );
      // Le propriétaire clique le lien : il choisit son mot de passe, celui de
      // l'inscription n'est pas repris.
      await http()
        .post('/api/auth/password/link/confirm')
        .send({
          token: lastTokenSentTo(t.mail, email),
          password: 'mon-vrai-mot-de-passe',
        })
        .expect(200);
      await http()
        .post('/api/auth/login')
        .send({ email, password: 'mon-vrai-mot-de-passe' })
        .expect(200);
      await http()
        .post('/api/auth/login')
        .send({ email, password: 'mot-de-passe-de-l-inconnu' })
        .expect(401);
    });
  });
});
