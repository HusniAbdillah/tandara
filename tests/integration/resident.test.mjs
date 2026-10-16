import 'reflect-metadata';
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createApp } from '../../apps/api/dist/bootstrap.js';
import { parseEnvironment } from '../../packages/backend/dist/index.js';

let app;
const phone = '0812' + String(Date.now()).slice(-8);
const password = 'synthetic-resident-test-password';
const region = '20000000-0000-4000-8000-000000000001';
function call(method, path, body, headers = {}) {
  return app.inject({
    method,
    url: '/api/v1' + path,
    ...(body !== undefined ? { payload: body } : {}),
    headers: { 'x-tandara-client': 'web', ...headers },
  });
}
before(async () => {
  assert.equal(process.env.APP_MODE, 'simulation');
  app = await createApp(
    parseEnvironment({
      ...process.env,
      NODE_ENV: 'test',
      AI_MODE: 'heuristic',
      AI_EMBEDDING_MODE: 'disabled',
      LOG_LEVEL: 'silent',
    }),
  );
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});
after(async () => {
  await app?.close();
});
test('resident accounts use persistent password verification, independent sessions and CSRF logout', async () => {
  const anonymous = await call('GET', '/resident/auth/me');
  assert.equal(anonymous.statusCode, 200);
  assert.equal(anonymous.json().user, null);
  const registration = await call('POST', '/resident/auth/register', { phone, password });
  assert.equal(registration.statusCode, 201, registration.body);
  assert.equal(registration.json().user.phone, '+62' + phone.slice(1));
  assert.equal('password' in registration.json().user, false);
  const cookies = registration.headers['set-cookie'];
  assert.ok(Array.isArray(cookies));
  const cookie = cookies.map((c) => c.split(';')[0]).join('; ');
  const csrf = cookies
    .find((c) => c.startsWith('tandara_resident_csrf='))
    .split(';')[0]
    .split('=')[1];
  assert.ok(cookies.find((c) => c.startsWith('tandara_resident=')).includes('HttpOnly'));
  assert.equal(
    (await call('GET', '/resident/auth/me', undefined, { cookie })).json().user.id,
    registration.json().user.id,
  );
  assert.equal((await call('GET', '/auth/me', undefined, { cookie })).statusCode, 401);
  assert.equal(
    (await call('POST', '/resident/auth/login', { phone, password: 'wrong-password' })).statusCode,
    401,
  );
  const login = await call('POST', '/resident/auth/login', { phone, password });
  assert.equal(login.statusCode, 201, login.body);
  assert.equal(login.json().user.id, registration.json().user.id);
  assert.equal(
    (await call('POST', '/resident/auth/logout', undefined, { cookie, 'x-csrf-token': 'invalid' }))
      .statusCode,
    403,
  );
  assert.equal(
    (await call('POST', '/resident/auth/logout', undefined, { cookie, 'x-csrf-token': csrf }))
      .statusCode,
    201,
  );
  assert.equal((await call('GET', '/resident/auth/me', undefined, { cookie })).json().user, null);
  assert.equal(
    (await call('POST', '/resident/auth/register', { phone, password, role: 'admin' })).statusCode,
    400,
  );
});
test('observation endpoint carries typed samples only for configured simulation region', async () => {
  const response = await call('GET', `/regions/${region}/observations`);
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().mode, 'simulation');
  assert.equal(response.json().water[0].heightCm, 57);
  assert.equal(response.json().earthquakes.length, 1);
  const missing = await call('GET', '/regions/99999999-9999-4999-8999-999999999999/observations');
  assert.equal(missing.statusCode, 200);
  assert.deepEqual(missing.json().water, []);
  assert.equal(missing.json().mode, 'unconfigured');
});
