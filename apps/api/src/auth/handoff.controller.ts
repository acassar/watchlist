import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { safeRedirectPath } from '@watchlist/shared';
import type { Request, Response } from 'express';
import type { Env } from '../config.js';
import { HANDOFF_TOKEN_TTL_MS } from './auth.constants.js';
import { Public } from './public.decorator.js';
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from './refresh-cookie.js';
import { RefreshTokenService } from './refresh-token.service.js';

/**
 * Changement d'adresse sans reconnexion. Le cookie de session est lié à
 * l'adresse qui l'a posé : sur l'ancienne (canapact.adrien-cassar.fr), le
 * Nginx de l'hôte envoie toute page vers /api/auth/handoff/<chemin> (voir
 * deploy/nginx/canapact.host.conf), qui passe la session à APP_URL :
 *
 * 1. Ancienne adresse, GET /api/auth/handoff/<chemin> : le refresh token est
 *    échangé (rotation) contre un jeton de 60 secondes, et le cookie effacé.
 *    Redirection vers APP_URL/api/auth/handoff-claim?token=…&next=/<chemin>.
 *    Sans session valable : redirection directe vers APP_URL/<chemin>.
 * 2. APP_URL, GET /api/auth/handoff-claim : le jeton de 60 secondes est échangé
 *    à son tour contre un jeton de session normal, posé en cookie sur la
 *    nouvelle adresse. Redirection vers /<chemin>.
 *
 * Le jeton de l'URL (visible dans les journaux Nginx) ne sert qu'une fois et
 * meurt au bout d'une minute ; le rejouer révoque la session (détection de
 * réutilisation des refresh tokens). Le fragment éventuel (#token= des liens
 * envoyés par email) est conservé par le navigateur d'une redirection à
 * l'autre.
 */
@Public()
@SkipThrottle()
@Controller('auth')
export class HandoffController {
  private readonly appUrl: string;
  private readonly secureCookie: boolean;

  constructor(
    private readonly refreshTokens: RefreshTokenService,
    config: ConfigService<Env, true>,
  ) {
    this.appUrl = config.get('APP_URL');
    this.secureCookie = config.get('COOKIE_SECURE');
  }

  @Get('handoff{/*path}')
  async handoff(@Req() req: Request, @Res() res: Response): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    const next = safeRedirectPath(
      req.originalUrl.replace(/^\/api\/auth\/handoff/, '') || '/',
    );
    const token = readRefreshCookie(req);
    const result = token
      ? await this.refreshTokens.rotate(
          token,
          req.get('user-agent'),
          HANDOFF_TOKEN_TTL_MS,
        )
      : undefined;
    if (token) clearRefreshCookie(res, this.secureCookie);
    if (!result?.ok) return res.redirect(`${this.appUrl}${next}`);

    const query = new URLSearchParams({ token: result.token, next });
    res.redirect(`${this.appUrl}/api/auth/handoff-claim?${query}`);
  }

  @Get('handoff-claim')
  async claim(
    @Query('token') token: unknown,
    @Query('next') next: unknown,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    // Pas de Referer vers la page suivante : l'URL porte le jeton.
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (typeof token === 'string' && token.length > 0) {
      const result = await this.refreshTokens.rotate(
        token,
        req.get('user-agent'),
      );
      if (result.ok) {
        setRefreshCookie(res, result.token, this.secureCookie);
      }
    }
    res.redirect(`${this.appUrl}${safeRedirectPath(next)}`);
  }
}
