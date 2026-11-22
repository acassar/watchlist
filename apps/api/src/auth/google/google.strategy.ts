import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import {
  Strategy,
  type Profile,
  type StrategyOptions,
} from 'passport-google-oauth20';
import type { Env } from '../../config.js';
import { CookieStateStore } from './cookie-state.store.js';
import { GOOGLE_CALLBACK_PATH } from './google.constants.js';
import { toGoogleProfile, type GoogleProfile } from './google-profile.js';

/**
 * Stratégie Passport « Se connecter avec Google » (OAuth 2.0 + PKCE, scopes
 * OpenID `profile email`). Elle ne fait que traduire le profil Google : la
 * création ou la liaison du compte se décide dans GoogleAuthService.
 *
 * Sans GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, la stratégie existe quand même
 * (avec des valeurs factices) mais les routes Google répondent 404.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService<Env, true>) {
    const options = {
      clientID: config.get('GOOGLE_CLIENT_ID', { infer: true }) ?? 'disabled',
      clientSecret:
        config.get('GOOGLE_CLIENT_SECRET', { infer: true }) ?? 'disabled',
      callbackURL: `${config.get('APP_URL')}${GOOGLE_CALLBACK_PATH}`,
      scope: ['openid', 'profile', 'email'],
      pkce: true,
      state: true,
      store: new CookieStateStore(
        config.get('JWT_SECRET'),
        config.get('COOKIE_SECURE'),
      ),
    };
    // Les types de passport-oauth2 ne décrivent pas le store PKCE (store à 5 arguments).
    super(options as unknown as StrategyOptions);
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): GoogleProfile {
    // Les jetons Google ne sont pas conservés : on ne lit rien d'autre chez Google.
    return toGoogleProfile(profile);
  }
}
