import request from 'supertest';
import type { TestApp } from './helpers.js';

describe('Rate limiting de l’auth (e2e)', () => {
  let t: TestApp;
  const previous = process.env.AUTH_RATE_LIMIT;

  beforeAll(async () => {
    // ConfigModule lit l'environnement à l'import d'AppModule : import dynamique après réglage.
    process.env.AUTH_RATE_LIMIT = '3';
    const { createTestApp, resetDatabase } = await import('./helpers.js');
    t = await createTestApp();
    await resetDatabase(t.prisma);
  });

  afterAll(async () => {
    process.env.AUTH_RATE_LIMIT = previous;
    await t.app.close();
  });

  it('bloque les tentatives de connexion répétées depuis la même IP', async () => {
    const attempt = () =>
      request(t.app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'cible@exemple.fr', password: 'devine' });

    for (let i = 0; i < 3; i++) await attempt().expect(401);
    const blocked = await attempt().expect(429);
    expect(blocked.body.code).toBe('TOO_MANY_REQUESTS');
  });

  it('ne limite pas le refresh, appelé à chaque ouverture de l’app', async () => {
    for (let i = 0; i < 5; i++) {
      await request(t.app.getHttpServer())
        .post('/api/auth/refresh')
        .expect(401);
    }
  });
});
