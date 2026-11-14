import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: false,
        includeAssets: [
          'manifest.webmanifest',
          'favicon.ico',
          'apple-touch-icon.png',
          'icon-192x192.png',
          'icon-512x512.png',
          'pwa-maskable-512x512.png',
          'assets/aistudio/logo_f0aa9f50.jpg',
        ],
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,webmanifest}'],
          globIgnores: ['assets/aistudio/trackcode*', 'og-image.png', 'og-image.jpg'],
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/robots\.txt$/,
            /^\/sitemap\.xml$/,
            /^\/og-image\.jpg$/,
            /^\/manifest\.webmanifest$/,
            /^\/manifest\.json$/,
          ],
          runtimeCaching: [
            {
              urlPattern: /\/api\/quick-try$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'trackcode-quick-try-v1',
                expiration: {
                  maxEntries: 4,
                  maxAgeSeconds: 7 * 24 * 60 * 60,
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
