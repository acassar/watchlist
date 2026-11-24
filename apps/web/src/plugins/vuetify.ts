import 'vuetify/styles';
import { createVuetify, type ThemeDefinition } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg';
import { en, fr } from 'vuetify/locale';

/**
 * Ambiance « Cocon du soir » : prune et ambre, comme un canapé à 21 h.
 * Les couleurs de statut (Ensemble ambre, Sans moi sauge, Pas pour moi gris)
 * sont déjà là pour l'étape 6.
 */
const canapactDark: ThemeDefinition = {
  dark: true,
  colors: {
    background: '#1d1520',
    surface: '#2a1f2d',
    'surface-variant': '#3a2c3e',
    'on-surface-variant': '#e9dce3',
    primary: '#f5b971',
    'on-primary': '#2a1f2d',
    secondary: '#c48fb4',
    'on-secondary': '#1d1520',
    error: '#ef8a7f',
    info: '#9fb6d9',
    success: '#9fbf9a',
    warning: '#f0c36d',
    together: '#f5b971',
    alone: '#9fbf9a',
    'not-interested': '#9a8f96',
  },
};

const canapactLight: ThemeDefinition = {
  dark: false,
  colors: {
    background: '#fbf5f0',
    surface: '#ffffff',
    'surface-variant': '#f1e6ec',
    primary: '#9c5d16',
    'on-primary': '#ffffff',
    secondary: '#7d4b6e',
    error: '#b3261e',
    info: '#3b5f8f',
    success: '#4f7a4a',
    warning: '#8a6100',
    together: '#9c5d16',
    alone: '#4f7a4a',
    'not-interested': '#6f666b',
  },
};

export const vuetify = createVuetify({
  icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
  // Textes internes des composants (libellés d'accessibilité…), suivent vue-i18n.
  locale: { locale: 'fr', fallback: 'fr', messages: { fr, en } },
  // Sombre par défaut (maquette validée), clair disponible.
  theme: {
    defaultTheme: 'canapactDark',
    themes: { canapactDark, canapactLight },
  },
});
