import { pickLocale, toLocale, type Locale } from '@watchlist/shared';
import { computed } from 'vue';
import { i18n } from '@/plugins/i18n';
import { vuetify } from '@/plugins/vuetify';

/** Langue choisie sur cet appareil, avant connexion ou sans compte. */
const STORAGE_KEY = 'canapact.locale';

function storedLocale(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Langue courante de l'interface (réactive). */
export const currentLocale = computed<Locale>(() =>
  toLocale(i18n.global.locale.value),
);

/**
 * Langue au démarrage : celle choisie sur cet appareil, sinon celle du
 * navigateur (anglais si la première langue prise en charge est l'anglais),
 * sinon le français. Une fois connecté, la langue du compte prend le relais.
 */
export function detectLocale(): Locale {
  const stored = storedLocale();
  if (stored) return toLocale(stored);
  const languages =
    typeof navigator === 'undefined'
      ? []
      : navigator.languages?.length
        ? navigator.languages
        : [navigator.language];
  return pickLocale(languages);
}

/** Bascule l'interface (textes, composants Vuetify, attribut lang) et la retient sur l'appareil. */
export function applyLocale(locale: Locale, remember = true): void {
  i18n.global.locale.value = locale;
  vuetify.locale.current.value = locale;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
  if (!remember) return;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Navigation privée : la langue vaut pour cette visite seulement.
  }
}
