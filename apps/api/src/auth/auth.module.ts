import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Env } from '../config.js';
import { ACCESS_TOKEN_TTL_SECONDS } from './auth.constants.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailTokenService } from './email-token.service.js';
import { GoogleAuthController } from './google/google-auth.controller.js';
import {
  GoogleAuthGuard,
  GoogleEnabledGuard,
} from './google/google-auth.guard.js';
import { GoogleAuthService } from './google/google-auth.service.js';
import { GoogleStrategy } from './google/google.strategy.js';
import { HandoffController } from './handoff.controller.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenService } from './refresh-token.service.js';

@Module({
  imports: [
    // Sans session Express : l'état OAuth vit dans un cookie signé (CookieStateStore).
    PassportModule.register({ session: false }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: {
          expiresIn: ACCESS_TOKEN_TTL_SECONDS,
          algorithm: 'HS256',
        },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
    // Stockage en mémoire : suffisant pour une seule instance d'API (Compose sur un VPS).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => [
        { ttl: 60_000, limit: config.get('AUTH_RATE_LIMIT') },
      ],
    }),
  ],
  controllers: [AuthController, GoogleAuthController, HandoffController],
  providers: [
    AuthService,
    PasswordService,
    RefreshTokenService,
    EmailTokenService,
    GoogleStrategy,
    GoogleAuthService,
    GoogleEnabledGuard,
    GoogleAuthGuard,
    // Toutes les routes exigent un JWT, sauf celles marquées @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  // La suppression du compte redemande le mot de passe.
  exports: [PasswordService],
})
export class AuthModule {}
