import { test, expect } from '@playwright/test';

test('Posko shares water and earthquake feeds, preserves other layers, and uses grey for missing thresholds', async ({
  page,
  context,
}, testInfo) => {
  const regionId = '20000000-0000-4000-8000-000000000001';
  const boundary = {
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
  };
  const region = {
    id: regionId,
    name: 'Wilayah uji',
    organizationId: '10000000-0000-4000-8000-000000000001',
    organization: 'Organisasi uji',
    config: {
      categories: ['road_flooding'],
      coverageHours: 24,
      retentionDays: 30,
      contacts: [],
      languages: ['id'],
    },
    boundary,
    simulation: true,
    suspended: false,
  };
  const water = {
    id: 'dsda-189',
    name: 'Stasiun tanpa batas',
    location: { latitude: -6.225, longitude: 106.865 },
    heightCm: -17,
    status: 'normal',
    updatedAt: '2026-10-16T00:00:00Z',
    thresholds: [],
  };
  const earthquake = {
    id: 'bmkg-test',
    location: { latitude: -6.23, longitude: 106.87 },
    occurredAt: '2026-10-16T00:00:00Z',
    magnitude: 2.5,
    depthKm: 9,
    region: 'Bogor uji',
    felt: 'II Kabandungan',
  };
  const tile = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP49esXAAXgAu/NVObIAAAAAElFTkSuQmCC',
    'base64',
  );
  await context.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({
      contentType: 'image/png',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: tile,
    }),
  );
  await context.route('**/basemap.json', (route) =>
    route.fulfill({
      json: {
        enabled: true,
        label: 'OpenStreetMap',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        attributionLabel: 'OpenStreetMap',
        attributionUrl: 'https://www.openstreetmap.org/copyright',
        maxZoom: 19,
      },
    }),
  );
  await context.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    let body: unknown;
    if (path === '/auth/me')
      body = {
        user: {
          id: '40000000-0000-4000-8000-000000000001',
          name: 'Koordinator',
          email: 'coordinator@example.test',
          role: 'coordinator',
          regionIds: [regionId],
          suspended: false,
        },
        csrf: 'fixture',
      };
    else if (path === '/regions') body = [region];
    else if (path === '/deployment')
      body = {
        mode: 'simulation',
        residentOrigin: 'http://127.0.0.1:8080',
        coordinatorOrigin: 'http://127.0.0.1:8081',
      };
    else if (path.endsWith('/reports')) body = { items: [], total: 0, page: 1, pageSize: 20 };
    else if (path.endsWith('/coverage'))
      body = { hours: 24, method: 'fixture', generatedAt: '2026-10-16T00:00:00Z', cells: [] };
    else if (path.endsWith('/public'))
      body = {
        region,
        plans: [],
        information: [],
        reports: [],
        sources: [],
        fetchedAt: '2026-10-16T00:00:00Z',
      };
    else if (path.endsWith('/observations'))
      body = {
        mode: 'live',
        fetchedAt: '2026-10-16T00:00:00Z',
        water: Array.from({ length: 35 }, (_, index) => ({
          ...water,
          id: `dsda-${189 + index}`,
          name: index === 0 ? water.name : `Lokasi uji ${index}`,
        })),
        earthquakes: [earthquake],
        sources: [
          {
            id: 'bmkg',
            name: 'BMKG',
            url: 'https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json',
            status: 'ready',
            checkedAt: '2026-10-16T00:00:00Z',
            lastSuccessAt: '2026-10-16T00:00:00Z',
            skippedRecords: 0,
          },
        ],
      };
    else
      return route.fulfill({
        status: 404,
        json: { error: { code: 'NOT_FOUND', message: 'fixture' } },
      });
    return route.fulfill({ json: body });
  });
  const origin = new URL(String(testInfo.project.use.baseURL));
  origin.port = origin.port === '5173' ? '5174' : '8081';
  await page.goto(origin.origin + '/map');
  const section = page.getByRole('region', { name: 'Pengamatan tinggi air dan gempa' });
  const rows = section.locator('.posko-observation-list button');
  await expect(rows).toHaveCount(35);
  const bounds = await rows.evaluateAll((buttons) =>
    buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, height: rect.height };
    }),
  );
  for (let index = 0; index < bounds.length; index++) {
    expect(bounds[index]!.height).toBeGreaterThanOrEqual(70);
    if (index > 0) expect(bounds[index]!.top).toBeGreaterThan(bounds[index - 1]!.bottom);
  }
  await section.getByRole('button', { name: /Stasiun tanpa batas/ }).click();
  await expect(
    section.getByLabel('Detail pengamatan').getByText('Belum diketahui', { exact: true }),
  ).toBeVisible();
  await expect(section.getByLabel('Detail pengamatan')).not.toContainText('WIB WIB');
  await expect(page.locator('.posko-observation-marker.is-water')).toHaveCount(35);
  await expect(page.locator('.posko-observation-marker.is-water').first()).toHaveCSS(
    'background-color',
    'rgb(107, 114, 128)',
  );
  await section.getByRole('checkbox', { name: 'Tinggi air', exact: true }).uncheck();
  await expect(page.locator('.posko-observation-marker.is-water')).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Laporan warga', exact: true })).toBeChecked();
  await section.getByRole('button', { name: 'Gempa (1)', exact: true }).click();
  await section.getByRole('button', { name: /M 2.5 · Bogor uji/ }).click();
  await expect(section.getByRole('heading', { name: 'Gempa M 2.5' })).toBeVisible();
  await expect(section.getByText('II Kabandungan', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/posko-shared-observations.png', fullPage: true });
});
