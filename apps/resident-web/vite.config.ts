import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    injectRegister: null,
    manifest: {
      name: 'Tandara Warga', short_name: 'Tandara', lang: 'id',
      description: 'Kesiapsiagaan komunitas dengan informasi yang jelas.',
      start_url: '/', scope: '/', display: 'standalone',
      theme_color: '#167d7f', background_color: '#f3f7f8',
      icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg}'],
      navigateFallbackDenylist: [/^\/api\//, /^\/health$/, /^\/ready$/],
      // API and sensitive data are never runtime-cached by the service worker.
      runtimeCaching: [],
      cleanupOutdatedCaches: true,
    },
  })],
  server: { proxy: { '/api': 'http://127.0.0.1:3000' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:3000' } },
});
