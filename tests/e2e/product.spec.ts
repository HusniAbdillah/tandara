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
  for (const route of ['/', '/plan', '/report', '/checklist', '/training', '/help', '/tracking']) {
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
  ]) {
    await page.goto('http://127.0.0.1:8081' + route);
    await expect(page.locator('main h1').first()).toBeVisible();
    if (route === '/map') await expect(page.locator('[data-map-ready="true"]')).toBeVisible();
    await page.screenshot({
      path: screenshotDir + '/posko-' + (route.slice(1) || 'overview') + '.png',
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
