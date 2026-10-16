import 'reflect-metadata';
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createApp } from '../../apps/api/dist/bootstrap.js';
import { parseEnvironment } from '../../packages/backend/dist/index.js';

let app, a, b, device2, posko, admin, report;
const region = '20000000-0000-4000-8000-000000000001';
const pass = 'resident-integration-synthetic-password';
const phone = '0812' + String(Date.now()).slice(-8);
const base = {
  regionId: region,
  category: 'road_flooding',
  description: 'Laporan sintetis untuk menguji hubungan warga dengan Posko.',
  observationTime: null,
  followUpRequested: false,
  contactPermission: false,
  privacyConsent: true,
};
function call(method, path, body, session, headers = {}) {
  return app.inject({
    method,
    url: '/api/v1' + path,
    ...(body === undefined ? {} : { payload: body }),
    headers: {
      'x-tandara-client': 'web',
      ...(session ? { cookie: session.cookie, 'x-csrf-token': session.csrf } : {}),
      ...headers,
    },
  });
}
function session(response, resident = true) {
  assert.equal(response.statusCode, 201, response.body);
  const cookies = response.headers['set-cookie'];
  const parts = Array.isArray(cookies) ? cookies : [cookies];
  return {
    cookie: parts.map((c) => c.split(';')[0]).join('; '),
    csrf: resident
      ? parts
          .find((c) => c.startsWith('tandara_resident_csrf='))
          .split(';')[0]
          .split('=')[1]
      : response.json().csrf,
    user: response.json().user,
  };
}
async function submit(owner, extra = {}) {
  const response = await call(
    'POST',
    '/reports',
    { ...base, ...extra, trackingToken: crypto.randomUUID() + crypto.randomUUID() },
    owner,
    { 'idempotency-key': crypto.randomUUID() },
  );
  assert.equal(response.statusCode, 201, response.body);
  return response.json();
}
before(async () => {
  assert.equal(process.env.APP_MODE, 'simulation');
  app = await createApp(
    parseEnvironment({
      ...process.env,
      NODE_ENV: 'test',
      AI_MODE: 'disabled',
      AI_EMBEDDING_MODE: 'disabled',
      OBSERVATIONS_MODE: 'simulation',
      LOG_LEVEL: 'silent',
    }),
  );
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  a = session(await call('POST', '/resident/auth/register', { phone, password: pass }));
  b = session(
    await call('POST', '/resident/auth/register', {
      phone: '0813' + String(Date.now()).slice(-8),
      password: pass,
    }),
  );
  device2 = session(await call('POST', '/resident/auth/login', { phone, password: pass }));
  posko = session(
    await call('POST', '/auth/login', {
      email: 'ciliwung@demo.tandara.test',
      password: process.env.DEMO_PASSWORD,
    }),
    false,
  );
  admin = session(
    await call('POST', '/auth/login', {
      email: 'admin@demo.tandara.test',
      password: process.env.DEMO_PASSWORD,
    }),
    false,
  );
});
after(async () => {
  await app?.close();
});
test('signed-in reports persist across devices and isolate accounts and Posko sessions', async () => {
  report = await submit(a);
  assert.equal(report.residentId, a.user.id);
  const inbox = await call(
    'GET',
    `/regions/${region}/reports?q=Laporan sintetis`,
    undefined,
    posko,
  );
  assert.ok(inbox.json().items.some((item) => item.id === report.id));
  const list = await call('GET', '/resident/reports', undefined, device2);
  assert.equal(list.statusCode, 200, list.body);
  assert.ok(list.json().items.some((item) => item.id === report.id));
  assert.ok(!list.body.includes('trackingToken'));
  assert.ok(!list.body.includes('contactDetails'));
  assert.equal(
    (await call('GET', `/resident/reports/${report.id}`, undefined, device2)).statusCode,
    200,
  );
  assert.equal(
    (await call('GET', `/resident/reports/${report.id}/tracking`, undefined, device2)).statusCode,
    200,
  );
  assert.equal(
    (await call('GET', `/resident/reports/${report.id}/tracking`, undefined, b)).statusCode,
    404,
  );
  assert.equal((await call('GET', `/resident/reports/${report.id}`, undefined, b)).statusCode, 404);
  assert.deepEqual((await call('GET', '/resident/reports', undefined, b)).json().items, []);
  assert.equal((await call('GET', '/resident/reports', undefined, posko)).statusCode, 401);
  assert.equal((await call('GET', `/regions/${region}/reports`, undefined, a)).statusCode, 401);
  assert.equal((await call('GET', '/resident/reports?page=0', undefined, a)).statusCode, 400);
  const invalid = await call(
    'POST',
    '/reports',
    { ...base, trackingToken: crypto.randomUUID() + crypto.randomUUID() },
    a,
    { 'idempotency-key': crypto.randomUUID(), 'x-csrf-token': 'wrong' },
  );
  assert.equal(invalid.statusCode, 403);
  const swapped = await call(
    'POST',
    '/reports',
    { ...base, trackingToken: crypto.randomUUID() + crypto.randomUUID() },
    b,
    { 'idempotency-key': crypto.randomUUID(), 'x-resident-id': a.user.id },
  );
  assert.equal(swapped.statusCode, 403);
});
test('Posko reviews create durable private notifications, with cross-device read state and no private notes', async () => {
  const result = await call(
    'POST',
    `/reports/${report.id}/reviews`,
    { state: 'under_review', revision: 1, reason: 'PRIVATE_COORDINATOR_NOTE_DO_NOT_EXPOSE' },
    posko,
  );
  assert.equal(result.statusCode, 201, result.body);
  const feed = await call('GET', '/resident/notifications', undefined, device2);
  assert.equal(feed.statusCode, 200, feed.body);
  assert.equal(feed.json().unreadCount, 1);
  const notification = feed.json().items.find((item) => item.reportId === report.id);
  assert.equal(notification.action, 'under_review');
  assert.ok(!feed.body.includes('PRIVATE_COORDINATOR_NOTE_DO_NOT_EXPOSE'));
  const tracking = await call('GET', `/resident/reports/${report.id}/tracking`, undefined, device2);
  assert.equal(tracking.json().state, 'under_review');
  assert.ok(!tracking.body.includes('PRIVATE_COORDINATOR_NOTE_DO_NOT_EXPOSE'));
  assert.deepEqual((await call('GET', '/resident/notifications', undefined, b)).json().items, []);
  assert.equal(
    (await call('POST', '/resident/notifications/read', { id: notification.id }, b)).statusCode,
    404,
  );
  assert.equal(
    (
      await call('POST', '/resident/notifications/read', { id: notification.id }, a, {
        'x-csrf-token': 'wrong',
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (await call('POST', '/resident/notifications/read', { id: notification.id }, a)).statusCode,
    201,
  );
  assert.equal(
    (await call('GET', '/resident/notifications', undefined, device2)).json().unreadCount,
    0,
  );
  assert.ok(
    (await call('GET', '/resident/notifications', undefined, device2)).json().items[0].readAt,
  );
});
test('claiming legacy receipts requires a valid secret and cannot transfer another account report', async () => {
  const guest = await submit();
  assert.equal(
    (
      await call('GET', `/reports/${guest.id}/tracking`, undefined, undefined, {
        'x-tracking-token': guest.trackingToken,
      })
    ).statusCode,
    200,
  );
  const payload = { reports: [{ id: guest.id, trackingToken: guest.trackingToken }] };
  assert.equal((await call('POST', '/resident/reports/claim', payload)).statusCode, 401);
  assert.equal(
    (await call('POST', '/resident/reports/claim', payload, a, { 'x-csrf-token': 'wrong' }))
      .statusCode,
    403,
  );
  assert.deepEqual(
    (
      await call(
        'POST',
        '/resident/reports/claim',
        { reports: [{ id: guest.id, trackingToken: 'a'.repeat(72) }] },
        a,
      )
    ).json().claimedIds,
    [],
  );
  assert.deepEqual((await call('POST', '/resident/reports/claim', payload, a)).json().claimedIds, [
    guest.id,
  ]);
  assert.deepEqual(
    (await call('POST', '/resident/reports/claim', payload, b)).json().claimedIds,
    [],
  );
  assert.equal(
    (await call('GET', `/resident/reports/${guest.id}`, undefined, device2)).statusCode,
    200,
  );
});
test('assistance status changes notify the owner without exposing operational notes', async () => {
  const help = await submit(a, { category: 'follow_up_needed', followUpRequested: true });
  const queue = (await call('GET', `/regions/${region}/assistance`, undefined, posko)).json();
  const item = queue.find((x) => x.reportId === help.id);
  assert.ok(item);
  const updated = await call(
    'POST',
    `/regions/${region}/assistance/${item.id}`,
    { state: 'in_progress', note: 'PRIVATE_ASSISTANCE_NOTE_DO_NOT_EXPOSE', organizationId: null },
    posko,
  );
  assert.equal(updated.statusCode, 201, updated.body);
  const notification = (await call('GET', '/resident/notifications', undefined, device2))
    .json()
    .items.find((x) => x.reportId === help.id);
  assert.equal(notification.action, 'assistance.in_progress');
  assert.equal(notification.followUp, true);
  assert.equal(
    (await call('GET', `/resident/reports/${help.id}/tracking`, undefined, device2)).json()
      .assistanceState,
    'in_progress',
  );
  assert.ok(
    !(await call('GET', '/resident/notifications', undefined, a)).body.includes(
      'PRIVATE_ASSISTANCE_NOTE_DO_NOT_EXPOSE',
    ),
  );
  assert.equal((await call('POST', '/resident/notifications/read', {}, a)).statusCode, 201);
  assert.equal(
    (await call('GET', '/resident/notifications', undefined, device2)).json().unreadCount,
    0,
  );
});
test('report erasure removes account history and personal notifications while retaining a sanitized receipt', async () => {
  const request = await call(
    'POST',
    `/resident/reports/${report.id}/deletion-request`,
    undefined,
    device2,
  );
  assert.equal(request.statusCode, 201, request.body);
  const operations = (await call('GET', '/admin/operations', undefined, admin)).json();
  const deletion = operations.deletions.find((d) => d.reportId === report.id);
  assert.ok(deletion);
  const erased = await call('POST', `/admin/deletions/${deletion.id}/complete`, undefined, admin);
  assert.equal(erased.statusCode, 201, erased.body);
  assert.equal((await call('GET', `/resident/reports/${report.id}`, undefined, a)).statusCode, 404);
  assert.ok(
    !(await call('GET', '/resident/notifications', undefined, a))
      .json()
      .items.some((item) => item.reportId === report.id),
  );
  assert.equal(
    (
      await call('GET', `/reports/${report.id}/tracking`, undefined, undefined, {
        'x-tracking-token': report.trackingToken,
      })
    ).json().erased,
    true,
  );
});
