import assert from 'node:assert/strict';
import { ReportsService } from '../../../apps/api/dist/bootstrap.js';

export async function registerResident(app) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/resident/auth/register',
    headers: { 'x-tandara-client': 'web' },
    payload: {
      phone: '0819' + String(Date.now()).slice(-8),
      password: 'synthetic-integration-resident-password',
    },
  });
  assert.equal(response.statusCode, 201, response.body);
  return {
    cookie: response.cookies.map((c) => c.name + '=' + c.value).join('; '),
    csrf: response.cookies.find((c) => c.name === 'tandara_resident_csrf').value,
    user: response.json().user,
  };
}
export function residentWrite(method, path) {
  return (
    method === 'POST' &&
    (path === '/reports' ||
      /^\/reports\/[^/]+\/(feedback|attachments|deletion-request)$/.test(path) ||
      /\/training\/[^/]+\/results$/.test(path))
  );
}
// Only legacy-data fixtures bypass HTTP. New anonymous submissions must never use this path.
export function createLegacyReport(app, payload) {
  return app.get(ReportsService).create(payload, crypto.randomUUID(), '192.0.2.220');
}
