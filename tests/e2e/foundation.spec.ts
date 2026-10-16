import { expect, test } from '@playwright/test';
import { registerResident } from './helpers/resident.js';
const posko = process.env['POSKO_URL'] ?? 'http://127.0.0.1:8081';

// Preserve main's foundational privacy/offline checks against the delivered
// product and Compose origins rather than the retired foundation placeholders.
test('authenticated resident connects to API; offline reload requires login without caching API data', async ({
  page,
  context,
}) => {
  await registerResident(page);
  const publicResponse = page.waitForResponse(
    (response) => response.url().includes('/public') && response.status() === 200,
  );
  await page.goto('/');
  await publicResponse;
  await expect(page.locator('.w-sidebar')).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const cachedUrls = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
    }
    return urls;
  });
  expect(cachedUrls.some((url) => new URL(url).pathname.startsWith('/api/'))).toBe(false);
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveURL('/login?next=%2F');
  await expect(page.getByRole('heading', { name: 'Masuk', exact: true })).toBeVisible();
});

test('unauthenticated Posko exposes no private reports or cached API data', async ({ page }) => {
  await page.goto(posko);
  await expect(page.getByRole('heading', { name: 'Masuk ke Posko' })).toBeVisible();
  const cachedUrls = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
    }
    return urls;
  });
  expect(cachedUrls.some((url) => new URL(url).pathname.startsWith('/api/'))).toBe(false);
  await expect(page.getByRole('navigation', { name: 'Navigasi Posko' })).toHaveCount(0);
  const privateInbox = await page.request.get(
    posko + '/api/v1/regions/20000000-0000-4000-8000-000000000001/reports',
  );
  expect(privateInbox.status()).toBe(401);
  await page.screenshot({ path: 'test-results/posko-desktop.png', fullPage: true });
});

test('resident remains usable at mobile width and provides a keyboard skip link', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await registerResident(page);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Lewati ke konten' })).toHaveCount(1);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Lewati ke konten' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/warga-mobile.png', fullPage: true });
});
