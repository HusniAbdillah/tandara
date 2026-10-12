import { expect, test } from '@playwright/test';

test('resident shell connects to API and reloads offline without caching API data', async ({
  page,
  context,
}) => {
  await page.goto('http://127.0.0.1:5173');
  await expect(page.getByRole('heading', { name: 'Fondasi Tandara Warga' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('API terhubung');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
    }
  });
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
  await expect(page.getByRole('heading', { name: 'Fondasi Tandara Warga' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('API belum terhubung');
});

test('coordinator shell has no service worker and does not contain resident data', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:5174');
  await expect(page.getByRole('heading', { name: 'Fondasi Tandara Posko' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('API terhubung');
  expect(
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length),
  ).toBe(0);
  await expect(
    page.getByText('Halaman ini belum memuat data warga.', { exact: false }),
  ).toBeVisible();
});

test('resident remains usable at mobile width and provides a keyboard skip link', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('http://127.0.0.1:5173');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Lewati ke konten' })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
