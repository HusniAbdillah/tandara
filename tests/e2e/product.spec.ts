import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, readFileSync } from 'node:fs';
const password =
  process.env['DEMO_PASSWORD'] ??
  readFileSync('.env', 'utf8')
    .match(/^DEMO_PASSWORD=(.+)$/m)?.[1]
    ?.trim();
const region = '20000000-0000-4000-8000-000000000001';
const screenshotDir = 'docs/qa/screenshots';
mkdirSync(screenshotDir, { recursive: true });
// Automated suites never fetch or sweep the public tile service. Live street
// rendering is checked separately in a visible browser with one viewport.
const fixtureTile = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP49esXAAXgAu/NVObIAAAAAElFTkSuQmCC',
  'base64',
);
test.beforeEach(async ({ context }) => {
  await context.route('https://tile.openstreetmap.org/**', async (route) => {
    await route.fulfill({
      contentType: 'image/png',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: fixtureTile,
    });
  });
});
async function login(page: Page, email = 'ciliwung@demo.tandara.test') {
  await page.goto('http://127.0.0.1:8081');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Navigasi Posko' })).toBeVisible();
}
test('citizen report, provisional triage, accountable review and receipt', async ({
  page,
  browser,
}) => {
  await page.goto('/report');
  await page.getByRole('combobox', { name: 'Wilayah', exact: true }).selectOption(region);
  const text =
    'SIMULASI browser ' + Date.now() + ': terlihat genangan di jalan dekat balai latihan.';
  await page.getByLabel('Apa yang Anda amati?').fill(text);
  await page.getByLabel('Patokan lokasi').fill('Balai latihan');
  await page.getByRole('checkbox', { name: /Saya memahami/ }).check();
  await page.getByRole('button', { name: 'Kirim laporan', exact: true }).click();
  await expect(page).toHaveURL(/tracking/);
  await expect(page.getByText('Diterima platform', { exact: true }).first()).toBeVisible();
  const context = await browser.newContext();
  const posko = await context.newPage();
  await login(posko);
  await posko.goto('http://127.0.0.1:8081/inbox');
  await posko.getByPlaceholder(/Cari/).fill(text.slice(0, 32));
  await posko.getByRole('button', { name: 'Cari', exact: true }).click();
  await posko
    .getByRole('link', { name: new RegExp(text.slice(0, 32)) })
    .first()
    .click();
  await expect(posko.getByText(text, { exact: true })).toBeVisible();
  await expect(posko.getByText(/deterministic|deterministik/).first()).toBeVisible();
  await posko.screenshot({ path: screenshotDir + '/posko-report-detail.png', fullPage: true });
  await posko
    .getByLabel('Alasan keputusan')
    .fill('Tinjauan manusia pada laporan simulasi browser.');
  await posko.getByLabel('Ringkasan publik').fill('Ringkasan simulasi dari koordinator.');
  await posko.getByRole('button', { name: /Simpan keputusan/ }).click();
  await expect(posko.getByText('Ditinjau koordinator', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Ditinjau koordinator', { exact: true }).first()).toBeVisible();
  await context.close();
});
test('saved plan survives offline restart; durable draft syncs once', async ({ page, context }) => {
  await page.goto('/plan');
  await page.getByRole('combobox', { name: 'Wilayah', exact: true }).selectOption(region);
  await page.getByRole('button', { name: /Simpan.*offline|Simpan.*perangkat/ }).click();
  await expect(page.getByText(/Rencana tersimpan di perangkat/)).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Langkah yang disepakati bersama.' }),
  ).toBeVisible();
  await expect(page.getByText(/Menggunakan data tersimpan/)).toBeVisible();
  await page.goto('/checklist');
  await page.getByRole('checkbox').first().check();
  await page.reload();
  await expect(page.getByRole('checkbox').first()).toBeChecked();
  await page.goto('/report');
  await page
    .getByLabel('Apa yang Anda amati?')
    .fill('SIMULASI offline: informasi belum lengkap, patokan belum diketahui.');
  await page.getByRole('checkbox', { name: /Saya memahami/ }).check();
  await page.getByRole('button', { name: 'Simpan laporan offline' }).click();
  await expect(
    page.getByText('Menunggu koneksi · belum dikonfirmasi server', { exact: true }).first(),
  ).toBeVisible();
  await context.setOffline(false);
  await page.getByRole('button', { name: /Sinkronkan/ }).click();
  await expect(
    page.getByText('Menunggu koneksi · belum dikonfirmasi server', { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText('Diterima platform', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(
    page
      .locator('main section.panel')
      .filter({ has: page.getByRole('heading', { name: /Laporan [a-f0-9]{8}/ }) }),
  ).toHaveCount(1);
  const receipts = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('tandara-resident');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const count = db.transaction('receipts').objectStore('receipts').count();
          count.onsuccess = () => {
            resolve(count.result);
            db.close();
          };
          count.onerror = () => reject(count.error);
        };
      }),
  );
  expect(receipts).toBe(1);
});
test('training produces stored feedback and score', async ({ page }) => {
  await page.goto('/training');
  await page.getByRole('combobox', { name: 'Wilayah', exact: true }).selectOption(region);
  await expect(page.locator('fieldset').first()).toBeVisible();
  for (const field of await page.locator('fieldset').all())
    await field.getByRole('radio').first().check();
  await page
    .getByLabel('Bagian yang perlu diperjelas')
    .fill('Simulasi browser: metadata sumber perlu dijelaskan.');
  await page.getByRole('button', { name: 'Selesaikan latihan' }).click();
  await expect(page.getByText(/Latihan selesai/)).toBeVisible();
});
test('responsive citizen pages, keyboard and WCAG AA scan', async ({ page }) => {
  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Kenali wilayah/ })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: screenshotDir + '/warga-home-' + width + '.png',
      fullPage: true,
    });
  }
  for (const route of [
    '/',
    '/plan',
    '/knowledge',
    '/report',
    '/checklist',
    '/training',
    '/help',
    '/tracking',
  ]) {
    await page.goto(route);
    await expect(page.locator('main')).toBeVisible();
    await page.screenshot({
      path: screenshotDir + '/warga-' + (route.slice(1) || 'home') + '.png',
      fullPage: true,
    });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      results.violations,
      JSON.stringify(
        results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      ),
    ).toEqual([]);
  }
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Lewati ke konten' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});
test('all Posko workflows render, map and admin configuration', async ({ page }) => {
  await login(page, 'admin@demo.tandara.test');
  await page.getByRole('combobox', { name: 'Wilayah Posko' }).selectOption(region);
  for (const route of [
    '/',
    '/inbox',
    '/map',
    '/plans',
    '/assistance',
    '/training',
    '/sources',
    '/audit',
    '/admin',
    '/notifications',
    '/ai',
    '/security',
  ]) {
    await page.goto('http://127.0.0.1:8081' + route);
    await expect(page.locator('main h1').first()).toBeVisible();
    if (route === '/map') await expect(page.locator('[data-map-ready="true"]')).toBeVisible();
    await page.screenshot({
      path:
        route === '/map'
          ? 'test-results/posko-map-fixture.png'
          : screenshotDir + '/posko-' + (route.slice(1) || 'overview') + '.png',
      fullPage: true,
    });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      results.violations,
      JSON.stringify(
        results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      ),
    ).toEqual([]);
  }
  for (const width of [360, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:8081/inbox');
    await expect(page.locator('main h1').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: screenshotDir + '/posko-inbox-' + width + '.png',
      fullPage: true,
    });
  }
});
test('AI briefing remains a private reviewed draft with visible source evidence', async ({
  page,
}) => {
  await login(page);
  await page.goto('http://127.0.0.1:8081/ai');
  await page.getByLabel('Jenis bantuan').selectOption('briefing');
  const submitted = page.waitForResponse(
    (response) => response.request().method() === 'POST' && /\/ai\/runs$/.test(response.url()),
  );
  await page.getByRole('button', { name: 'Buat draf bantuan' }).click();
  const run = await (await submitted).json();
  const result = page.locator('#ai-run-' + run.id);
  await expect(result.getByText('Perlu tinjauan', { exact: true })).toBeVisible();
  await expect(result.getByText(/Mode aturan lokal/)).toBeVisible();
  await expect(result.locator('details').first()).toBeVisible();
  await result.getByLabel('Catatan keputusan').fill('Tinjauan manusia pada draf simulasi browser.');
  await result.getByRole('button', { name: 'Terima sebagai draf' }).click();
  await result.getByText('Asal hasil dan riwayat', { exact: true }).click();
  await expect(result.getByText(/^Diterima sebagai draf ·/)).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: screenshotDir + '/posko-ai-reviewed.png', fullPage: true });
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
test('approved knowledge search shows original excerpts without generated answers', async ({
  page,
}) => {
  await page.goto('/knowledge');
  await page.getByRole('combobox', { name: 'Wilayah', exact: true }).selectOption(region);
  await page.getByLabel('Kata kunci rencana').fill('dokumen');
  await page.getByRole('button', { name: 'Cari sumber' }).click();
  await expect(page.locator('article.panel blockquote').first()).toBeVisible();
  await expect(page.getByText(/Petikan sumber asli/)).toBeVisible();
  await page.screenshot({ path: screenshotDir + '/warga-knowledge-search.png', fullPage: true });
});
test('street basemap has attribution, privacy headers and a working visibility toggle', async ({
  page,
}) => {
  const headers: Record<string, string>[] = [];
  await page.route('https://tile.openstreetmap.org/**', async (route) => {
    headers.push(route.request().headers());
    await route.fulfill({
      contentType: 'image/png',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: fixtureTile,
    });
  });
  await login(page);
  const response = await page.goto('http://127.0.0.1:8081/map');
  expect(response?.headers()['content-security-policy']).toContain(
    'https://tile.openstreetmap.org',
  );
  expect(response?.headers()['referrer-policy']).toBe('strict-origin');
  await expect(page.locator('[data-map-ready="true"][data-basemap-status="ready"]')).toBeVisible();
  await expect(page.getByRole('link', { name: '© OpenStreetMap contributors' })).toBeVisible();
  expect(headers.length).toBeGreaterThan(0);
  for (const header of headers) {
    expect(header['referer']).toBe('http://127.0.0.1:8081/');
    expect(header['cookie']).toBeUndefined();
    expect(header['x-csrf-token']).toBeUndefined();
    expect(header['x-tracking-token']).toBeUndefined();
  }
  const canvas = page.locator('.map-panel canvas');
  const before = await canvas.screenshot();
  await page.getByRole('checkbox', { name: 'Peta dasar', exact: true }).uncheck();
  await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(false);
  await page.getByRole('checkbox', { name: 'Peta dasar', exact: true }).check();
});

