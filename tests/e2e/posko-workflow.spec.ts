import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const warga = process.env['WARGA_URL'] ?? 'http://localhost:5173';
const posko = process.env['POSKO_URL'] ?? 'http://localhost:5174';
test.use({ serviceWorkers: 'block' });
test('Warga → Admin → Koordinator → Admin → Warga, with responsive layout and preserved drafts', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const residentContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block',
  });
  const adminContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block',
  });
  const coordinatorContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'block',
  });
  const resident = await residentContext.newPage(),
    admin = await adminContext.newPage(),
    coordinator = await coordinatorContext.newPage();
  async function login(page: Page, email: string) {
    await page.goto(posko);
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Kata sandi', { exact: true }).fill(process.env['DEMO_PASSWORD']!);
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Selamat datang/ })).toBeVisible();
  }
  await resident.goto(warga + '/report');
  await resident
    .getByLabel('Apa yang Anda amati?')
    .fill('Uji browser: genangan di dekat pintu balai warga.');
  await resident.getByLabel('Patokan lokasi').fill('Pintu balai warga RT 03');
  await resident.getByRole('checkbox', { name: /Saya menyetujui/ }).check();
  const sent = resident.waitForResponse(
    (r) => r.url().endsWith('/api/v1/reports') && r.request().method() === 'POST',
  );
  await resident.getByRole('button', { name: 'Kirim laporan', exact: true }).click();
  const response = await sent;
  expect(response.status()).toBe(201);
  const receipt = await response.json();
  await login(admin, 'admin@demo.tandara.test');
  await login(coordinator, 'ciliwung@demo.tandara.test');
  async function act(page: Page, action: string, message: string) {
    await page.getByLabel('Tindakan', { exact: false }).selectOption(action);
    await page
      .getByLabel(action === 'submit_resolution' ? 'Hasil penanganan' : 'Pesan untuk warga', {
        exact: false,
      })
      .fill(message);
    const response = page.waitForResponse(
      (r) => r.url().endsWith('/workflow') && r.request().method() === 'POST',
    );
    await page.locator('button[type=submit]').click();
    expect((await response).status()).toBe(201);
    await expect(page.locator('textarea')).toHaveValue('');
  }
  await admin.goto(posko + '/reports/' + receipt.id);
  await act(admin, 'verify', 'Lokasi dan informasi genangan telah diperiksa.');
  await admin.getByLabel('Tindakan', { exact: false }).selectOption('assign');
  await admin
    .getByLabel('Koordinator penanggung jawab')
    .selectOption('30000000-0000-4000-8000-000000000001');
  await act(admin, 'assign', 'Koordinator wilayah akan memeriksa saluran air.');
  await coordinator.goto(posko + '/reports/' + receipt.id);
  await expect(coordinator.getByRole('navigation', { name: 'Navigasi mobile' })).toBeVisible();
  expect(await coordinator.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  await act(coordinator, 'start', 'Petugas tiba di lokasi dan memulai pemeriksaan.');
  await coordinator
    .getByLabel('Pesan untuk warga', { exact: false })
    .fill('Draf perkembangan tidak boleh hilang.');
  await coordinator.evaluate(() => {
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));
  });
  await coordinator.waitForTimeout(31000);
  await expect(coordinator.getByLabel('Pesan untuk warga', { exact: false })).toHaveValue(
    'Draf perkembangan tidak boleh hilang.',
  );
  await act(
    coordinator,
    'submit_resolution',
    'Saluran telah dibersihkan dan genangan sudah surut.',
  );
  await admin.reload();
  await act(
    admin,
    'approve',
    'Hasil penanganan sudah diperiksa. Mohon konfirmasi kondisi di lokasi.',
  );
  await resident.goto(warga + '/tracking?id=' + receipt.id);
  await expect(
    resident.getByRole('heading', { name: 'Apakah masalah sudah selesai?' }),
  ).toBeVisible();
  await resident.getByLabel('Catatan untuk Posko').fill('Sudah tidak ada genangan. Terima kasih.');
  await resident.getByRole('button', { name: 'Konfirmasi selesai', exact: true }).click();
  await expect(resident.locator('.is-current')).toContainText('Selesai');
  await admin.goto(posko + '/analytics');
  await expect(admin.getByRole('heading', { name: 'Rekap laporan', exact: true })).toBeVisible();
  await expect(admin.getByText('Data belum dapat dimuat.', { exact: false })).toHaveCount(0);
  // Erase only the report created by this test, using the normal privacy workflow.
  await resident.request.post(warga + `/api/v1/reports/${receipt.id}/deletion-request`, {
    headers: { 'X-Tandara-Client': 'web', 'X-Tracking-Token': receipt.trackingToken },
  });
  const csrf = (await adminContext.cookies()).find((c) => c.name === 'tandara_csrf')!.value;
  const operations = await (await admin.request.get(posko + '/api/v1/admin/operations')).json();
  const deletion = operations.deletions.find(
    (d: { reportId: string }) => d.reportId === receipt.id,
  );
  expect(deletion).toBeTruthy();
  await admin.request.post(posko + `/api/v1/admin/deletions/${deletion.id}/complete`, {
    headers: { 'X-Tandara-Client': 'web', 'X-CSRF-Token': csrf },
  });
  await Promise.all([residentContext.close(), adminContext.close(), coordinatorContext.close()]);
});
