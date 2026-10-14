import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const apiProxyTarget = process.env['TANDARA_API_PROXY_TARGET'] ?? 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  // Coordinator data has no persistent service-worker cache.
  server: { proxy: { '/api': apiProxyTarget } },
  preview: { proxy: { '/api': apiProxyTarget } },
});
