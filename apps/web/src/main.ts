import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { applyLocale, detectLocale } from './features/locale/locale';
import { i18n } from './plugins/i18n';
import { vuetify } from './plugins/vuetify';
import { createAppRouter } from './router';
import './styles/main.css';

// Avant le premier rendu : pas de flash de français pour un navigateur anglais.
applyLocale(detectLocale(), false);

const app = createApp(App).use(createPinia());
app.use(createAppRouter()).use(i18n).use(vuetify).mount('#app');
