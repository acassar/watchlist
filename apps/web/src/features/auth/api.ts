import type {
  AuthProviders,
  Locale,
  AuthResponse,
  AuthUser,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
} from '@watchlist/shared';
import { api } from '@/api/http';

/** Routes d'auth : publiques, donc sans JWT ni retentative après refresh. */
const pub = { auth: false } as const;

/**
 * Départ de la connexion Google : une navigation complète (pas un fetch), car
 * Google affiche sa propre page. `next` = où revenir une fois connecté.
 */
export function googleLoginUrl(next: string, locale?: Locale): string {
  const params = new URLSearchParams({ next });
  // Langue d'un compte créé au retour de Google.
  if (locale) params.set('locale', locale);
  return `/api/auth/google?${params}`;
}

export const authApi = {
  register: (body: RegisterRequest) => api('/auth/register', { ...pub, body }),
  verifyEmail: (token: string) =>
    api<AuthResponse>('/auth/verify-email', { ...pub, body: { token } }),
  resendVerification: (email: string) =>
    api('/auth/verify-email/resend', { ...pub, body: { email } }),
  login: (body: LoginRequest) =>
    api<AuthResponse>('/auth/login', { ...pub, body }),
  refresh: () => api<AuthResponse>('/auth/refresh', { ...pub, method: 'POST' }),
  logout: () => api('/auth/logout', { ...pub, method: 'POST' }),
  forgotPassword: (email: string) =>
    api('/auth/password/forgot', { ...pub, body: { email } }),
  resetPassword: (body: ResetPasswordRequest) =>
    api('/auth/password/reset', { ...pub, body }),
  confirmLinkPassword: (body: ResetPasswordRequest) =>
    api<AuthResponse>('/auth/password/link/confirm', { ...pub, body }),
  providers: () => api<AuthProviders>('/auth/providers', pub),
  me: () => api<AuthUser>('/me'),
  updateLocale: (locale: Locale) =>
    api<AuthUser>('/me/locale', { method: 'PATCH', body: { locale } }),
};
