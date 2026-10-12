import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  workers: 2,
  use: { browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'node --env-file=.env apps/api/dist/main.js',
      url: 'http://127.0.0.1:3000/health',
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: 'pnpm --filter @tandara/resident-web preview',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: 'pnpm --filter @tandara/coordinator-web preview',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: !process.env['CI'],
    },
  ],
});
