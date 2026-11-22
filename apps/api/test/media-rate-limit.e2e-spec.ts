import request from 'supertest';
import type { createUser, TestApp } from './helpers.js';
import { mockYouTube } from './youtube-mock.js';

type User = Awaited<ReturnType<typeof createUser>>;

describe('Rate limiting de la résolution de liens (e2e)', () => {
  let t: TestApp;
  let adrien: User;
  let camille: User;
  const previous = process.env.MEDIA_RATE_LIMIT;

  beforeAll(async () => {
    // ConfigModule lit l'environnement à l'import d'AppModule : import dynamique après réglage.
    process.env.MEDIA_RATE_LIMIT = '2';
    const { createTestApp, createUser, resetDatabase } =
      await import('./helpers.js');
    t = await createTestApp();
    await resetDatabase(t.prisma);
    adrien = await createUser(t, 'Adrien');
    camille = await createUser(t, 'Camille');
    mockYouTube();
  });

  afterAll(async () => {
    process.env.MEDIA_RATE_LIMIT = previous;
    vi.unstubAllGlobals();
    await t.app.close();
  });

  const resolve = (user: User) =>
    request(t.app.getHttpServer())
      .get('/api/media/resolve')
      .query({ url: 'https://youtu.be/AAAAAAAAAAA' })
      .set(user.auth);

  it('limite chaque utilisateur, sans pénaliser les autres sur la même IP', async () => {
    await resolve(adrien).expect(404);
    await resolve(adrien).expect(404);
    const blocked = await resolve(adrien).expect(429);
    expect(blocked.body.code).toBe('TOO_MANY_REQUESTS');

    await resolve(camille).expect(404);
  });
});
