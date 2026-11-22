import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerRequest,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import type { Env } from '../config.js';

/**
 * Rate limiting des routes qui appellent un service externe (YouTube) :
 * MEDIA_RATE_LIMIT requêtes par minute et par utilisateur. Par utilisateur
 * plutôt que par IP : un couple derrière la même box ne partage pas son quota.
 * Le compteur est propre à chaque route (clé = contrôleur + méthode).
 */
@Injectable()
export class MediaThrottlerGuard extends ThrottlerGuard {
  private readonly mediaLimit: number;

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    config: ConfigService<Env, true>,
  ) {
    super(options, storage, reflector);
    this.mediaLimit = config.get('MEDIA_RATE_LIMIT');
  }

  protected override async getTracker(
    req: Record<string, any>,
  ): Promise<string> {
    const userId = (req.user as { id?: string } | undefined)?.id;
    return userId ? `user:${userId}` : super.getTracker(req);
  }

  protected override handleRequest(props: ThrottlerRequest): Promise<boolean> {
    return super.handleRequest({
      ...props,
      limit: this.mediaLimit,
      ttl: 60_000,
      blockDuration: 60_000,
    });
  }
}
