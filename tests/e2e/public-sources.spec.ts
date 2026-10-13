import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const regionId = '20000000-0000-4000-8000-000000000001';
const sourceId = '50000000-0000-4000-8000-000000000001';
const region = {
  id: regionId,
  organizationId: '10000000-0000-4000-8000-000000000001',
  organization: 'Demo test',
  name: 'Wilayah fixture browser',
  simulation: true,
  suspended: false,
  boundary: {
    type: 'Polygon',
    coordinates: [
      [
        [106, -6],
        [107, -6],
        [107, -7],
        [106, -6],
      ],
    ],
  },
  config: {
    categories: ['road_flooding', 'blocked_access'],
    coverageHours: 24,
    retentionDays: 30,
    contacts: [],
    languages: ['id'],
  },
};
async function fixture(page: Page, state: 'active' | 'failed' | 'empty') {
  const now = Date.now();
  await page.route('**/api/v1/regions', (route) => route.fulfill({ json: [region] }));
  await page.route('**/api/v1/deployment', (route) =>
    route.fulfill({
      json: { residentOrigin: 'http://localhost:8080', coordinatorOrigin: 'http://localhost:8081' },
    }),
  );
  await page.route('**/api/v1/regions/' + regionId + '/public', (route) =>
    route.fulfill({
      json: {
        region,
        plans: [],
        reports: [],
        fetchedAt: new Date(now).toISOString(),
        sources: [
          {
            id: sourceId,
            name: 'BMKG fixture',
            provider: 'bmkg_nowcast',
            lastAttemptAt: new Date(now).toISOString(),
            lastSuccessAt: new Date(now).toISOString(),
            failed: state === 'failed',
          },
        ],
        information:
          state === 'empty'
            ? []
            : [
                {
                  id: '60000000-0000-4000-8000-000000000001',
                  sourceId,
                  regionId,
                  title: 'PERINGATAN SINTETIS TEST',
                  body: 'Fixture browser, bukan peringatan nyata.',
                  sourceName: 'BMKG',
                  sourceUrl: 'https://www.bmkg.go.id/alerts/nowcast/id/CJK_fixture_alert.xml',
                  sourceType: 'official_alert',
                  issuedAt: new Date(now - 120000).toISOString(),
                  observedAt: null,
                  fetchedAt: new Date(now - 60000).toISOString(),
                  effectiveAt: new Date(now - 60000).toISOString(),
                  expiresAt: new Date(now + 3600000).toISOString(),
                  verificationStatus: 'official_cap_actual_public',
                  version: 'fixture',
                  simulation: false,
                },
              ],
      },
    }),
  );
}
test('official warnings distinguish source time and lead to preparedness actions', async ({
  page,
}) => {
  await fixture(page, 'active');
  await page.goto('/');
  const panel = page.getByRole('region', { name: 'Peringatan resmi & langkah kesiapsiagaan' });
  await expect(panel.getByText('PERINGATAN SINTETIS TEST')).toBeVisible();
  await expect(panel.getByText(/bukan waktu penerimaan setiap warga/)).toBeVisible();
  await expect(panel.getByRole('link', { name: 'Baca & simpan rencana offline' })).toHaveAttribute(
    'href',
    '/plan',
  );
  await expect(panel.getByRole('link', { name: 'Laporkan hambatan akses' })).toHaveAttribute(
    'href',
    '/report?category=blocked_access',
  );
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/warning-readiness-mobile.png', fullPage: true });
  await panel.getByRole('link', { name: 'Laporkan hambatan akses' }).click();
  await expect(
    page.locator('main select').filter({ has: page.locator('option[value="blocked_access"]') }),
  ).toHaveValue('blocked_access');
});
test('failed source preserves warnings and shows uncertainty', async ({ page }) => {
  await fixture(page, 'failed');
  await page.goto('/');
  await expect(
    page.getByText('Pembaruan peringatan belum terkonfirmasi.', { exact: false }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Peringatan resmi & langkah kesiapsiagaan' })
      .getByText('PERINGATAN SINTETIS TEST'),
  ).toBeVisible();
});
test('empty current feed never claims a region is safe', async ({ page }) => {
  await fixture(page, 'empty');
  await page.goto('/');
  await expect(page.getByText('FEED TELAH DIPERIKSA')).toBeVisible();
  await expect(page.getByText(/Ini tidak berarti wilayah aman/)).toBeVisible();
});