test('tile outages and invalid basemap configuration keep local layers available', async ({
  page,
}) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort('failed'));
  await login(page);
  await page.goto('http://127.0.0.1:8081/map');
  await expect(page.getByText(/Peta dasar tidak dapat dimuat/)).toBeVisible();
  await expect(
    page.locator('[data-map-ready="true"][data-basemap-status="unavailable"]'),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Alternatif teks lokasi' })).toBeVisible();
  await page.route('**/basemap.json', (route) =>
    route.fulfill({ json: { enabled: true, tiles: ['javascript:alert(1)'] } }),
  );
  await page.reload();
  await expect(
    page.locator('[data-map-ready="true"][data-basemap-status="unavailable"]'),
  ).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Peta dasar', exact: true })).toBeDisabled();
});

test('independent plan review publishes a new citizen version', async ({ page, browser }) => {
  const title = 'Rencana simulasi browser ' + Date.now();
  await login(page);
  await page.goto('http://127.0.0.1:8081/plans');
  await page.getByRole('button', { name: 'Buat draf baru' }).click();
  await page.getByLabel('Judul rencana').fill(title);
  await page
    .getByLabel('Alasan penyusunan / perubahan')
    .fill('Penyusunan draf untuk latihan browser.');
  await page.getByRole('button', { name: 'Simpan draf', exact: true }).click();
  const section = page
    .locator('section.panel')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
  await expect(section).toBeVisible();
  await page.getByLabel('Alasan tindakan rencana').fill('Draf siap ditinjau independen.');
  await section.getByRole('button', { name: 'Minta tinjauan' }).click();
  await expect(section.getByText(/in_review/)).toBeVisible();
  await expect(section.getByRole('button', { name: 'Setujui versi' })).toHaveCount(0);
  const context = await browser.newContext();
  const reviewer = await context.newPage();
  await login(reviewer, 'admin@demo.tandara.test');
  await reviewer.goto('http://127.0.0.1:8081/plans');
  await reviewer
    .getByLabel('Alasan tindakan rencana')
    .fill('Versi simulasi diperiksa secara independen.');
  const reviewed = reviewer
    .locator('section.panel')
    .filter({ has: reviewer.getByRole('heading', { name: title, exact: true }) });
  await reviewed.getByRole('button', { name: 'Setujui versi' }).click();
  await expect(reviewed.getByText(/approved/)).toBeVisible();
  await reviewed.getByRole('button', { name: 'Terbitkan versi ditinjau' }).click();
  await expect(reviewed.getByText(/published/)).toBeVisible();
  const citizen = await context.newPage();
  await citizen.goto('http://127.0.0.1:8080/plan');
  await expect(citizen.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await context.close();
});
