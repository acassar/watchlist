import request from 'supertest';
import { MailService } from '../src/mail/mail.service.js';
import {
  createTestApp,
  createUser,
  lastTokenSentTo,
  resetDatabase,
  type TestApp,
} from './helpers.js';

// Nécessite une base Postgres (`pnpm db:up`) et DATABASE_URL.
describe('Langue du compte (e2e)', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());

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

  it("garde la langue de l'inscription et écrit les emails dedans", async () => {
    const email = 'sam@example.com';
    await http()
      .post('/api/auth/register')
      .send({
        email,
        password: 'cosy-couch-night',
        displayName: 'Sam',
        locale: 'en',
      })
      .expect(202);

    const [mail] = t.mail.to(email);
    expect(mail.subject).toBe('Confirm your email address');
    expect(mail.text).toContain('Good evening Sam,');

    const verified = await http()
      .post('/api/auth/verify-email')
      .send({ token: lastTokenSentTo(t.mail, email) })
      .expect(200);
    expect(verified.body.user.locale).toBe('en');

    t.mail.clear();
    await http().post('/api/auth/password/forgot').send({ email }).expect(202);
    await t.app.get(MailService).flush();
    expect(t.mail.to(email).at(-1)?.subject).toBe('Reset your password');
  });

  it('inscrit en français par défaut et refuse une langue inconnue', async () => {
    await http()
      .post('/api/auth/register')
      .send({
        email: 'a@exemple.fr',
        password: 'canape-du-soir',
        displayName: 'A',
      })
      .expect(202);
    expect(t.mail.to('a@exemple.fr')[0].subject).toBe(
      'Confirmez votre adresse email',
    );

    const res = await http()
      .post('/api/auth/register')
      .send({
        email: 'b@exemple.fr',
        password: 'canape-du-soir',
        displayName: 'B',
        locale: 'de',
      })
      .expect(400);
    expect(res.body.issues).toEqual([
      { path: 'locale', message: 'validation.invalidLocale' },
    ]);
  });

  it('change la langue depuis les réglages', async () => {
    const adrien = await createUser(t, 'Adrien');

    const res = await http()
      .patch('/api/me/locale')
      .set(adrien.auth)
      .send({ locale: 'en' })
      .expect(200);
    expect(res.body).toMatchObject({ displayName: 'Adrien', locale: 'en' });

    const me = await http().get('/api/me').set(adrien.auth).expect(200);
    expect(me.body.locale).toBe('en');

    await http()
      .patch('/api/me/locale')
      .set(adrien.auth)
      .send({ locale: 'xx' })
      .expect(400);
    await http().patch('/api/me/locale').send({ locale: 'fr' }).expect(401);
  });
});
