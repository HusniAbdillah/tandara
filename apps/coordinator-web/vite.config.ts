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
        name: 'Tandara Posko',
        short_name: 'Posko',
        lang: 'id',
        description: 'Ruang koordinasi kesiapsiagaan komunitas.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#10303d',
        background_color: '#f7f8f5',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        navigateFallbackDenylist: [/^\/api\//, /^\/health$/, /^\/ready$/],
        // Only the static app shell is precached. Never persist API or account data offline.
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
    }),
  ],
  server: { proxy: { '/api': apiProxyTarget } },
  preview: { proxy: { '/api': apiProxyTarget } },
});
