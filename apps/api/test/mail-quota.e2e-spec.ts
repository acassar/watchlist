import request from 'supertest';
import { MailService } from '../src/mail/mail.service.js';
import { createTestApp, resetDatabase, type TestApp } from './helpers.js';

const LIMIT = 280; // MAIL_DAILY_LIMIT par défaut

describe("Quota journalier d'emails (e2e)", () => {
  let t: TestApp;

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

  const day = () => new Date(new Date().toISOString().slice(0, 10));
  const setSentToday = (count: number) =>
    t.prisma.mailDailyCount.upsert({
      where: { day: day() },
      create: { day: day(), count },
      update: { count },
    });
  const sentToday = async () =>
    (await t.prisma.mailDailyCount.findUnique({ where: { day: day() } }))
      ?.count ?? 0;
  const flush = () => t.app.get(MailService).flush();

  const register = (email: string) =>
    request(t.app.getHttpServer()).post('/api/auth/register').send({
      email,
      password: 'un-mot-de-passe-solide',
      displayName: 'Adrien',
    });

  it("compte chaque email envoyé et refuse l'inscription une fois le quota atteint", async () => {
    await setSentToday(LIMIT - 1);

    await register('adrien@exemple.fr').expect(202);
    await flush();
    expect(t.mail.to('adrien@exemple.fr')).toHaveLength(1);
    expect(await sentToday()).toBe(LIMIT);

    const res = await register('camille@exemple.fr').expect(503);
    expect(res.body.code).toBe('MAIL_QUOTA_EXCEEDED');
    expect(
      await t.prisma.user.findUnique({
        where: { email: 'camille@exemple.fr' },
      }),
    ).toBeNull();
    expect(t.mail.to('camille@exemple.fr')).toHaveLength(0);
  });

  it('refuse aussi renvoi du lien et mot de passe oublié, même pour une adresse inconnue', async () => {
    await setSentToday(LIMIT);
    const server = t.app.getHttpServer();

    for (const path of [
      '/api/auth/verify-email/resend',
      '/api/auth/password/forgot',
    ]) {
      const res = await request(server)
        .post(path)
        .send({ email: 'inconnu@exemple.fr' })
        .expect(503);
      expect(res.body.code).toBe('MAIL_QUOTA_EXCEEDED');
    }
  });

  it('repart de zéro le lendemain', async () => {
    const yesterday = new Date(day().getTime() - 24 * 60 * 60 * 1000);
    await t.prisma.mailDailyCount.create({
      data: { day: yesterday, count: LIMIT },
    });

    await register('adrien@exemple.fr').expect(202);
    await flush();
    expect(await sentToday()).toBe(1);
  });
});
