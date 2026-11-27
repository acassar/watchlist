import { createI18n } from 'vue-i18n';
import en from '@/i18n/en.json';
import fr from '@/i18n/fr.json';

export type MessageSchema = typeof fr;

/**
 * Français par défaut (langue de référence, et de repli si une clé manque en
 * anglais). La langue réelle est posée au démarrage (features/locale).
 */
export const i18n = createI18n<[MessageSchema], 'fr' | 'en', false>({
  legacy: false,
  locale: 'fr',
  fallbackLocale: 'fr',
  messages: { fr, en },
  datetimeFormats: {
    fr: {
      short: { day: 'numeric', month: 'long' },
      long: { day: 'numeric', month: 'long', year: 'numeric' },
      time: { hour: '2-digit', minute: '2-digit' },
      dateTime: {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      },
    },
    en: {
      short: { day: 'numeric', month: 'long' },
      long: { day: 'numeric', month: 'long', year: 'numeric' },
      time: { hour: '2-digit', minute: '2-digit' },
      dateTime: {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      },
    },
  },
});
