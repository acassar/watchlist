import request from 'supertest';
import type { TestApp } from './helpers.js';

describe('Google non configuré (e2e)', () => {
  let t: TestApp;
  const previous = {
    id: process.env.GOOGLE_CLIENT_ID,
    secret: process.env.GOOGLE_CLIENT_SECRET,
  };

  beforeAll(async () => {
    // ConfigModule lit l'environnement à l'import d'AppModule : import dynamique après réglage.
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    const { createTestApp } = await import('./helpers.js');
    t = await createTestApp();
  });

  afterAll(async () => {
    process.env.GOOGLE_CLIENT_ID = previous.id;
    process.env.GOOGLE_CLIENT_SECRET = previous.secret;
    await t.app.close();
  });

  it('masque Google et ferme ses routes', async () => {
    const http = () => request(t.app.getHttpServer());
    const providers = await http().get('/api/auth/providers').expect(200);
    expect(providers.body).toEqual({ google: false });
    await http().get('/api/auth/google').expect(404);
    await http().get('/api/auth/google/callback?code=x').expect(404);
  });
});
