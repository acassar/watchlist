import request from 'supertest';
import { hashToken } from '../src/auth/tokens.js';
import {
  createTestApp,
  lastTokenSentTo,
  refreshCookieFrom,
  resetDatabase,
  type TestApp,
} from './helpers.js';

// Nécessite une base Postgres (`pnpm db:up`) et DATABASE_URL.
describe('Auth par email (e2e)', () => {
  let t: TestApp;
  const email = 'adrien@exemple.fr';
  const password = 'canape-du-soir';

  const http = () => request(t.app.getHttpServer());
  const register = (body: Record<string, string> = {}) =>
    http()
      .post('/api/auth/register')
      .send({ email, password, displayName: 'Adrien', ...body });

  /** Inscription + clic sur le lien : renvoie la réponse de vérification. */
  async function registerAndVerify() {
    await register().expect(202);
    return http()
      .post('/api/auth/verify-email')
      .send({ token: lastTokenSentTo(t.mail, email) })
      .expect(200);
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

  describe('inscription et vérification', () => {
    it("crée le compte, envoie un lien et n'autorise la connexion qu'après le clic", async () => {
      await register({ email: '  Adrien@Exemple.FR ' }).expect(202);

      const user = await t.prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.emailVerifiedAt).toBeNull();
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(t.mail.to(email)).toHaveLength(1);
      expect(t.mail.to(email)[0].text).toContain(
        'http://canapact.test/verify-email#token=',
      );

      const refused = await http()
        .post('/api/auth/login')
        .send({ email, password })
        .expect(403);
      expect(refused.body.code).toBe('EMAIL_NOT_VERIFIED');

      const verified = await http()
        .post('/api/auth/verify-email')
        .send({ token: lastTokenSentTo(t.mail, email) })
        .expect(200);
      expect(verified.body.user).toMatchObject({ email, emailVerified: true });
      expect(verified.body.accessToken).toEqual(expect.any(String));
      const cookie = refreshCookieFrom(verified.headers);
      expect(cookie?.raw).toContain('HttpOnly');
      expect(cookie?.raw).toContain('SameSite=Strict');
      expect(cookie?.raw).toContain('Path=/api/auth');
    });

    it('refuse un lien déjà utilisé ou inconnu', async () => {
      await register().expect(202);
      const token = lastTokenSentTo(t.mail, email);
      await http().post('/api/auth/verify-email').send({ token }).expect(200);

      const reused = await http()
        .post('/api/auth/verify-email')
        .send({ token })
        .expect(401);
      expect(reused.body.code).toBe('INVALID_TOKEN');
      await http()
        .post('/api/auth/verify-email')
        .send({ token: 'inconnu' })
        .expect(401);
    });

    it('refuse un lien expiré', async () => {
      await register().expect(202);
      const token = lastTokenSentTo(t.mail, email);
      await t.prisma.emailToken.update({
        where: { tokenHash: hashToken(token) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await http().post('/api/auth/verify-email').send({ token }).expect(401);
    });

    it('valide les champs avec les schémas partagés', async () => {
      const res = await register({
        email: 'pas-un-email',
        password: 'court',
      }).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.issues).toEqual(
        expect.arrayContaining([
          { path: 'email', message: 'validation.email' },
          { path: 'password', message: 'validation.passwordTooShort' },
        ]),
      );
    });

    it('répond pareil pour une adresse déjà inscrite, et prévient son titulaire', async () => {
      await registerAndVerify();
      t.mail.clear();

      await register({ password: 'autre-mot-de-passe' }).expect(202);

      expect(t.mail.to(email)).toHaveLength(1);
      expect(t.mail.to(email)[0].subject).toContain('déjà un compte');
      // Le mot de passe d'origine reste le seul valide.
      await http()
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);
      await http()
        .post('/api/auth/login')
        .send({ email, password: 'autre-mot-de-passe' })
        .expect(401);
    });

    it("compte jamais vérifié : le lien appliqué est celui de l'inscription qui l'a produit", async () => {
      await register({ password: 'premier-essai' }).expect(202);
      // Passe le délai anti-spam entre deux emails.
      await t.prisma.emailToken.updateMany({
        data: { createdAt: new Date(Date.now() - 120_000) },
      });
      await register({ password: 'second-essai' }).expect(202);
      expect(t.mail.to(email)).toHaveLength(2);

      await http()
        .post('/api/auth/verify-email')
        .send({ token: lastTokenSentTo(t.mail, email) })
        .expect(200);

      await http()
        .post('/api/auth/login')
        .send({ email, password: 'second-essai' })
        .expect(200);
      await http()
        .post('/api/auth/login')
        .send({ email, password: 'premier-essai' })
        .expect(401);
    });

    it("renvoie le lien sur demande, sans révéler si l'adresse existe", async () => {
      await register().expect(202);
      await t.prisma.emailToken.updateMany({
        data: { createdAt: new Date(Date.now() - 120_000) },
      });

      await http()
        .post('/api/auth/verify-email/resend')
        .send({ email })
        .expect(202);
      await http()
        .post('/api/auth/verify-email/resend')
        .send({ email: 'inconnu@exemple.fr' })
        .expect(202);
      expect(t.mail.to(email)).toHaveLength(2);
      expect(t.mail.to('inconnu@exemple.fr')).toHaveLength(0);
    });

    it("n'envoie pas deux emails du même type en moins d'une minute", async () => {
      await register().expect(202);
      await http()
        .post('/api/auth/verify-email/resend')
        .send({ email })
        .expect(202);
      expect(t.mail.to(email)).toHaveLength(1);
    });
  });

  describe('connexion et session', () => {
    it('refuse un mauvais mot de passe ou une adresse inconnue avec le même message', async () => {
      await registerAndVerify();
      const wrong = await http()
        .post('/api/auth/login')
        .send({ email, password: 'mauvais-mot-de-passe' })
        .expect(401);
      const unknown = await http()
        .post('/api/auth/login')
        .send({ email: 'inconnu@exemple.fr', password })
        .expect(401);
      expect(wrong.body).toEqual(unknown.body);
      expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('protège /api/me par le JWT', async () => {
      await registerAndVerify();
      const login = await http()
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);

      await http().get('/api/me').expect(401);
      await http()
        .get('/api/me')
        .set('Authorization', 'Bearer pas-un-jwt')
        .expect(401);
      const me = await http()
        .get('/api/me')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(200);
      expect(me.body).toMatchObject({ email, displayName: 'Adrien' });
    });

    it('fait tourner le refresh token et révoque la session si un ancien jeton revient', async () => {
      const verified = await registerAndVerify();
      const first = refreshCookieFrom(verified.headers)!.value;

      const refreshed = await http()
        .post('/api/auth/refresh')
        .set('Cookie', `canapact_rt=${first}`)
        .expect(200);
      expect(refreshed.body.accessToken).toEqual(expect.any(String));
      const second = refreshCookieFrom(refreshed.headers)!.value;
      expect(second).not.toBe(first);

      // Réutilisation de l'ancien jeton : vol présumé, toute la session tombe.
      await http()
        .post('/api/auth/refresh')
        .set('Cookie', `canapact_rt=${first}`)
        .expect(401);
      await http()
        .post('/api/auth/refresh')
        .set('Cookie', `canapact_rt=${second}`)
        .expect(401);
    });

    it('refuse un refresh sans cookie ou expiré', async () => {
      await http().post('/api/auth/refresh').expect(401);

      const verified = await registerAndVerify();
      const token = refreshCookieFrom(verified.headers)!.value;
      await t.prisma.refreshToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const res = await http()
        .post('/api/auth/refresh')
        .set('Cookie', `canapact_rt=${token}`)
        .expect(401);
      expect(refreshCookieFrom(res.headers)).toBeUndefined();
      expect(res.headers['set-cookie']?.[0]).toContain('canapact_rt=;');
    });

    it('déconnecte cet appareil seulement', async () => {
      const verified = await registerAndVerify();
      const phone = refreshCookieFrom(verified.headers)!.value;
      const laptopLogin = await http()
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);
      const laptop = refreshCookieFrom(laptopLogin.headers)!.value;

      await http()
        .post('/api/auth/logout')
        .set('Cookie', `canapact_rt=${phone}`)
        .expect(204);

      await http()
        .post('/api/auth/refresh')
        .set('Cookie', `canapact_rt=${phone}`)
        .expect(401);
      await http()
        .post('/api/auth/refresh')
        .set('Cookie', `canapact_rt=${laptop}`)
        .expect(200);
    });
  });

  describe('mot de passe oublié', () => {
    it('envoie un lien, change le mot de passe et ferme toutes les sessions', async () => {
      const verified = await registerAndVerify();
      const session = refreshCookieFrom(verified.headers)!.value;

      await http()
        .post('/api/auth/password/forgot')
        .send({ email })
        .expect(202);
      const token = lastTokenSentTo(t.mail, email);
      expect(t.mail.to(email).at(-1)?.text).toContain('/reset-password#token=');

      await http()
        .post('/api/auth/password/reset')
        .send({ token, password: 'nouveau-mot-de-passe' })
        .expect(204);

      await http()
        .post('/api/auth/login')
        .send({ email, password })
        .expect(401);
      await http()
        .post('/api/auth/login')
        .send({ email, password: 'nouveau-mot-de-passe' })
        .expect(200);
      await http()
        .post('/api/auth/refresh')
        .set('Cookie', `canapact_rt=${session}`)
        .expect(401);
      // Le lien ne sert qu'une fois.
      await http()
        .post('/api/auth/password/reset')
        .send({ token, password: 'encore-un-autre' })
        .expect(401);
    });

    it("répond pareil pour une adresse inconnue, sans envoyer d'email", async () => {
      await http()
        .post('/api/auth/password/forgot')
        .send({ email: 'inconnu@exemple.fr' })
        .expect(202);
      expect(t.mail.outbox).toHaveLength(0);
    });

    it("vérifie l'adresse d'un compte jamais confirmé (le clic prouve l'accès à la boîte)", async () => {
      await register().expect(202);
      await http()
        .post('/api/auth/password/forgot')
        .send({ email })
        .expect(202);
      await http()
        .post('/api/auth/password/reset')
        .send({
          token: lastTokenSentTo(t.mail, email),
          password: 'nouveau-mot-de-passe',
        })
        .expect(204);
      await http()
        .post('/api/auth/login')
        .send({ email, password: 'nouveau-mot-de-passe' })
        .expect(200);
    });
  });

  describe('adresse déjà liée à Google (préparation étape 3)', () => {
    beforeEach(async () => {
      await t.prisma.user.create({
        data: {
          email,
          googleId: 'google-123',
          displayName: 'Adrien G.',
          emailVerifiedAt: new Date(),
        },
      });
    });

    it("n'ajoute un mot de passe qu'après le clic sur le lien envoyé par email", async () => {
      await register().expect(202);

      const mail = t.mail.to(email).at(-1);
      expect(mail?.subject).toBe('Ajouter un mot de passe à votre compte');
      expect(mail?.text).toContain('/link-password#token=');
      // Avant le clic : pas de mot de passe, connexion impossible.
      await http()
        .post('/api/auth/login')
        .send({ email, password })
        .expect(401);

      const confirmed = await http()
        .post('/api/auth/password/link/confirm')
        .send({
          token: lastTokenSentTo(t.mail, email),
          password: 'choisi-au-clic',
        })
        .expect(200);
      expect(confirmed.body.user.displayName).toBe('Adrien G.');

      await http()
        .post('/api/auth/login')
        .send({ email, password: 'choisi-au-clic' })
        .expect(200);
      const user = await t.prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.googleId).toBe('google-123');
    });

    it("ignore le mot de passe de l'inscription : un inconnu ne peut pas faire valider le sien", async () => {
      // Un inconnu s'inscrit avec l'adresse du compte Google, avec son mot de passe.
      await register().expect(202);
      // Le vrai propriétaire clique le lien reçu et choisit son mot de passe.
      await http()
        .post('/api/auth/password/link/confirm')
        .send({
          token: lastTokenSentTo(t.mail, email),
          password: 'celui-du-proprio',
        })
        .expect(200);

      await http()
        .post('/api/auth/login')
        .send({ email, password })
        .expect(401);
    });

    it('exige un mot de passe valide pour confirmer', async () => {
      await register().expect(202);
      await http()
        .post('/api/auth/password/link/confirm')
        .send({ token: lastTokenSentTo(t.mail, email) })
        .expect(400);
    });

    it("n'accepte pas un jeton d'un autre type", async () => {
      await register().expect(202);
      await http()
        .post('/api/auth/verify-email')
        .send({ token: lastTokenSentTo(t.mail, email) })
        .expect(401);
    });
  });
});
