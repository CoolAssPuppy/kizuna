import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Tables the bus has no signal for. Anything in this list is served
// stale-while-revalidate so the offline cache keeps the app readable.
const OFFLINE_CACHED_TABLES = [
  'itinerary_items',
  'registrations',
  'documents',
  'flights',
  'accommodations',
  'accommodation_occupants',
  'transport_requests',
  'sessions',
  'events',
] as const;

const OFFLINE_CACHED_PATTERN = new RegExp(`^/rest/v1/(${OFFLINE_CACHED_TABLES.join('|')})`);

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: {
        enabled: false,
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: ({ url }) => OFFLINE_CACHED_PATTERN.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'kizuna-data-v2',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24,
              },
            },
          },
        ],
      },
      manifest: {
        name: 'Kizuna',
        short_name: 'Kizuna',
        description: 'Event and community platform for Supafest',
        theme_color: '#1f1f1f',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
