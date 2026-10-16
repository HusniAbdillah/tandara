import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { randomInt } from 'node:crypto';

export async function registerResident(page: Page, origin = '') {
  const response = await page.request.post(origin + '/api/v1/resident/auth/register', {
    data: {
      phone: '0819' + randomInt(10000000, 99999999),
      password: 'synthetic-browser-resident-password',
      name: 'Warga Browser E2E',
    },
    headers: { 'X-Tandara-Client': 'web' },
  });
  expect(response.status()).toBe(201);
}
