/** Durées de vie, centralisées pour les tests et la doc. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const VERIFY_EMAIL_TTL_MS = 24 * 60 * 60 * 1000;
export const RESET_PASSWORD_TTL_MS = 60 * 60 * 1000;
export const LINK_PASSWORD_TTL_MS = 24 * 60 * 60 * 1000;
/** Délai minimal entre deux emails du même type pour un même compte (anti-spam). */
export const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;

/** Cookie du refresh token : httpOnly, SameSite=Strict, limité aux routes d'auth. */
export const REFRESH_COOKIE_NAME = 'canapact_rt';
export const REFRESH_COOKIE_PATH = '/api/auth';
