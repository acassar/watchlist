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
    },
  },
});
