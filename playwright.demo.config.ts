import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'demo-login.spec.ts',
  workers: 1,
  timeout: 30000,
  use: { viewport: { width: 1440, height: 1024 }, screenshot: 'only-on-failure' },
  webServer: [
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
