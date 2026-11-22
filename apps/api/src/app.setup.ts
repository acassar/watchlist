import type { INestApplication } from '@nestjs/common';

/**
 * Réglages communs à l'application réelle et aux tests e2e,
 * pour que les tests passent par la même configuration que la prod.
 */
export function configureApp(app: INestApplication): INestApplication {
  // Front et API partagent le même domaine : toutes les routes API vivent sous /api.
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  return app;
}
