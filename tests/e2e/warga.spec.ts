import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const regionId = '20000000-0000-4000-8000-000000000001';
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
});
const region = {
  id: regionId,
  name: 'Kampung Melayu',
  organizationId: '10000000-0000-4000-8000-000000000001',
  organization: 'Jakarta Timur',
  config: {
    categories: [
      'road_flooding',
      'blocked_access',
      'damaged_facility',
      'other',
      'follow_up_needed',
    ],
    coverageHours: 24,
    retentionDays: 30,
    contacts: [],
    languages: ['id'],
  },
  boundary: {
    type: 'Polygon',
    coordinates: [
      [
        [106.86, -6.22],
        [106.87, -6.22],
        [106.87, -6.23],
        [106.86, -6.23],
        [106.86, -6.22],
      ],
    ],
  },
  simulation: true,
  suspended: false,
};
const plan = {
  id: '30000000-0000-4000-8000-000000000001',
  regionId,
  version: 3,
  state: 'published',
  content: {
    title: 'Rencana evakuasi RW 06',
    instructions: ['Siapkan dokumen penting', 'Sepakati kontak keluarga', 'Cari titik kumpul'],
    points: [
      {
        name: 'Balai Warga RW 06',
        description: 'Titik kumpul warga',
        latitude: -6.226,
        longitude: 106.865,
        accessibility: 'Pintu utama',
      },
    ],
    routes: [],
    checklist: [
      'Dokumen penting',
      'Air dan kebutuhan dasar',
      'Kontak keluarga',
      'Obat dan kebutuhan khusus',
      'Baca rencana RW 06',
    ],
    expiresAt: '2027-01-01T00:00:00Z',
  },
  owner: 'Posko Kampung Melayu',
  createdAt: '2026-10-15T00:00:00Z',
  reviewedAt: '2026-10-15T00:00:00Z',
  reviewer: 'Posko',
  authorId: '40000000-0000-4000-8000-000000000001',
  updatedAt: '2026-10-15T00:00:00Z',
  simulation: true,
};
const water = {
  id: 'cantiga',
  name: 'Cantiga–Karang Tengah',
  location: { latitude: -6.226, longitude: 106.869 },
  heightCm: 57,
  status: 'normal',
  updatedAt: '2026-10-15T13:00:00Z',
  thresholds: [
    { status: 'normal', label: '<151 cm' },
    { status: 'waspada', label: '151–175 cm' },
    { status: 'siaga', label: '151–200 cm' },
    { status: 'bahaya', label: '>200 cm' },
  ],
};
const earthquake = {
  id: 'bogor',
  location: { latitude: -6.73, longitude: 106.61 },
  occurredAt: '2026-10-15T10:58:23Z',
  magnitude: 4.1,
  depthKm: 5,
  region: 'Pusat gempa berada di darat 26 km barat daya kota Bogor',
  felt: 'IV Pamijahan, IV Kabandungan',
};
const questions = [
  {
    question: 'Mana sumber rencana lingkunganmu?',
    options: ['Rencana RW dari Posko', 'Pesan tanpa sumber', 'Unggahan tanpa tanggal'],
    answer: 0,
    explanation: 'Baca rencana yang diterbitkan Posko.',
  },
  {
    question: 'Apa yang bisa dibuka tanpa internet?',
    options: ['Rencana yang sudah diunduh', 'Semua kabar terbaru'],
    answer: 0,
    explanation: 'Unduh rencana terlebih dahulu.',
  },
  {
    question: 'Di mana melihat perkembangan laporan?',
    options: ['Laporan saya', 'Pesan pribadi'],
    answer: 0,
    explanation: 'Buka Laporan saya untuk melihat status.',
  },
];
const reportId = '50000000-0000-4000-8000-000000000001';
const receipt = { id: reportId, trackingToken: '1'.repeat(72), state: 'submitted' };
const tile = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP49esXAAXgAu/NVObIAAAAAElFTkSuQmCC',
  'base64',
);
async function fixtures(page: Page, authenticated = true) {
  const resident = {
    id: '60000000-0000-4000-8000-000000000001',
    phone: '+6281234567890',
    name: 'Warga',
  };
  let signedIn = authenticated;
  const { createReportSchema } = await import('../../packages/contracts/dist/index.js');
  const payloads: unknown[] = [];
  await page.context().route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({
      contentType: 'image/png',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: tile,
    }),
  );
  await page.context().route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    let body: unknown;
    if (path === '/regions') body = [region];
    else if (path.endsWith('/public'))
      body = {
        region,
        plans: [plan],
        information: [],
        reports: [],
        sources: [],
        fetchedAt: '2026-10-16T00:00:00Z',
      };
    else if (path === '/resident/auth/me') body = { user: signedIn ? resident : null };
    else if (path === '/resident/auth/login' || path === '/resident/auth/register') {
      signedIn = true;
      body = { user: resident };
    } else if (path === '/resident/auth/logout') {
      signedIn = false;
      body = { ok: true };
    } else if (path === '/resident/reports') body = { items: [], page: 1, total: 0 };
    else if (path === '/resident/notifications') body = { items: [], unreadCount: 0 };
    else if (path.endsWith('/observations'))
      body = {
        mode: 'simulation',
        fetchedAt: '2026-10-16T00:00:00Z',
        water: [water],
        earthquakes: [earthquake],
      };
    else if (path.endsWith('/training'))
      body = [
        {
          id: '70000000-0000-4000-8000-000000000001',
          regionId,
          content: {
            title: 'Kuis sumber informasi',
            description: 'Pelajari sumber informasi wilayah.',
            steps: questions,
            scheduledAt: null,
          },
          simulation: true,
          participants: 0,
          completed: 0,
          feedback: [],
        },
      ];
    else if (path.endsWith('/results')) body = { score: 3, total: 3 };
    else if (path === '/reports' && route.request().method() === 'POST') {
      const value = createReportSchema.parse(route.request().postDataJSON());
      payloads.push(value);
      expect(route.request().headers()['idempotency-key']).toBeTruthy();
      body = receipt;
    } else if (path.endsWith('/tracking'))
      body = {
        id: reportId,
        state: 'submitted',
        createdAt: '2026-10-16T00:00:00Z',
        updatedAt: '2026-10-16T00:00:00Z',
        history: [],
        assistanceState: null,
        erased: false,
      };
    else if (path.endsWith('/deletion-request')) body = { ok: true };
    else
      return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: path } } });
    return route.fulfill({ json: body });
  });
  return payloads;
}
for (const viewport of [
  { width: 1440, height: 1024 },
  { width: 390, height: 844 },
]) {
  test(`live observation details and source failures at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await fixtures(page);
    await page.route('**/api/v1/regions/*/observations', (route) =>
      route.fulfill({
        json: {
          mode: 'live',
          fetchedAt: '2026-10-16T06:40:00Z',
          water: [
            {
              ...water,
              id: 'dsda-167',
              name: 'Rumah Pompa Pluit 1',
              heightCm: -167,
              status: 'waspada',
              thresholds: [],
            },
          ],
          earthquakes: [],
          sources: [
            {
              id: 'dsda',
              name: 'Dinas SDA DKI Jakarta',
              url: 'https://poskobanjir.dsdadki.web.id/',
              status: 'stale',
              checkedAt: '2026-10-16T06:40:00Z',
              lastSuccessAt: '2026-10-16T06:30:00Z',
              skippedRecords: 0,
            },
            {
              id: 'bmkg',
              name: 'BMKG',
              url: 'https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json',
              status: 'unavailable',
              checkedAt: '2026-10-16T06:40:00Z',
              lastSuccessAt: null,
              skippedRecords: 0,
            },
          ],
        },
      }),
    );
    await page.goto('/map?panel=water&id=dsda-167');
    const panel = page.getByRole('complementary', { name: 'Tinggi air' });
    await expect(panel.getByRole('heading', { name: 'Rumah Pompa Pluit 1' })).toBeVisible();
    await expect(panel.getByText('-167 cm', { exact: true })).toBeVisible();
    await expect(panel.getByText('Belum diketahui', { exact: true })).toBeVisible();
    await expect(page.locator('.pin-water.unknown')).toHaveCSS(
      'background-color',
      'rgb(107, 114, 128)',
    );
    expect(
      await panel
        .locator('.w-status.unknown')
        .evaluate((node) => getComputedStyle(node, '::before').backgroundColor),
    ).toBe('rgb(107, 114, 128)');
    await expect(panel.getByText('Belum tersedia', { exact: true })).toBeVisible();
    await expect(panel.getByText('Menampilkan data terakhir')).toBeVisible();
    await expect(panel.getByRole('link', { name: 'Dinas SDA DKI Jakarta' })).toHaveAttribute(
      'href',
      'https://poskobanjir.dsdadki.web.id/',
    );
    await page.screenshot({ path: `test-results/live-water-${viewport.width}.png` });
    await page.getByRole('button', { name: 'Kembali ke daftar' }).click();
    await expect(panel.getByText(/-167 cm · Belum diketahui/)).toBeVisible();
    await page.getByRole('button', { name: 'Gempa', exact: true }).click();
    await expect(
      page.getByRole('complementary', { name: 'Gempa' }).getByText('Sumber belum dapat diakses'),
    ).toBeVisible();
    await expect(
      page.getByRole('complementary', { name: 'Gempa' }).getByRole('link', { name: 'BMKG' }),
    ).toBeVisible();
  });
}

test('desktop Chalk shell, aligned dashboard and full-screen map sidebars', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await fixtures(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Kampung Melayu', exact: true })).toBeVisible();
  const cards = await page.locator('.w-home-action').evaluateAll((nodes) =>
    nodes.map((n) => {
      const b = n.getBoundingClientRect();
      return { width: b.width, height: b.height, y: b.y };
    }),
  );
  expect(cards).toHaveLength(3);
  expect(new Set(cards.map((c) => c.height)).size).toBe(1);
  expect(
    Math.max(...cards.map((c) => c.width)) - Math.min(...cards.map((c) => c.width)),
  ).toBeLessThan(1);
  await page.screenshot({ path: 'test-results/chalk-desktop-home.png', fullPage: true });
  await page.goto('/map');
  const map = await page.locator('.w-map-page').boundingBox();
  expect(map?.x).toBe(232);
  expect(map?.width).toBe(1208);
  expect(map?.height).toBe(1024);
  await page.getByRole('button', { name: 'Filter & legenda' }).click();
  await page.getByRole('switch', { name: 'Tinggi air', exact: true }).uncheck();
  await expect(page.locator('.pin-water')).toHaveCount(0);
  await page.getByRole('switch', { name: 'Tinggi air', exact: true }).check();
  await expect(page.locator('.pin-water')).toHaveCount(1);
  await page.getByRole('button', { name: '500 m', exact: true }).click();
  await expect(page.locator('.pin-water')).toHaveCount(0);
  await page.getByRole('button', { name: 'Semua', exact: true }).click();
  await expect(page.locator('.pin-water')).toHaveCount(1);
  await page.getByRole('button', { name: 'Lokasi tinggi air' }).click();
  await page.getByRole('button', { name: /Cantiga/ }).click();
  await expect(
    page.getByRole('complementary', { name: 'Tinggi air' }).getByText('57 cm', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('151–200 cm')).toBeVisible();
  await expect(page.locator('.w-map-panel')).toHaveCSS('width', '384px');
  await page.screenshot({ path: 'test-results/chalk-desktop-water.png' });
  await page.getByRole('button', { name: 'Kembali ke daftar' }).click();
  await page.getByRole('button', { name: 'Gempa', exact: true }).click();
  await page
    .getByRole('complementary', { name: 'Gempa' })
    .getByRole('button', { name: /M 4.1/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Gempa M 4.1' })).toBeVisible();
  await expect(page.getByText('IV Pamijahan, IV Kabandungan')).toBeVisible();
  expect(errors).toEqual([]);
});
test('desktop single-page report submits once and opens the shared status view', async ({
  page,
}) => {
  const payloads = await fixtures(page);
  await page.goto('/report');
  await page.getByLabel('Apa yang Anda amati?').fill('Air menggenang di jalan dekat balai warga.');
  await page.getByLabel('Patokan lokasi').fill('Balai Warga RW 06');
  await page.getByRole('checkbox', { name: /Saya menyetujui/ }).check();
  await expect(page.getByRole('button', { name: 'Kirim laporan', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/chalk-desktop-report.png', fullPage: true });
  await page.getByRole('button', { name: 'Kirim laporan', exact: true }).click();
  await expect(page).toHaveURL(/tracking/);
  await expect(page.getByRole('heading', { name: 'Laporan terkirim' })).toBeVisible();
  expect(payloads).toHaveLength(1);
  await expect(page.getByRole('button', { name: 'Ke beranda' })).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByText('Air menggenang di jalan dekat balai warga.', { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Ajukan penghapusan', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ajukan penghapusan' }).click();
  await expect(page.getByText('Permintaan penghapusan diterima.')).toBeVisible();
});
test('a rejected photo can be retried without submitting the accepted report again', async ({
  page,
}) => {
  const payloads = await fixtures(page);
  await page.context().addCookies([
    {
      name: 'tandara_resident_csrf',
      value: 'synthetic-photo-csrf',
      url: 'http://127.0.0.1:5173',
    },
  ]);
  let uploads = 0;
  await page.route('**/api/v1/reports/*/attachments', async (route) => {
    uploads++;
    expect(route.request().headers()['x-csrf-token']).toBe('synthetic-photo-csrf');
    expect(route.request().headers()['x-tracking-token']).toBe(receipt.trackingToken);
    await route.fulfill(
      uploads === 1
        ? {
            status: 403,
            json: {
              error: {
                code: 'FORBIDDEN',
                message: 'Muat ulang halaman lalu coba lagi.',
                requestId: 'synthetic-photo-rejection',
              },
            },
          }
        : { status: 201, json: { id: '80000000-0000-4000-8000-000000000001' } },
    );
  });
  await page.goto('/report');
  await page.getByLabel('Apa yang Anda amati?').fill('Air menggenang di jalan dekat balai warga.');
  await page.getByLabel('Foto kejadian', { exact: true }).setInputFiles({
    name: 'kejadian.png',
    mimeType: 'image/png',
    buffer: tile,
  });
  await page.getByRole('checkbox', { name: /Saya menyetujui/ }).check();
  await page.getByRole('button', { name: 'Kirim laporan', exact: true }).click();
  await expect(page.getByText(/Laporan sudah diterima. Foto belum terkirim./)).toBeVisible();
  await expect(page.getByText(/Muat ulang halaman lalu coba lagi./)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Lihat laporan', exact: true })).toHaveAttribute(
    'href',
    '/tracking?id=' + receipt.id,
  );
  await expect(page.getByLabel('Foto kejadian', { exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Coba kirim foto lagi', exact: true }).click();
  await expect(page).toHaveURL(/tracking/);
  expect(payloads).toHaveLength(1);
  expect(uploads).toBe(2);
});

test('mobile report uses three steps, preserves inputs and has no horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const payloads = await fixtures(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Peta dan bantuan/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/chalk-mobile-home.png', fullPage: true });
  await page.getByRole('link', { name: 'Buat laporan', exact: true }).click();
  await page.getByRole('button', { name: 'Genangan', exact: true }).click();
  await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
  await page
    .getByLabel('Apa yang Anda amati?')
    .fill('Air menggenang di depan gang dekat balai warga.');
  await page.screenshot({ path: 'test-results/chalk-mobile-report.png', fullPage: true });
  await page.getByRole('button', { name: 'Tentukan lokasi' }).click();
  await page.getByLabel('Patokan lokasi').fill('Dekat balai warga');
  await page.getByRole('button', { name: 'Cek laporan' }).click();
  await expect(
    page.getByRole('heading', { name: 'Air menggenang di depan gang dekat balai warga.' }),
  ).toBeVisible();
  await page.getByRole('checkbox', { name: /Saya menyetujui/ }).check();
  await page.getByRole('button', { name: 'Kirim laporan' }).click();
  await expect(page).toHaveURL(/tracking/);
  expect(payloads).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('support contact switch omits private contact when disabled', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const payloads = await fixtures(page);
  await page.goto('/support');
  await page
    .getByLabel('Bantuan yang dibutuhkan')
    .fill('Perlu air minum untuk keluarga di balai warga.');
  await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
  await page.getByLabel('Nomor tambahan', { exact: true }).fill('081234567890');
  await page.getByRole('switch', { name: /Bagikan nomor tambahan/ }).check();
  await page.getByRole('button', { name: 'Gunakan nomor akun' }).click();
  await page.getByRole('checkbox', { name: /Saya menyetujui/ }).check();
  await page.getByRole('button', { name: 'Kirim permintaan' }).click();
  await expect(page).toHaveURL(/tracking/);
  expect(payloads[0]).toMatchObject({ followUpRequested: true, contactPermission: false });
  expect(payloads[0]).not.toHaveProperty('contactDetails');
});
test('guide checklist, downloaded plan and quiz remain connected', async ({ page }) => {
  await fixtures(page);
  await page.goto('/guide');
  await page.getByRole('checkbox').first().check();
  await page.reload();
  await expect(page.getByRole('checkbox').first()).toBeChecked();
  await page.getByRole('button', { name: 'Unduh rencana' }).click();
  await expect(page.getByText('Rencana diunduh. Bisa dibuka tanpa internet.')).toBeVisible();
  await page.goto('/downloads');
  await expect(page.getByRole('heading', { name: 'Rencana evakuasi RW 06' })).toBeVisible();
  await page.screenshot({ path: 'test-results/chalk-desktop-downloads.png', fullPage: true });
  await page.goto('/training');
  await page.getByRole('button', { name: 'Mulai kuis' }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('radio').first().check();
    await page.getByRole('button', { name: 'Pilih jawaban' }).click();
    await page
      .getByRole('button', { name: i < 2 ? 'Pertanyaan berikutnya' : 'Lihat hasil' })
      .click();
  }
  await expect(page.getByRole('heading', { name: 'Hasil kuis' })).toBeVisible();
  await expect(page.getByText('3 / 3', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/chalk-desktop-result.png', fullPage: true });
});
test('phone auth screens are centered, accessible and route into the app', async ({ page }) => {
  await fixtures(page, false);
  await page.goto('/login');
  await expect(page.getByLabel('Nomor telepon')).toHaveValue('081234560001');
  await expect(page.getByLabel('Kata sandi', { exact: true })).toHaveValue('TandaraDemo2026!');
  await page.getByRole('link', { name: 'Daftar', exact: true }).click();
  await expect(page.getByLabel('Nomor telepon')).toHaveValue('');
  await expect(page.getByLabel('Kata sandi', { exact: true })).toHaveValue('');
  await page.getByRole('link', { name: 'Masuk', exact: true }).click();
  await expect(page.getByLabel('Nomor telepon')).toHaveValue('081234560001');
  await expect(page.getByLabel('Kata sandi', { exact: true })).toHaveValue('TandaraDemo2026!');
  const form = await page.locator('.w-auth-form').boundingBox();
  expect(Math.abs(form!.x + form!.width / 2 - 720)).toBeLessThan(1);
  expect(Math.abs(form!.y + form!.height / 2 - 512)).toBeLessThan(1);
  await page.getByLabel('Nomor telepon').fill('081234567890');
  await page.getByLabel('Kata sandi', { exact: true }).fill('synthetic-password');
  await page.getByRole('button', { name: 'Tampilkan kata sandi' }).click();
  await expect(page.getByLabel('Kata sandi', { exact: true })).toHaveAttribute('type', 'text');
  const audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations).toEqual([]);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/register');
  await page.getByLabel('Nama', { exact: true }).fill('Rani Uji');
  await page.getByLabel('Nomor telepon').fill('081234567890');
  await page.getByLabel('Kata sandi', { exact: true }).fill('synthetic-password');
  await page.getByRole('button', { name: 'Daftar', exact: true }).click();
  await expect(page).toHaveURL('/area');
});

test('signed-out routes redirect to login and registration returns to the requested page', async ({
  page,
}) => {
  await fixtures(page, false);
  for (const path of [
    '/',
    '/map',
    '/support',
    '/tracking',
    '/training',
    '/report?category=blocked_access',
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL('/login?next=' + encodeURIComponent(path));
    await expect(page.getByRole('button', { name: 'Kirim laporan', exact: true })).toHaveCount(0);
  }
  await page.getByRole('link', { name: 'Daftar', exact: true }).click();
  await expect(page).toHaveURL(
    '/register?next=' + encodeURIComponent('/report?category=blocked_access'),
  );
  await page.getByLabel('Nama', { exact: true }).fill('Rani Uji');
  await page.getByLabel('Nomor telepon').fill('081234567890');
  await page.getByLabel('Kata sandi', { exact: true }).fill('synthetic-password');
  await page.getByRole('button', { name: 'Daftar', exact: true }).click();
  await expect(page).toHaveURL('/report?category=blocked_access');
  await expect(page.getByLabel('Apa yang Anda amati?')).toBeVisible();
});

test('a 401 during submission redirects to login and preserves the queued report', async ({
  page,
}) => {
  await fixtures(page);
  await page.goto('/report');
  await page
    .getByLabel('Apa yang Anda amati?')
    .fill('Antrean laporan harus tetap ada setelah sesi berakhir.');
  await page.getByRole('checkbox', { name: /Saya menyetujui/ }).check();
  await page.route('**/api/v1/resident/auth/me', (r) => r.fulfill({ json: { user: null } }));
  await page.route('**/api/v1/reports', (r) =>
    r.fulfill({
      status: 401,
      json: { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk kembali.' } },
    }),
  );
  await page.getByRole('button', { name: 'Kirim laporan', exact: true }).click();
  await expect(page).toHaveURL('/login?next=%2Freport');
  await expect(page.locator('.w-auth-form')).toBeVisible();
  const drafts = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('tandara-resident');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<number>((resolve, reject) => {
        const request = db.transaction('drafts').objectStore('drafts').count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  });
  expect(drafts).toBe(1);
});

test('login return URLs cannot redirect to an external site', async ({ page }) => {
  await fixtures(page, false);
  await page.goto('/login?next=' + encodeURIComponent('https://example.test/steal'));
  await page.getByLabel('Nomor telepon').fill('081234567890');
  await page.getByLabel('Kata sandi', { exact: true }).fill('synthetic-password');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page).toHaveURL('/');
});

test('account history opens on a fresh device and personal notifications retain read state', async ({
  page,
}, testInfo) => {
  await fixtures(page);
  await page.context().addCookies([
    {
      name: 'tandara_resident_csrf',
      value: 'fixture-resident-csrf',
      url: String(testInfo.project.use.baseURL),
    },
  ]);
  const user = {
    id: '60000000-0000-4000-8000-000000000001',
    phone: '+6281234567890',
    name: 'Warga',
  };
  const summary = {
    id: reportId,
    regionId,
    state: 'under_review',
    description: 'Laporan akun dari perangkat lain.',
    category: 'road_flooding',
    landmark: null,
    followUp: false,
    createdAt: '2026-10-16T00:00:00Z',
  };
  let loggedIn = true,
    read = false;
  let confirmed = false;
  await page.route('**/api/v1/resident/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    if (path === '/resident/auth/me')
      return route.fulfill({ json: { user: loggedIn ? user : null } });
    if (path === '/resident/auth/logout') {
      loggedIn = false;
      return route.fulfill({ json: { ok: true } });
    }
    if (path === '/resident/notifications')
      return route.fulfill({
        json: {
          items: [
            {
              id: '70000000-0000-4000-8000-000000000001',
              reportId,
              action: 'workflow.resolved',
              createdAt: '2026-10-16T00:00:00Z',
              readAt: read ? '2026-10-16T01:00:00Z' : null,
              followUp: false,
            },
          ],
          unreadCount: read ? 0 : 1,
        },
      });
    if (path === '/resident/notifications/read') {
      read = true;
      return route.fulfill({ json: { ok: true } });
    }
    if (path === '/resident/reports')
      return route.fulfill({ json: { items: [summary], page: 1, total: 1 } });
    if (path === '/resident/reports/' + reportId) return route.fulfill({ json: summary });
    if (path === '/resident/reports/' + reportId + '/feedback') {
      expect(route.request().headers()['x-csrf-token']).toBe('fixture-resident-csrf');
      expect(route.request().headers()['x-tracking-token']).toBeUndefined();
      expect(route.request().postDataJSON().action).toBe('confirm');
      confirmed = true;
      return route.fulfill({ json: { ok: true } });
    }
    if (path.endsWith('/tracking'))
      return route.fulfill({
        json: {
          id: reportId,
          state: 'under_review',
          createdAt: summary.createdAt,
          updatedAt: summary.createdAt,
          history: [],
          assistanceState: null,
          erased: false,
          workflow: {
            status: confirmed ? 'closed' : 'resolved',
            assigneeId: null,
            assigneeName: null,
            priority: 'normal',
            revision: confirmed ? 3 : 2,
          },
        },
      });
    return route.fallback();
  });
  await page.goto('/notifications');
  await expect(page.locator('.w-notification-count').first()).toHaveText('1');
  await page.getByRole('button', { name: /Penanganan selesai, periksa hasilnya/ }).click();
  await expect(page).toHaveURL('/tracking?id=' + reportId);
  await expect(page.locator('.w-report-list').getByText(summary.description)).toBeVisible();
  expect(read).toBe(true);
  await expect(page.locator('.w-notification-count')).toHaveCount(0);
  await page.getByLabel('Catatan untuk Posko').fill('Penanganan sudah selesai, terima kasih.');
  await page.getByRole('button', { name: 'Konfirmasi selesai', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Apakah masalah sudah selesai?' })).toHaveCount(0);
  expect(confirmed).toBe(true);
  await page.goto('/tracking?id=99999999-9999-4999-8999-999999999999');
  await expect(
    page.getByRole('heading', { name: 'Laporan tidak ditemukan', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.w-status-detail')).toHaveCount(0);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await page.goto('/tracking');
  await expect(page.getByText(summary.description)).toHaveCount(0);
});

test('another account cannot see or synchronize locally queued reports owned by someone else', async ({
  page,
}) => {
  const payloads = await fixtures(page);
  let sessionCalls = 0;
  const owner = '60000000-0000-4000-8000-000000000001';
  await page.route('**/api/v1/resident/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) {
      sessionCalls++;
      return route.fulfill({
        json: {
          user: {
            id: '60000000-0000-4000-8000-000000000002',
            phone: '+6281399999999',
            name: 'Warga lain',
          },
        },
      });
    }
    if (path.endsWith('/notifications'))
      return route.fulfill({ json: { items: [], unreadCount: 0 } });
    if (path.endsWith('/reports')) return route.fulfill({ json: { items: [], page: 1, total: 0 } });
    return route.fallback();
  });
  await page.goto('/');
  await page.evaluate(
    async ({ owner, regionId, reportId }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open('tandara-resident');
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['receipts', 'drafts'], 'readwrite');
        tx.objectStore('receipts').put({
          id: reportId,
          trackingToken: 'a'.repeat(72),
          residentId: owner,
          createdAt: new Date().toISOString(),
          state: 'submitted',
          description: 'PRIVATE_OTHER_ACCOUNT_REPORT',
        });
        tx.objectStore('drafts').put({
          localId: reportId,
          idempotencyKey: reportId,
          residentId: owner,
          state: 'queued',
          retryCount: 0,
          updatedAt: new Date().toISOString(),
          payload: {
            regionId,
            category: 'road_flooding',
            description: 'PRIVATE_OTHER_ACCOUNT_QUEUED_REPORT',
            observationTime: null,
            followUpRequested: false,
            contactPermission: false,
            privacyConsent: true,
            trackingToken: 'b'.repeat(72),
          },
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { owner, regionId, reportId },
  );
  sessionCalls = 0;
  await page.goto('/tracking');
  await expect.poll(() => sessionCalls).toBeGreaterThanOrEqual(2);
  await expect(page.getByText('PRIVATE_OTHER_ACCOUNT_REPORT', { exact: true })).toHaveCount(0);
  await expect(page.getByText('PRIVATE_OTHER_ACCOUNT_QUEUED_REPORT', { exact: true })).toHaveCount(
    0,
  );
  expect(payloads).toHaveLength(0);
});

test('an authenticated open session can use downloaded plans and queue reports until reconnect', async ({
  page,
  context,
}) => {
  const payloads = await fixtures(page);
  await page.goto('/plan');
  await page.getByRole('button', { name: 'Unduh rencana' }).click();
  await expect(page.getByText('Rencana diunduh. Bisa dibuka tanpa internet.')).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await expect(page.getByText('Siapkan dokumen penting')).toBeVisible();
  await expect(page.getByText('Tanpa internet · Menampilkan unduhan')).toBeVisible();
  await page.getByRole('link', { name: 'Laporan saya', exact: true }).first().click();
  await page.getByRole('link', { name: 'Buat laporan', exact: true }).first().click();
  await page
    .getByLabel('Apa yang Anda amati?')
    .fill('Laporan offline: air menggenang di depan balai warga.');
  await page.getByRole('checkbox', { name: /Saya menyetujui/ }).check();
  await page.getByRole('button', { name: 'Simpan laporan offline' }).click();
  await expect(page.getByText('Menunggu koneksi', { exact: true })).toBeVisible();
  expect(payloads).toHaveLength(0);
  await context.setOffline(false);
  await expect(page.getByText('Menunggu koneksi', { exact: true })).toHaveCount(0);
  expect(payloads).toHaveLength(1);
  await page.reload();
  await expect(page.locator('.w-report-list .w-row')).toHaveCount(1);
});

test('an offline reload cannot open protected content without revalidating the session', async ({
  page,
  context,
}) => {
  await fixtures(page);
  await page.goto('/plan');
  await page.getByRole('button', { name: 'Unduh rencana' }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.route('**/api/v1/resident/auth/me', (r) => r.abort('internetdisconnected'));
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveURL('/login?next=%2Fplan');
  await expect(page.locator('.w-auth-form')).toBeVisible();
  await expect(page.getByText('Siapkan dokumen penting', { exact: true })).toHaveCount(0);
});

test('mobile pages remain readable at 360px and all design assets load locally', async ({
  page,
}) => {
  await fixtures(page);
  await page.setViewportSize({ width: 360, height: 800 });
  for (const path of [
    '/',
    '/map',
    '/map?panel=filters',
    '/map?panel=water',
    '/map?panel=water&id=cantiga',
    '/map?panel=earthquakes&id=bogor',
    '/guide',
    '/checklist',
    '/training',
    '/tracking',
    '/profile',
    '/area',
    '/login',
    '/register',
  ]) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      path,
    ).toBe(true);
    const assets = page.locator('img[src^="/design/"]');
    await expect
      .poll(async () =>
        assets.evaluateAll((nodes) =>
          nodes.every(
            (n) => (n as HTMLImageElement).complete && (n as HTMLImageElement).naturalWidth > 0,
          ),
        ),
      )
      .toBe(true);
  }
  await page.goto('/');
  const audit = await new AxeBuilder({ page }).exclude('.maplibregl-canvas-container').analyze();
  expect(audit.violations).toEqual([]);
});
