import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import vuetify from 'vite-plugin-vuetify';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    VitePWA({
      // Nouvelle version prise dès qu'elle est là (pas de bandeau « mettre à jour »).
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'Canapact',
        short_name: 'Canapact',
        description:
          "Promis, je t'attends. La watchlist à regarder seul ou ensemble.",
        lang: 'fr',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // Pas d'« orientation » imposée : paysage possible (tablette, support,
        // accessibilité WCAG 1.3.4).
        // Couleurs du thème sombre (plugins/vuetify.ts) : pas de flash blanc au lancement.
        background_color: '#1d1520',
        theme_color: '#1d1520',
        categories: ['entertainment', 'lifestyle'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // Android : Canapact apparaît dans le menu « Partager » (de l'app YouTube…).
        // GET : l'URL arrive en paramètres, sans code dans le service worker.
        share_target: {
          action: '/share',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
        shortcuts: [
          {
            name: 'Ajouter une vidéo',
            short_name: 'Ajouter',
            url: '/add',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        // Seule l'interface est mise en cache : les données viennent toujours de l'API.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Polices : seuls les alphabets latins sont préchargés ; le navigateur ne
        // télécharge les autres qu'en cas de besoin (unicode-range).
        globIgnores: [
          '**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*',
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // Même domaine en prod : en dev, Vite relaie /api vers NestJS.
    proxy: { '/api': 'http://localhost:3000' },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['src/test/setup.ts'],
    server: { deps: { inline: ['vuetify'] } },
  },
});
