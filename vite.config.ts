import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-192.svg', 'pwa-512.svg', 'robots.txt'],
      manifest: {
        name: 'ClienteLoop',
        short_name: 'ClienteLoop',
        description: 'Inbox unificado + CRM con IA para negocios',
        theme_color: '#3B82F6',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/app',
        scope: '/',
        lang: 'es',
        icons: [
          {
            src: '/pwa-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/pwa-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Inbox',
            short_name: 'Inbox',
            description: 'Ver mensajes',
            url: '/app/inbox',
            icons: [{ src: '/pwa-192.svg', sizes: '192x192' }],
          },
          {
            name: 'Citas',
            short_name: 'Citas',
            description: 'Ver agenda de citas',
            url: '/app/appointments',
            icons: [{ src: '/pwa-192.svg', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        // Cache static assets only — exclude html so index.html is always
        // fetched from network. This ensures new Vercel deploys are picked up
        // immediately instead of the SW serving a stale bundle with no VITE_API_URL.
        globPatterns: ['**/*.{js,css,svg,png,ico,woff2}'],
        runtimeCaching: [
          {
            // Navigation requests (HTML): always go to network first so users
            // get the latest index.html (and therefore the latest JS bundle).
            urlPattern: ({ request }: { request: Request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              networkTimeoutSeconds: 3,
            },
          },
          {
            // Network-first for API reads (stats, contacts, conversations)
            urlPattern: /^https?:\/\/.*\/api\/(stats|contacts|conversations)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 5 * 60 },
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    port: 4000,
    hmr: process.env.DISABLE_HMR !== 'true',
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
