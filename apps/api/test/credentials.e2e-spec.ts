import request from 'supertest';
import {
  createTestApp,
  lastTokenSentTo,
  refreshCookieFrom,
  resetDatabase,
  type TestApp,
} from './helpers.js';

// Nécessite une base Postgres (`pnpm db:up`) et DATABASE_URL.
describe('Mot de passe et adresse depuis les réglages (e2e)', () => {
  let t: TestApp;
  const email = 'adrien@exemple.fr';
  const password = 'canape-du-soir';
  const newEmail = 'adrien@nouveau.fr';

  const http = () => request(t.app.getHttpServer());

  /** Compte vérifié et connecté : JWT d'accès et cookie de session. */
  async function signUp(address = email) {
    await http()
      .post('/api/auth/register')
      .send({ email: address, password, displayName: 'Adrien' })
      .expect(202);
    const res = await http()
      .post('/api/auth/verify-email')
      .send({ token: lastTokenSentTo(t.mail, address) })
      .expect(200);
    return {
      id: res.body.user.id as string,
      auth: { authorization: `Bearer ${res.body.accessToken}` },
      cookie: refreshCookieFrom(res.headers)!.raw,
    };
  }

  function login(address = email, pwd = password) {
    return http()
      .post('/api/auth/login')
      .send({ email: address, password: pwd });
  }

  function requestChange(
    user: { auth: Record<string, string> },
    to = newEmail,
  ) {
    return http()
      .post('/api/auth/email/change')
      .set(user.auth)
      .send({ newEmail: to, password });
  }

  /** Demande + clic sur le lien reçu à la nouvelle adresse. */
  async function changeEmail(
    user: { auth: Record<string, string> },
    to: string,
  ) {
    await requestChange(user, to).expect(202);
    await http()
      .post('/api/auth/email/confirm')
      .send({ token: lastTokenSentTo(t.mail, to) })
      .expect(204);
    // Hors du délai anti-spam entre deux liens du même type.
    await t.prisma.emailToken.updateMany({
      data: { createdAt: new Date(Date.now() - 120_000) },
    });
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

  describe('mot de passe', () => {
    it('change le mot de passe, garde cet appareil et déconnecte les autres', async () => {
      const user = await signUp();
      const other = refreshCookieFrom((await login().expect(200)).headers)!.raw;

      await http()
        .post('/api/auth/password/change')
        .set(user.auth)
        .set('Cookie', user.cookie)
        .send({ currentPassword: password, newPassword: 'plaid-et-tisane' })
        .expect(204);

      await login().expect(401);
      await login(email, 'plaid-et-tisane').expect(200);
      await http()
        .post('/api/auth/refresh')
        .set('Cookie', user.cookie)
        .expect(200);
      await http().post('/api/auth/refresh').set('Cookie', other).expect(401);

      const notice = t.mail.to(email).at(-1)!;
      expect(notice.subject).toBe('Votre mot de passe a changé');
      expect(notice.text).toContain('http://canapact.test/forgot-password');
    });

    it('refuse un mot de passe actuel faux', async () => {
      const user = await signUp();
      const res = await http()
        .post('/api/auth/password/change')
        .set(user.auth)
        .send({ currentPassword: 'pas-le-bon', newPassword: 'plaid-et-tisane' })
        .expect(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
      await login().expect(200);
    });

    it('refuse un compte Google sans mot de passe', async () => {
      const user = await signUp();
      await t.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: null, googleId: 'g-1' },
      });
      const res = await http()
        .post('/api/auth/password/change')
        .set(user.auth)
        .send({ currentPassword: 'x', newPassword: 'plaid-et-tisane' })
        .expect(400);
      expect(res.body.code).toBe('NO_PASSWORD');
    });

    it('exige d’être connecté', async () => {
      await http()
        .post('/api/auth/password/change')
        .send({ currentPassword: password, newPassword: 'plaid-et-tisane' })
        .expect(401);
    });
  });

  describe('adresse', () => {
    it("ne change l'adresse qu'au clic, puis prévient l'ancienne", async () => {
      const user = await signUp();
      await requestChange(user, ' Adrien@Nouveau.FR ').expect(202);

      const link = t.mail.to(newEmail).at(-1)!;
      expect(link.text).toContain('http://canapact.test/confirm-email#token=');
      // Pas encore changée : connexion toujours avec l'ancienne.
      await login().expect(200);
      await login(newEmail).expect(401);

      await http()
        .post('/api/auth/email/confirm')
        .send({ token: lastTokenSentTo(t.mail, newEmail) })
        .expect(204);

      await login().expect(401);
      await login(newEmail).expect(200);
      const notice = t.mail.to(email).at(-1)!;
      expect(notice.subject).toBe('L’adresse de votre compte a changé');
      expect(notice.text).toContain(newEmail);
      expect(notice.text).toContain('http://canapact.test/revert-email#token=');

      // Le lien ne sert qu'une fois.
      const again = await http()
        .post('/api/auth/email/confirm')
        .send({ token: lastTokenSentTo(t.mail, newEmail) })
        .expect(401);
      expect(again.body.code).toBe('INVALID_TOKEN');
    });

    it('refuse un mauvais mot de passe, la même adresse, une adresse prise', async () => {
      const user = await signUp();
      await signUp('camille@exemple.fr');

      const wrong = await http()
        .post('/api/auth/email/change')
        .set(user.auth)
        .send({ newEmail, password: 'pas-le-bon' })
        .expect(401);
      expect(wrong.body.code).toBe('INVALID_CREDENTIALS');

      const same = await requestChange(user, email).expect(400);
      expect(same.body.code).toBe('SAME_EMAIL');

      const taken = await requestChange(user, 'camille@exemple.fr').expect(409);
      expect(taken.body.code).toBe('EMAIL_ALREADY_REGISTERED');
      expect(t.mail.to(newEmail)).toHaveLength(0);
    });

    it('prend la place d’une inscription jamais confirmée', async () => {
      const user = await signUp();
      await http()
        .post('/api/auth/register')
        .send({ email: newEmail, password, displayName: 'Autre' })
        .expect(202);

      await changeEmail(user, newEmail);
      const owner = await t.prisma.user.findUniqueOrThrow({
        where: { email: newEmail },
      });
      expect(owner.id).toBe(user.id);
    });

    it('refuse au clic si l’adresse a été prise entre-temps', async () => {
      const user = await signUp();
      await requestChange(user).expect(202);
      const token = lastTokenSentTo(t.mail, newEmail);
      await signUp(newEmail);

      const res = await http()
        .post('/api/auth/email/confirm')
        .send({ token })
        .expect(409);
      expect(res.body.code).toBe('EMAIL_ALREADY_REGISTERED');
      await login().expect(200);
    });

    it('limite à 2 changements confirmés sur 30 jours', async () => {
      const user = await signUp();
      await changeEmail(user, 'a1@exemple.fr');
      await changeEmail(user, 'a2@exemple.fr');

      const res = await requestChange(user, 'a3@exemple.fr').expect(429);
      expect(res.body.code).toBe('EMAIL_CHANGE_LIMIT');

      // Au-delà de 30 jours, les anciens changements ne comptent plus.
      await t.prisma.emailChange.updateMany({
        data: { changedAt: new Date(Date.now() - 31 * 86_400_000) },
      });
      await changeEmail(user, 'a3@exemple.fr');
    });

    it('la limite tient aussi au clic (liens demandés avant)', async () => {
      const user = await signUp();
      await requestChange(user, 'a1@exemple.fr').expect(202);
      const first = lastTokenSentTo(t.mail, 'a1@exemple.fr');
      await t.prisma.emailChange.createMany({
        data: [{ userId: user.id }, { userId: user.id }],
      });
      const res = await http()
        .post('/api/auth/email/confirm')
        .send({ token: first })
        .expect(429);
      expect(res.body.code).toBe('EMAIL_CHANGE_LIMIT');
    });

    it('refuse si le quota d’emails du jour est épuisé, sans consommer le lien', async () => {
      const user = await signUp();
      await requestChange(user).expect(202);
      const token = lastTokenSentTo(t.mail, newEmail);
      const day = new Date(new Date().toISOString().slice(0, 10));
      await t.prisma.mailDailyCount.upsert({
        where: { day },
        create: { day, count: 10_000 },
        update: { count: 10_000 },
      });

      const res = await http()
        .post('/api/auth/email/confirm')
        .send({ token })
        .expect(503);
      expect(res.body.code).toBe('MAIL_QUOTA_EXCEEDED');

      await t.prisma.mailDailyCount.deleteMany();
      await http().post('/api/auth/email/confirm').send({ token }).expect(204);
    });
  });

  describe('« ce n’est pas moi »', () => {
    it("remet l'ancienne adresse, le nouveau mot de passe, et ferme tout", async () => {
      const user = await signUp();
      await changeEmail(user, newEmail);
      // L'intrus lie son compte Google après le changement.
      await t.prisma.user.update({
        where: { id: user.id },
        data: { googleId: 'g-intrus' },
      });
      const revert = lastTokenSentTo(t.mail, email);

      await http()
        .post('/api/auth/email/revert')
        .send({ token: revert, password: 'reprendre-la-main' })
        .expect(204);

      const after = await t.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(after.email).toBe(email);
      expect(after.googleId).toBeNull();
      await login(newEmail, 'reprendre-la-main').expect(401);
      await login(email, password).expect(401);
      await login(email, 'reprendre-la-main').expect(200);
      await http()
        .post('/api/auth/refresh')
        .set('Cookie', user.cookie)
        .expect(401);

      await http()
        .post('/api/auth/email/revert')
        .send({ token: revert, password: 'encore-une-fois' })
        .expect(401);
    });

    it('garde le compte Google lié avant le changement', async () => {
      const user = await signUp();
      await t.prisma.user.update({
        where: { id: user.id },
        data: { googleId: 'g-adrien' },
      });
      await changeEmail(user, newEmail);
      const revert = lastTokenSentTo(t.mail, email);

      await http()
        .post('/api/auth/email/revert')
        .send({ token: revert, password: 'reprendre-la-main' })
        .expect(204);
      const kept = await t.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(kept.googleId).toBe('g-adrien');
    });

    it('remet le compte Google d’avant s’il a été remplacé', async () => {
      const user = await signUp();
      await t.prisma.user.update({
        where: { id: user.id },
        data: { googleId: 'g-adrien' },
      });
      await changeEmail(user, newEmail);
      await t.prisma.user.update({
        where: { id: user.id },
        data: { googleId: 'g-intrus' },
      });

      await http()
        .post('/api/auth/email/revert')
        .send({
          token: lastTokenSentTo(t.mail, email),
          password: 'reprendre-la-main',
        })
        .expect(204);
      const after = await t.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(after.googleId).toBe('g-adrien');
    });

    it('refuse si un autre compte actif a pris l’ancienne adresse', async () => {
      const user = await signUp();
      await changeEmail(user, newEmail);
      const revert = lastTokenSentTo(t.mail, email);
      await signUp(email);

      const res = await http()
        .post('/api/auth/email/revert')
        .send({ token: revert, password: 'reprendre-la-main' })
        .expect(409);
      expect(res.body.code).toBe('EMAIL_TAKEN');
    });
  });
});
