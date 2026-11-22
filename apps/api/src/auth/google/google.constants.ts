/** Cookie qui relie le retour de Google à la demande partie de ce navigateur (anti-CSRF, PKCE). */
export const GOOGLE_STATE_COOKIE_NAME = 'canapact_oauth';
export const GOOGLE_STATE_COOKIE_PATH = '/api/auth/google';
/** Temps laissé pour passer l'écran de Google. */
export const GOOGLE_STATE_TTL_MS = 10 * 60 * 1000;

export const GOOGLE_CALLBACK_PATH = '/api/auth/google/callback';
