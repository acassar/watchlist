import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import { parseTrustProxy, type Env } from './config.js';

/**
 * Réglages communs à l'application réelle et aux tests e2e,
 * pour que les tests passent par la même configuration que la prod.
 */
export function configureApp(app: INestApplication): INestApplication {
  const config = app.get(ConfigService<Env, true>);
  const express = app.getHttpAdapter().getInstance() as Express;
  // Derrière le reverse proxy, pour que le rate limiting voie l'IP du client.
  express.set('trust proxy', parseTrustProxy(config.get('TRUST_PROXY')));
  express.disable('x-powered-by');

  // Front et API partagent le même domaine : toutes les routes API vivent sous /api.
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  return app;
}
