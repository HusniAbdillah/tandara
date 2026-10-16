import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { demoAccounts } from '../../packages/database/dist/index.js';

const password = 'synthetic-demo-password';
async function mock(page: Page, enabled = true) {
  let submissions = 0;
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'POST') submissions++;
    if (path.endsWith('/deployment'))
      return route.fulfill({
        json: {
          mode: 'simulation',
          residentOrigin: 'http://127.0.0.1:5173',
          coordinatorOrigin: 'http://127.0.0.1:5174',
          demoLogin: enabled ? { ...demoAccounts, password } : null,
        },
      });
    if (path.endsWith('/resident/auth/me')) return route.fulfill({ json: { user: null } });
    if (path.endsWith('/regions')) return route.fulfill({ json: [] });
    return route.fulfill({
      status: 401,
      json: { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk.' } },
    });
  });
  return () => submissions;
}

for (const width of [1440, 390]) {
  test(`Posko fills each of three accounts without submitting (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const submissions = await mock(page);
    await page.goto('http://127.0.0.1:5174');
    for (const account of demoAccounts.coordinators) {
      await page.getByRole('button', { name: new RegExp(account.name) }).click();
      await expect(page.getByLabel('Email', { exact: true })).toHaveValue(account.email);
      await expect(page.getByLabel('Kata sandi', { exact: true })).toHaveValue(password);
      await expect(page.getByRole('button', { name: new RegExp(account.name) })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    }
    expect(submissions()).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `.local/demo-posko-${width}.png`, fullPage: true });
  });
  test(`Warga fills each named resident without submitting (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const submissions = await mock(page);
    await page.goto('http://127.0.0.1:5173/login');
    for (const account of demoAccounts.residents) {
      await page.getByRole('button', { name: new RegExp(account.name) }).click();
      await expect(page.getByLabel('Nomor telepon')).toHaveValue(account.phone);
      await expect(page.getByLabel('Kata sandi', { exact: true })).toHaveValue(password);
      await expect(page.getByRole('button', { name: new RegExp(account.name) })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    }
    expect(submissions()).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `.local/demo-warga-${width}.png`, fullPage: true });
  });
}

test('disabled demo configuration hides account pickers in both apps', async ({ page }) => {
  await mock(page, false);
  for (const url of ['http://127.0.0.1:5173/login', 'http://127.0.0.1:5174']) {
    await page.goto(url);
    await expect(page.getByRole('heading', { name: /Masuk/ })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Coba akun demo' })).toHaveCount(0);
  }
});

for (const audience of ['Posko', 'Warga'] as const) {
  test(`${audience} shows a readable empty-proxy error and allows another sign-in attempt`, async ({
    page,
  }) => {
    await mock(page);
    let attempts = 0;
    await page.route(/\/api\/v1\/(resident\/)?auth\/login$/, (route) => {
      attempts++;
      return attempts === 1
        ? route.fulfill({ status: 502, body: '' })
        : route.fulfill({
            status: 401,
            json: {
              error: {
                code: 'UNAUTHORIZED',
                message: 'Periksa kembali data masuk.',
                requestId: 'retry-test',
              },
            },
          });
    });
    const staff = audience === 'Posko';
    await page.goto(staff ? 'http://127.0.0.1:5174' : 'http://127.0.0.1:5173/login');
    const account = staff ? demoAccounts.coordinators[0]! : demoAccounts.residents[0]!;
    await page.getByRole('button', { name: new RegExp(account.name) }).click();
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText(
      'Layanan sedang tidak tersedia. Tunggu sebentar lalu coba lagi.',
    );
    await expect(page.getByLabel('Kata sandi', { exact: true })).toHaveValue(password);
    await expect(page.getByRole('button', { name: 'Masuk', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Periksa kembali data masuk.');
    expect(attempts).toBe(2);
    expect(await page.locator('body').innerText()).not.toMatch(
      /\*\*Masuk\*\*|&#x20;|Unexpected end of JSON/,
    );
  });
}
