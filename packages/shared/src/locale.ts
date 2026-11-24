import { z } from 'zod';

/**
 * Langues de l'interface et des emails. Le français reste la langue de
 * référence (et de repli) ; l'anglais suit.
 */
export const SUPPORTED_LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fr';

export const localeSchema = z.enum(SUPPORTED_LOCALES, {
  error: 'validation.invalidLocale',
});

export function isLocale(value: unknown): value is Locale {
  return (SUPPORTED_LOCALES as readonly unknown[]).includes(value);
}

/**
 * Première langue prise en charge parmi des préférences (`navigator.languages`,
 * en-tête Accept-Language découpé…) : « en-GB » donne « en ». Repli : français.
 */
export function pickLocale(preferences: readonly string[]): Locale {
  for (const tag of preferences) {
    const base = tag.trim().toLowerCase().split(/[-_;]/)[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/** Changement de langue depuis les réglages. */
export const updateLocaleRequestSchema = z.object({ locale: localeSchema });
export type UpdateLocaleRequest = z.infer<typeof updateLocaleRequestSchema>;

/** Valeur stockée ou reçue ramenée à une langue prise en charge (repli : français). */
export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
