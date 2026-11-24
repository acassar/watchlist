import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  GoogleErrorCode,
  safeRedirectPath,
  type AuthProviders,
} from '@watchlist/shared';
import type { Response } from 'express';
import type { Env } from '../../config.js';
import { Public } from '../public.decorator.js';
import { setRefreshCookie } from '../refresh-cookie.js';
import {
  GoogleAuthGuard,
  GoogleEnabledGuard,
  type GoogleCallbackRequest,
} from './google-auth.guard.js';
import { GoogleAuthService, GoogleLoginError } from './google-auth.service.js';
import {
  GOOGLE_STATE_COOKIE_NAME,
  GOOGLE_STATE_COOKIE_PATH,
} from './google.constants.js';

/**
 * Connexion avec Google. Ce sont des navigations du navigateur (pas des appels
 * fetch) : les réponses sont des redirections, jamais du JSON.
 *
 * 1. Le front envoie vers GET /api/auth/google?next=/chemin.
 * 2. L'API pose le cookie d'état et redirige vers Google.
 * 3. Google renvoie vers GET /api/auth/google/callback : l'API ouvre la session
 *    (cookie de refresh, comme une connexion par mot de passe) et redirige vers
 *    `next`. Le front retrouve la session au chargement via /api/auth/refresh.
 *    En cas d'échec : redirection vers /login?error=<GoogleErrorCode>.
 */
@Public()
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class GoogleAuthController {
  private readonly appUrl: string;
  private readonly secureCookie: boolean;
  private readonly googleEnabled: boolean;

  constructor(
    private readonly google: GoogleAuthService,
    config: ConfigService<Env, true>,
  ) {
    this.appUrl = config.get('APP_URL');
    this.secureCookie = config.get('COOKIE_SECURE');
    this.googleEnabled = !!config.get('GOOGLE_CLIENT_ID', { infer: true });
  }

  /** Moyens de connexion disponibles, pour afficher ou non le bouton Google. */
  @Get('providers')
  providers(): AuthProviders {
    return { google: this.googleEnabled };
  }

  /** Départ vers Google : le guard répond lui-même par une redirection. */
  @Get('google')
  @UseGuards(GoogleEnabledGuard, GoogleAuthGuard)
  start(): void {
    // Jamais atteint : Passport a déjà redirigé vers Google.
  }

  @Get('google/callback')
  @UseGuards(GoogleEnabledGuard, GoogleAuthGuard)
  async callback(
    @Req() req: GoogleCallbackRequest,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    // Déjà effacé si l'état a été vérifié, mais pas quand Google renvoie une
    // erreur (annulation) : Passport s'arrête alors avant le CookieStateStore.
    res.clearCookie(GOOGLE_STATE_COOKIE_NAME, {
      httpOnly: true,
      secure: this.secureCookie,
      sameSite: 'lax',
      path: GOOGLE_STATE_COOKIE_PATH,
    });
    if (req.googleError || !req.user) {
      return this.fail(res, req.googleError ?? GoogleErrorCode.FAILED);
    }

    try {
      const session = await this.google.login(
        req.user,
        req.get('user-agent'),
        req.authInfo?.state?.locale,
      );
      setRefreshCookie(res, session.refreshToken, this.secureCookie);
      res.redirect(
        `${this.appUrl}${safeRedirectPath(req.authInfo?.state?.next)}`,
      );
    } catch (error) {
      if (error instanceof GoogleLoginError) return this.fail(res, error.code);
      throw error;
    }
  }

  private fail(res: Response, code: GoogleErrorCode) {
    res.redirect(`${this.appUrl}/login?error=${encodeURIComponent(code)}`);
  }
}
