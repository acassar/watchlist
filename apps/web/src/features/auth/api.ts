import type {
  AuthResponse,
  AuthUser,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
} from '@watchlist/shared';
import { api } from '@/api/http';

/** Routes d'auth : publiques, donc sans JWT ni retentative après refresh. */
const pub = { auth: false } as const;

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
  confirmLinkPassword: (token: string) =>
    api<AuthResponse>('/auth/password/link/confirm', {
      ...pub,
      body: { token },
    }),
  me: () => api<AuthUser>('/me'),
};
