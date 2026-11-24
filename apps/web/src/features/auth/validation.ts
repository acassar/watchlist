import type { ZodType } from 'zod';
import { ApiRequestError } from '@/api/http';
import { i18n } from '@/plugins/i18n';

/**
 * Transforme un schéma Zod partagé en règle Vuetify : mêmes règles qu'à l'API,
 * messages traduits à partir des clés `validation.*`.
 */
export function zodRule(schema: ZodType) {
  return (value: unknown): true | string => {
    const result = schema.safeParse(value ?? '');
    if (result.success) return true;
    return translate(result.error.issues[0]?.message ?? 'validation.invalid');
  };
}

function translate(key: string): string {
  const t = i18n.global.t as (key: string) => string;
  return i18n.global.te(key) ? t(key) : key;
}

/**
 * Message à afficher pour une erreur d'API. `googleAvailable` : la connexion
 * Google est proposée sur la page, on la suggère quand plus aucun email ne
 * peut partir aujourd'hui (elle n'en envoie pas).
 */
export function apiErrorMessage(
  error: unknown,
  { googleAvailable = false }: { googleAvailable?: boolean } = {},
): string {
  const t = i18n.global.t as (key: string) => string;
  if (error instanceof ApiRequestError) {
    const suffix =
      googleAvailable && error.code === 'MAIL_QUOTA_EXCEEDED' ? '_GOOGLE' : '';
    const key = `errors.${error.code}${suffix}`;
    if (i18n.global.te(key)) return t(key);
  }
  return t('errors.UNKNOWN');
}

/** Lit le jeton d'un lien reçu par email : il est dans le fragment (#token=…). */
export function tokenFromHash(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, '')).get('token');
}
