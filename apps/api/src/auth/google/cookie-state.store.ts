import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { CookieOptions, Request } from 'express';
import {
  GOOGLE_STATE_COOKIE_NAME,
  GOOGLE_STATE_COOKIE_PATH,
  GOOGLE_STATE_TTL_MS,
} from './google.constants.js';

/** Ce que l'on retrouve au retour de Google. */
export interface GoogleLoginState {
  /** Chemin interne où renvoyer l'utilisateur une fois connecté. */
  next: string;
}

interface StoredState extends GoogleLoginState {
  handle: string;
  verifier: string;
  expiresAt: number;
}

type StoreCallback = (err: Error | null, handle?: string) => void;
type VerifyCallback = (
  err: Error | null,
  ok: string | false,
  state?: GoogleLoginState | { message: string },
) => void;

/**
 * Stockage de l'état OAuth (paramètre `state` + vérificateur PKCE) dans un
 * cookie signé, à la place de la session Express que Passport attend par défaut :
 * l'API reste sans session côté serveur.
 *
 * - Anti-CSRF de connexion : le `state` renvoyé par Google doit être celui du
 *   cookie posé par ce navigateur au départ.
 * - Le cookie est `SameSite=Lax` (et non Strict) : il doit accompagner la
 *   navigation de retour qui vient de accounts.google.com.
 * - Il est signé (HMAC) pour qu'on ne puisse pas forger le chemin de retour,
 *   et à usage unique : effacé dès le retour.
 *
 * Signature attendue par passport-oauth2 avec PKCE : store(req, verifier, state,
 * meta, cb) et verify(req, providedState, cb).
 */
export class CookieStateStore {
  private readonly key: Buffer;

  constructor(
    secret: string,
    private readonly secureCookie: boolean,
  ) {
    // Clé dérivée : le secret des JWT ne sert pas tel quel à un autre usage.
    this.key = createHmac('sha256', secret)
      .update('google-oauth-state')
      .digest();
  }

  store(
    req: Request,
    verifier: string,
    state: GoogleLoginState | undefined,
    _meta: unknown,
    callback: StoreCallback,
  ): void {
    const stored: StoredState = {
      handle: randomBytes(24).toString('base64url'),
      verifier,
      next: state?.next ?? '/',
      expiresAt: Date.now() + GOOGLE_STATE_TTL_MS,
    };
    req.res!.cookie(GOOGLE_STATE_COOKIE_NAME, this.seal(stored), {
      ...this.cookieOptions(),
      maxAge: GOOGLE_STATE_TTL_MS,
    });
    callback(null, stored.handle);
  }

  verify(req: Request, providedState: unknown, callback: VerifyCallback): void {
    const raw: unknown = req.cookies?.[GOOGLE_STATE_COOKIE_NAME];
    req.res!.clearCookie(GOOGLE_STATE_COOKIE_NAME, this.cookieOptions());

    const stored = typeof raw === 'string' ? this.unseal(raw) : null;
    if (
      !stored ||
      stored.expiresAt < Date.now() ||
      typeof providedState !== 'string' ||
      !safeEqual(stored.handle, providedState)
    ) {
      callback(null, false, { message: 'Invalid authorization request state' });
      return;
    }
    callback(null, stored.verifier, { next: stored.next });
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.secureCookie,
      sameSite: 'lax',
      path: GOOGLE_STATE_COOKIE_PATH,
    };
  }

  private seal(state: StoredState): string {
    const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
    return `${payload}.${this.sign(payload)}`;
  }

  private unseal(value: string): StoredState | null {
    const [payload, signature] = value.split('.');
    if (!payload || !signature || !safeEqual(this.sign(payload), signature)) {
      return null;
    }
    try {
      const parsed = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as Partial<StoredState>;
      if (
        typeof parsed.handle !== 'string' ||
        typeof parsed.verifier !== 'string' ||
        typeof parsed.next !== 'string' ||
        typeof parsed.expiresAt !== 'number'
      ) {
        return null;
      }
      return parsed as StoredState;
    } catch {
      return null;
    }
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.key).update(payload).digest('base64url');
  }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
