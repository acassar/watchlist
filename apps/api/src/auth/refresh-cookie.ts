import type { CookieOptions, Request, Response } from 'express';
import {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_TTL_MS,
} from './auth.constants.js';

function options(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure,
    // Front et API sur le même domaine : le cookie n'a jamais besoin de partir d'un autre site.
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
  };
}

export function setRefreshCookie(
  res: Response,
  token: string,
  secure: boolean,
) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...options(secure),
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function clearRefreshCookie(res: Response, secure: boolean) {
  res.clearCookie(REFRESH_COOKIE_NAME, options(secure));
}

export function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
