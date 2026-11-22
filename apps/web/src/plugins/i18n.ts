import { createI18n } from 'vue-i18n';
import fr from '@/i18n/fr.json';

export type MessageSchema = typeof fr;

// FR d'abord, EN viendra ensuite.
export const i18n = createI18n<[MessageSchema], 'fr'>({
  legacy: false,
  locale: 'fr',
  fallbackLocale: 'fr',
  messages: { fr },
});
