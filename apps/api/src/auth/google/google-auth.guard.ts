import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard, type AuthGuardAuthenticateOptions } from '@nestjs/passport';
import { GoogleErrorCode, safeRedirectPath, toLocale } from '@watchlist/shared';
import type { Request } from 'express';
import type { Env } from '../../config.js';
import type { GoogleLoginState } from './cookie-state.store.js';
import type { GoogleProfile } from './google-profile.js';

/** Requête après passage du guard Google : profil en cas de succès, code d'erreur sinon. */
export interface GoogleCallbackRequest extends Request {
  user?: GoogleProfile;
  authInfo?: { state?: GoogleLoginState };
  googleError?: GoogleErrorCode;
}

/** Routes Google en 404 tant que les identifiants OAuth ne sont pas configurés. */
@Injectable()
export class GoogleEnabledGuard implements CanActivate {
  private readonly enabled: boolean;

  constructor(config: ConfigService<Env, true>) {
    this.enabled = !!config.get('GOOGLE_CLIENT_ID', { infer: true });
  }

  canActivate(): boolean {
    if (!this.enabled) throw new NotFoundException();
    return true;
  }
}

/**
 * Lance Passport : à l'aller, redirige vers Google ; au retour, échange le code
 * et pose le profil sur `req.user`. Un échec ne lève pas d'erreur JSON (le
 * navigateur est en pleine redirection) : il est noté dans `req.googleError`
 * et le contrôleur renvoie vers l'écran de connexion avec un message.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  private readonly logger = new Logger(GoogleAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<GoogleCallbackRequest>();
    try {
      await super.canActivate(context);
    } catch (error) {
      if (req.query.error === 'access_denied') {
        req.googleError = GoogleErrorCode.CANCELLED;
      } else {
        req.googleError = GoogleErrorCode.FAILED;
        this.logger.warn(
          `Échec de la connexion Google : ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return true;
  }

  getAuthenticateOptions(
    context: ExecutionContext,
  ): AuthGuardAuthenticateOptions {
    const req = context.switchToHttp().getRequest<Request>();
    const state: GoogleLoginState = {
      next: safeRedirectPath(req.query.next),
      locale: toLocale(req.query.locale),
    };
    return {
      // Objet (et non chaîne) : Passport le confie au CookieStateStore. Les types
      // de Passport n'admettent qu'une chaîne, d'où la conversion.
      state: state as unknown as string,
      // Laisse choisir le compte quand plusieurs comptes Google sont ouverts.
      prompt: 'select_account',
    };
  }
}
