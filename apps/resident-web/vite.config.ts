import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const apiProxyTarget = process.env['TANDARA_API_PROXY_TARGET'] ?? 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      manifest: {
        name: 'Tandara Warga',
        short_name: 'Tandara',
        lang: 'id',
        description: 'Kesiapsiagaan komunitas dengan informasi yang jelas.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#1F6F7A',
        background_color: '#f8f8f6',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
        navigateFallbackDenylist: [/^\/api\//, /^\/health$/, /^\/ready$/],
        // API and sensitive data are never runtime-cached by the service worker.
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
    }),
  ],
  server: { proxy: { '/api': apiProxyTarget } },
  preview: { proxy: { '/api': apiProxyTarget } },
});
