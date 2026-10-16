import 'reflect-metadata';
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { parseEnvironment } from '../../packages/backend/dist/index.js';
import { createApp } from '../../apps/api/dist/bootstrap.js';

let nest, app, admin, coordinator, outsider, receipt;
const region = '20000000-0000-4000-8000-000000000001';
const token = crypto.randomUUID() + crypto.randomUUID();
function call(method, path, body, session, headers = {}) {
  return app.inject({
    method,
    url: '/api/v1' + path,
    ...(body ? { payload: body } : {}),
    headers: {
      'x-tandara-client': 'web',
      ...(session ? { cookie: session.cookie, 'x-csrf-token': session.csrf } : {}),
      ...headers,
    },
  });
}
async function login(email) {
  const r = await call('POST', '/auth/login', { email, password: process.env.DEMO_PASSWORD });
  assert.equal(r.statusCode, 201, r.body);
  return {
    cookie: r.cookies.map((c) => c.name + '=' + c.value).join('; '),
    csrf: r.json().csrf,
    user: r.json().user,
  };
}
before(async () => {
  assert.equal(process.env.APP_MODE, 'simulation');
  process.env.AI_MODE = 'heuristic';
  process.env.AI_EMBEDDING_MODE = 'disabled';
  nest = await createApp(parseEnvironment({ ...process.env, LOG_LEVEL: 'silent' }));
  await nest.init();
  await nest.getHttpAdapter().getInstance().ready();
  app = nest.getHttpAdapter().getInstance();
  admin = await login('admin@demo.tandara.test');
  coordinator = await login('ciliwung@demo.tandara.test');
  outsider = await login('semarang@demo.tandara.test');
  const r = await call(
    'POST',
    '/reports',
    {
      regionId: region,
      category: 'road_flooding',
      description: 'Laporan uji alur: genangan dekat balai warga.',
      observationTime: null,
      followUpRequested: true,
      contactPermission: false,
      privacyConsent: true,
      trackingToken: token,
    },
    null,
    { 'idempotency-key': crypto.randomUUID() },
  );
  assert.equal(r.statusCode, 201, r.body);
  receipt = r.json();
});
after(async () => {
  if (receipt && admin) {
    await call('POST', `/reports/${receipt.id}/deletion-request`, undefined, null, {
      'x-tracking-token': token,
    });
    const operations = await call('GET', '/admin/operations', undefined, admin);
    const deletion = operations.json().deletions?.find((d) => d.reportId === receipt.id);
    if (deletion) await call('POST', `/admin/deletions/${deletion.id}/complete`, undefined, admin);
  }
  await nest?.close();
});
async function workflow() {
  const r = await call('GET', `/reports/${receipt.id}/workflow`, null, admin);
  assert.equal(r.statusCode, 200, r.body);
  return r.json().workflow;
}
async function action(name, session = admin, extra = {}) {
  const w = await workflow();
  return call(
    'POST',
    `/reports/${receipt.id}/workflow`,
    { action: name, revision: w.revision, message: 'Pembaruan untuk warga: ' + name, ...extra },
    session,
  );
}
test('report workflow enforces scope, ownership, approval and citizen confirmation', async () => {
  assert.equal(
    (await call('GET', `/reports/${receipt.id}/workflow`, null, outsider)).statusCode,
    403,
  );
  assert.equal((await action('approve')).statusCode, 403);
  assert.equal((await action('request_information')).statusCode, 201);
  let w = await workflow();
  assert.equal(
    (
      await call(
        'POST',
        `/reports/${receipt.id}/feedback`,
        { action: 'clarify', revision: w.revision, message: 'Lokasi di pintu utara balai warga.' },
        null,
        { 'x-tracking-token': 'wrong' },
      )
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await call(
        'POST',
        `/reports/${receipt.id}/feedback`,
        { action: 'clarify', revision: w.revision, message: 'Lokasi di pintu utara balai warga.' },
        null,
        { 'x-tracking-token': token },
      )
    ).statusCode,
    201,
  );
  assert.equal((await action('verify', coordinator)).statusCode, 201);
  assert.equal(
    (await action('assign', coordinator, { assigneeId: coordinator.user.id })).statusCode,
    403,
  );
  assert.equal((await action('assign', admin, { assigneeId: outsider.user.id })).statusCode, 409);
  assert.equal(
    (await action('assign', admin, { assigneeId: coordinator.user.id, priority: 'urgent' }))
      .statusCode,
    201,
  );
  assert.equal((await action('start', admin)).statusCode, 403);
  assert.equal((await action('start', coordinator)).statusCode, 201);
  assert.equal((await action('update', coordinator)).statusCode, 201);
  assert.equal((await action('submit_resolution', coordinator)).statusCode, 201);
  assert.equal((await action('approve', coordinator)).statusCode, 403);
  assert.equal((await action('return', admin)).statusCode, 201);
  assert.equal((await action('submit_resolution', coordinator)).statusCode, 201);
  assert.equal((await action('approve', admin)).statusCode, 201);
  w = await workflow();
  assert.equal(
    (
      await call(
        'POST',
        `/reports/${receipt.id}/reviews`,
        { state: 'closed', reason: 'Tidak boleh melewati konfirmasi warga.', revision: w.revision },
        admin,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await call(
        'POST',
        `/reports/${receipt.id}/feedback`,
        { action: 'reopen', revision: w.revision, message: 'Masih ada genangan di sisi timur.' },
        null,
        { 'x-tracking-token': token },
      )
    ).statusCode,
    201,
  );
  assert.equal((await action('submit_resolution', coordinator)).statusCode, 201);
  assert.equal((await action('approve')).statusCode, 201);
  w = await workflow();
  const feedback = {
    action: 'confirm',
    revision: w.revision,
    message: 'Air sudah surut, terima kasih.',
    rating: 5,
  };
  const concurrent = await Promise.all([
    call('POST', `/reports/${receipt.id}/feedback`, feedback, null, { 'x-tracking-token': token }),
    call('POST', `/reports/${receipt.id}/feedback`, feedback, null, { 'x-tracking-token': token }),
  ]);
  assert.deepEqual(concurrent.map((r) => r.statusCode).sort(), [201, 409]);
  const tracking = (
    await call('GET', `/reports/${receipt.id}/tracking`, null, null, { 'x-tracking-token': token })
  ).json();
  assert.equal(tracking.workflow.status, 'closed');
  assert.equal(tracking.workflow.assigneeId, null);
  assert.ok(tracking.updates.some((e) => e.message === 'Air sudah surut, terima kasih.'));
  assert.ok(tracking.updates.every((e) => e.actor === null));
  assert.equal((await action('start', coordinator)).statusCode, 403);
  const analyticsResponse = await call('GET', `/regions/${region}/report-analytics`, null, admin);
  assert.equal(analyticsResponse.statusCode, 200, analyticsResponse.body);
  const analytics = analyticsResponse.json();
  assert.ok(analytics.feedbackCount > 0);
  assert.ok(analytics.byStatus.closed > 0);
  assert.equal((await call('GET', `/regions/${region}/team`, null, outsider)).statusCode, 403);
  assert.equal((await call('POST', '/admin/users', {}, coordinator)).statusCode, 403);
});
