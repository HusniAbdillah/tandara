import { expect, test } from '@playwright/test';

// Preserve main's foundational privacy/offline checks against the delivered
// product and Compose origins rather than the retired foundation placeholders.
test('resident connects to API and reloads offline without caching API data', async ({
  page,
  context,
}) => {
  const publicResponse = page.waitForResponse(
    (response) => response.url().includes('/public') && response.status() === 200,
  );
  await page.goto('/');
  await publicResponse;
  await expect(page.getByRole('heading', { name: /Kenali wilayah/ })).toBeVisible();
  await expect(page.getByText('Terhubung', { exact: true })).toBeVisible();
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
  await expect(page.getByRole('navigation', { name: 'Navigasi warga' })).toBeVisible();
  await expect(page.getByText('Offline · data tersimpan', { exact: true })).toBeVisible();
  await expect(page.getByText(/Simpan rencana saat online/)).toBeVisible();
});

test('unauthenticated Posko exposes no private reports and has no service worker', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:8081');
  await expect(page.getByRole('heading', { name: 'Masuk ke Posko' })).toBeVisible();
  expect(
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length),
  ).toBe(0);
  await expect(page.getByRole('navigation', { name: 'Navigasi Posko' })).toHaveCount(0);
  const privateInbox = await page.request.get(
    'http://127.0.0.1:8081/api/v1/regions/20000000-0000-4000-8000-000000000001/reports',
  );
  expect(privateInbox.status()).toBe(401);
  await page.screenshot({ path: 'test-results/posko-desktop.png', fullPage: true });
});

test('resident remains usable at mobile width and provides a keyboard skip link', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Lewati ke konten' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/warga-mobile.png', fullPage: true });
});
