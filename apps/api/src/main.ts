import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { Env } from './config.js';

async function bootstrap() {
  const app = configureApp(await NestFactory.create(AppModule));
  // PORT passe par la config validée (Zod) plutôt que par process.env brut.
  const config = app.get(ConfigService<Env, true>);
  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
