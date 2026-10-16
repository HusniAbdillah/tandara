import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['warga.spec.ts', 'posko-observations.spec.ts'],
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 1024 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/warga', open: 'never' }]],
  webServer: [
    {
      command: 'pnpm --filter @tandara/resident-web preview',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env['CI'],
      timeout: 60000,
    },
    {
      command: 'pnpm --filter @tandara/coordinator-web preview',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: !process.env['CI'],
      timeout: 60000,
    },
  ],
});
