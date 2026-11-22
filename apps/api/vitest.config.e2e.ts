import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // Les fichiers e2e partagent la même base : on les exécute l'un après l'autre.
    fileParallelism: false,
    env: {
      JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e',
      MAIL_TRANSPORT: 'memory',
      APP_URL: 'http://canapact.test',
      AUTH_RATE_LIMIT: '1000',
      // Identifiants factices : les échanges avec Google sont simulés (voir mockGoogle).
      GOOGLE_CLIENT_ID: 'e2e-client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'e2e-client-secret',
      // Clé factice : YouTube est simulé (voir mockYouTube).
      YOUTUBE_API_KEY: 'e2e-youtube-key',
      MEDIA_RATE_LIMIT: '1000',
      // Lancé à la main dans les tests (voir titles.e2e-spec).
      MEDIA_REFRESH_ENABLED: 'false',
    },
  },
});
