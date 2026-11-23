import { z } from 'zod';

/**
 * Contrats de l'authentification par email, partagés par le front (validation
 * des formulaires) et l'API (validation des requêtes).
 *
 * Les messages d'erreur sont des clés i18n (`validation.*`) : le front les
 * traduit, l'API les renvoie telles quelles dans `issues`.
 */

export const PASSWORD_MIN_LENGTH = 8;
/** Borne haute : un mot de passe énorme coûterait cher à hacher (DoS). */
export const PASSWORD_MAX_LENGTH = 128;
export const DISPLAY_NAME_MAX_LENGTH = 50;

/** Email normalisé : espaces retirés et minuscules, pour une unicité fiable en base. */
export const emailSchema = z
  .string({ error: 'validation.required' })
  .trim()
  .toLowerCase()
  .pipe(
    z
      .email({ error: 'validation.email' })
      .max(254, { error: 'validation.email' }),
  );

/** Mot de passe à la création ou au changement. */
export const newPasswordSchema = z
  .string({ error: 'validation.required' })
  .min(PASSWORD_MIN_LENGTH, { error: 'validation.passwordTooShort' })
  .max(PASSWORD_MAX_LENGTH, { error: 'validation.passwordTooLong' });

export const displayNameSchema = z
  .string({ error: 'validation.required' })
  .trim()
  .min(1, { error: 'validation.required' })
  .max(DISPLAY_NAME_MAX_LENGTH, { error: 'validation.displayNameTooLong' });

/** Jeton reçu par email (vérification, réinitialisation, ajout de mot de passe). */
export const emailTokenSchema = z
  .string({ error: 'validation.required' })
  .min(1, { error: 'validation.required' })
  .max(200, { error: 'validation.invalidToken' });

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: newPasswordSchema,
  displayName: displayNameSchema,
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  // À la connexion on ne revalide pas les règles de création : seulement la borne haute.
  password: z
    .string({ error: 'validation.required' })
    .min(1, { error: 'validation.required' })
    .max(PASSWORD_MAX_LENGTH, { error: 'validation.passwordTooLong' }),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const emailOnlyRequestSchema = z.object({ email: emailSchema });
export type EmailOnlyRequest = z.infer<typeof emailOnlyRequestSchema>;

export const tokenRequestSchema = z.object({ token: emailTokenSchema });
export type TokenRequest = z.infer<typeof tokenRequestSchema>;

export const resetPasswordRequestSchema = z.object({
  token: emailTokenSchema,
  password: newPasswordSchema,
});
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;

/** Utilisateur tel que le voit le front. */
export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  /** Faux pour un compte créé avec Google sans mot de passe. */
  hasPassword: boolean;
}

/** Réponse des routes qui ouvrent une session (connexion, refresh, vérification). */
export interface AuthResponse {
  /** JWT court (15 min), gardé en mémoire par le front, jamais en localStorage. */
  accessToken: string;
  user: AuthUser;
}

/** Codes d'erreur stables, pour que le front affiche le bon message. */
export const AuthErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
} as const;
export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

/** Corps des réponses d'erreur de l'API. */
export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  issues?: { path: string; message: string }[];
}

/** Moyens de connexion activés sur ce serveur (le bouton Google n'apparaît que s'il est configuré). */
export interface AuthProviders {
  google: boolean;
}

/**
 * Échecs de la connexion Google. L'API redirige vers `/login?error=<code>` :
 * le front affiche le message correspondant.
 */
export const GoogleErrorCode = {
  /** L'utilisateur a annulé sur l'écran de Google. */
  CANCELLED: 'google_cancelled',
  /** Google ne garantit pas que l'adresse appartient à ce compte Google. */
  EMAIL_NOT_VERIFIED: 'google_email_not_verified',
  /** Le compte Canapact de cette adresse est déjà lié à un autre compte Google. */
  ACCOUNT_CONFLICT: 'google_account_conflict',
  /** Tout le reste : lien expiré, état invalide, Google injoignable… */
  FAILED: 'google_failed',
} as const;
export type GoogleErrorCode =
  (typeof GoogleErrorCode)[keyof typeof GoogleErrorCode];

export function isGoogleErrorCode(value: unknown): value is GoogleErrorCode {
  return (
    typeof value === 'string' &&
    (Object.values(GoogleErrorCode) as string[]).includes(value)
  );
}

/**
 * Chemin interne vers lequel revenir après connexion. Refuse tout ce qui
 * pourrait sortir du site (`//autre.site`, `/\\autre.site`, URL absolue) :
 * pas de redirection ouverte.
 */
export function safeRedirectPath(value: unknown): string {
  return typeof value === 'string' &&
    value.length <= 2000 &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.startsWith('/\\') &&
    // Caractères de contrôle (dont tab / retour ligne que les navigateurs ignorent).
    !hasControlCharacter(value)
    ? value
    : '/';
}

function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}
