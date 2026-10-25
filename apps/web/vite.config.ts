import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// MALLA_BASE lets the app be served from a sub-path, e.g. "/malla/" on GitHub Pages.
const base = process.env['MALLA_BASE'] ?? '/';

export default defineConfig({
  base,
  plugins: [
    svelte(),
    VitePWA({
      // Updates wait for the user to accept them (see UpdatePrompt.svelte).
      registerType: 'prompt',
      manifest: {
        name: 'Malla',
        short_name: 'Malla',
        description:
          'Consciencia situacional para la sociedad civil, con internet y por malla LoRa.',
        lang: 'es',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The whole app, glyphs and sprites are cached at install so the map works offline.
        // Map tiles are not handled here: downloaded areas live in IndexedDB.
        globPatterns: ['**/*.{js,mjs,css,html,png,svg,pbf,json,webmanifest}'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
});
