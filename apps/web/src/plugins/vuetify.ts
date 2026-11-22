import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg';

export const vuetify = createVuetify({
  icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
  // Sombre par défaut (maquette validée « Cocon du soir ») ; le thème clair viendra avec le design.
  theme: { defaultTheme: 'dark' },
});
