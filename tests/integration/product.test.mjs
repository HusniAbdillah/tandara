import 'reflect-metadata';
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createApp, JobsService } from '../../apps/api/dist/bootstrap.js';
import { parseEnvironment } from '../../packages/backend/dist/index.js';

const require = createRequire(new URL('../../packages/database/package.json', import.meta.url));
const { Client } = require('pg');
const db = new Client({ connectionString: process.env.DATABASE_URL });
let app;
let coordinator;
let admin;
let report;
let assistanceReport;
let planId;
const region = '20000000-0000-4000-8000-000000000001';
const other = '20000000-0000-4000-8000-000000000002';
const base = {
  regionId: region,
  category: 'road_flooding',
  description: 'Laporan uji sintetis: genangan di jalan dekat balai latihan.',
  landmarkText: 'Balai latihan',
  observationTime: new Date().toISOString(),
  location: { latitude: -6.218, longitude: 106.86 },
  followUpRequested: false,
  contactPermission: false,
  privacyConsent: true,
};
const key = crypto.randomUUID();
const token = crypto.randomUUID() + crypto.randomUUID();
function call(method, url, payload, session, extra = {}) {
  return app.inject({
    method,
    url: '/api/v1' + url,
    ...(payload !== undefined ? { payload } : {}),
    headers: {
      'x-tandara-client': 'web',
      ...(session ? { cookie: session.cookie, 'x-csrf-token': session.csrf } : {}),
      ...extra,
    },
  });
}
async function login(email) {
  const r = await call('POST', '/auth/login', { email, password: process.env.DEMO_PASSWORD });
  assert.equal(r.statusCode, 201, r.body);
  const cookies = r.headers['set-cookie'];
  return {
    cookie: (Array.isArray(cookies) ? cookies : [cookies]).map((c) => c.split(';')[0]).join('; '),
    csrf: r.json().csrf,
    user: r.json().user,
  };
}
before(async () => {
  await db.connect();
  assert.equal(process.env.APP_MODE, 'simulation', 'Integration tests require simulation mode');
  // Ignore the operator's live provider configuration; fixtures opt in explicitly below.
  process.env.AI_MODE = 'heuristic';
  process.env.AI_EMBEDDING_MODE = 'disabled';
  // This suite uses only a loopback synthetic provider; production limits are tested separately.
  for (const field of [
    'AI_DAILY_BUDGET_MICRO_USD',
    'AI_MONTHLY_BUDGET_MICRO_USD',
    'AI_ORG_DAILY_BUDGET_MICRO_USD',
  ])
    process.env[field] = '1000000000';
  // Reset only this synthetic suite's persistent rate keys so repeated runs exercise the policy.
  const rateKeys = [
    'login-ip:127.0.0.1',
    'report:127.0.0.1',
    'training:127.0.0.1',
    'login-ip:192.0.2.8',
    ...[
      'ciliwung@demo.tandara.test',
      'admin@demo.tandara.test',
      'no-account@demo.tandara.test',
    ].map((email) => 'login-email:' + email),
  ];
  await db.query('DELETE FROM rate_limits WHERE key=ANY($1::text[])', [
    rateKeys.map((k) => createHash('sha256').update(k).digest('hex')),
  ]);
  app = await createApp(
    parseEnvironment({ ...process.env, NODE_ENV: 'test', LOG_LEVEL: 'silent' }),
  );
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  coordinator = await login('ciliwung@demo.tandara.test');
  admin = await login('admin@demo.tandara.test');
});
after(async () => {
  await app?.close();
  await db.end();
});
test('public data exposes provenance and only valid published plans', async () => {
  const r = await call('GET', '/regions/' + region + '/public');
  assert.equal(r.statusCode, 200);
  assert.ok(r.json().plans.every((p) => p.state === 'published'));
  assert.equal(r.json().region.simulation, true);
  assert.ok(r.json().information.every((i) => i.sourceName && i.fetchedAt));
});
test('private routes reject missing, forged and cross-region sessions', async () => {
  assert.equal((await call('GET', '/regions/' + region + '/reports')).statusCode, 401);
  assert.equal(
    (
      await call('GET', '/auth/me', undefined, undefined, {
        cookie: 'tandara_session=' + 'a'.repeat(64),
      })
    ).statusCode,
    401,
  );
  assert.equal(
    (await call('GET', '/regions/' + other + '/reports', undefined, coordinator)).statusCode,
    403,
  );
  assert.equal((await call('GET', '/admin/users', undefined, coordinator)).statusCode, 403);
});
test('public writes require same-origin header and reject hostile origin', async () => {
  const r = await app.inject({ method: 'POST', url: '/api/v1/reports', payload: base });
  assert.equal(r.statusCode, 403);
  assert.equal(
    (await call('POST', '/reports', base, undefined, { origin: 'https://attacker.example.test' }))
      .statusCode,
    403,
  );
});
test('valid report is persisted once under concurrent retries', async () => {
  const payload = { ...base, trackingToken: token };
  const responses = await Promise.all([
    call('POST', '/reports', payload, undefined, { 'idempotency-key': key }),
    call('POST', '/reports', payload, undefined, { 'idempotency-key': key }),
  ]);
  assert.ok(
    responses.every((r) => r.statusCode === 201),
    responses.map((r) => r.body).join(),
  );
  report = responses[0].json();
  assert.equal(report.id, responses[1].json().id);
  const count = await db.query('SELECT count(*)::int n FROM reports WHERE idempotency_key=$1', [
    key,
  ]);
  assert.equal(count.rows[0].n, 1);
  assert.equal(
    (
      await call(
        'POST',
        '/reports',
        { ...payload, description: 'Different synthetic text for a conflicting retry' },
        undefined,
        { 'idempotency-key': key },
      )
    ).statusCode,
    409,
  );
});
test('coordinates outside scope and future observations are rejected', async () => {
  const outside = await call(
    'POST',
    '/reports',
    { ...base, location: { latitude: 0, longitude: 0 } },
    undefined,
    { 'idempotency-key': crypto.randomUUID() },
  );
  assert.equal(outside.statusCode, 400);
  const future = await call(
    'POST',
    '/reports',
    { ...base, observationTime: new Date(Date.now() + 86400000).toISOString() },
    undefined,
    { 'idempotency-key': crypto.randomUUID() },
  );
  assert.equal(future.statusCode, 400);
});
test('receipt is secret, has no private notes, and cannot enumerate reports', async () => {
  assert.equal((await call('GET', '/reports/' + report.id + '/tracking')).statusCode, 404);
  const r = await call('GET', '/reports/' + report.id + '/tracking', undefined, undefined, {
    'x-tracking-token': token,
  });
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().state, 'submitted');
  assert.ok(!('contactDetails' in r.json()));
});
test('triage persists uncertain suggestions without verifying the report', async () => {
  // Duplicate evidence must come from this run, not the seed's aging timestamp.
  const peer = await call(
    'POST',
    '/reports',
    {
      ...base,
      description: 'Laporan pasangan uji sintetis: genangan di jalan dekat balai latihan.',
      location: { latitude: -6.218, longitude: 106.86003 },
      trackingToken: crypto.randomUUID() + crypto.randomUUID(),
    },
    undefined,
    { 'idempotency-key': crypto.randomUUID() },
  );
  assert.equal(peer.statusCode, 201, peer.body);
  for (let i = 0; i < 15; i++) await app.get(JobsService).tick();
  const detail = await call('GET', '/reports/' + report.id, undefined, coordinator);
  assert.equal(detail.statusCode, 200, detail.body);
  assert.equal(detail.json().report.state, 'submitted');
  assert.ok(detail.json().suggestions.length > 0);
  assert.equal(detail.json().suggestions[0].provider, 'deterministic');
  assert.equal(detail.json().suggestions[0].output.needsHumanReview, true);
  assert.ok(detail.json().duplicates.some((candidate) => candidate.otherId === peer.json().id));
});
test('human rejection of AI is separate, audit-backed, and does not mutate original', async () => {
  const detail = (await call('GET', '/reports/' + report.id, undefined, coordinator)).json();
  const duplicate = detail.duplicates[0];
  if (duplicate) {
    for (const state of ['linked', 'suggested', 'dismissed'])
      assert.equal(
        (
          await call(
            'POST',
            '/reports/' + report.id + '/duplicates/' + duplicate.id,
            { state, reason: 'Keputusan manusia pada dugaan duplikat sintetis.' },
            coordinator,
          )
        ).statusCode,
        201,
      );
    assert.equal(
      (
        await db.query('SELECT count(*)::int n FROM reports WHERE id=ANY($1::uuid[])', [
          [report.id, duplicate.otherId],
        ])
      ).rows[0].n,
      2,
    );
  }
  const d = (await call('GET', '/reports/' + report.id, undefined, coordinator)).json();
  const r = await call(
    'POST',
    '/reports/' + report.id + '/suggestions/' + d.suggestions[0].id + '/review',
    { action: 'rejected', note: 'Saran diuji dan ditolak oleh manusia.' },
    coordinator,
  );
  assert.equal(r.statusCode, 201, r.body);
  const after = (await call('GET', '/reports/' + report.id, undefined, coordinator)).json();
  assert.equal(after.report.description, base.description);
  assert.equal(after.report.state, 'submitted');
  assert.equal(after.suggestions[0].state, 'rejected');
});

test('configured inference retries transient failures, persists validated output and isolates private fields', async () => {
  const keys = ['AI_MODE', 'AI_PROVIDER', 'AI_BASE_URL', 'AI_MODEL', 'AI_API_KEY'];
  const previous = Object.fromEntries(keys.map((name) => [name, process.env[name]]));
  let requests = 0;
  let requestBody;
  let requestAuthorization;
  let responseStatus = 429;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requestBody = JSON.parse(Buffer.concat(chunks).toString());
    requestAuthorization = req.headers.authorization;
    requests++;
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = responseStatus;
    if (responseStatus !== 200) {
      res.setHeader('Retry-After', '2');
      res.end(JSON.stringify({ error: { message: 'DO_NOT_LOG_PROVIDER_DETAILS' } }));
      return;
    }
    const original = JSON.parse(requestBody.messages[1].content).untrustedReport;
    res.end(
      JSON.stringify({
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({
                suggestedCategory: 'road_flooding',
                facts: [
                  {
                    field: 'description',
                    value: original.description,
                    evidence: original.description,
                  },
                ],
                missingInformation: [],
                summary: original.description,
                sourceIds: [original.id],
                needsHumanReview: true,
              }),
            },
          },
        ],
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const submitted = await call(
    'POST',
    '/reports',
    {
      ...base,
      description: 'SIMULASI API model: genangan di jalan dekat balai latihan.',
      contactPermission: true,
      contactDetails: 'PRIVATE_CONTACT_NOT_FOR_MODEL',
      trackingToken: crypto.randomUUID() + crypto.randomUUID(),
    },
    undefined,
    { 'idempotency-key': crypto.randomUUID() },
  );
  assert.equal(submitted.statusCode, 201, submitted.body);
  const id = submitted.json().id;
  const job = (
    await db.query("SELECT id FROM outbox_jobs WHERE kind='triage' AND entity_id=$1", [id])
  ).rows[0];
  const prioritize = () =>
    db.query("UPDATE outbox_jobs SET available_at='1900-01-01' WHERE id=$1", [job.id]);
  try {
    Object.assign(process.env, {
      AI_MODE: 'compatible',
      AI_PROVIDER: 'custom',
      AI_BASE_URL: 'http://127.0.0.1:' + server.address().port + '/v1',
      AI_MODEL: 'integration-model',
      AI_API_KEY: 'synthetic-provider-key',
    });
    await prioritize();
    await app.get(JobsService).tick();
    let row = (
      await db.query('SELECT state,attempts,error,available_at FROM outbox_jobs WHERE id=$1', [
        job.id,
      ])
    ).rows[0];
    assert.equal(row.state, 'pending');
    assert.equal(row.attempts, 1);
    assert.ok(row.available_at > new Date());
    assert.ok(!row.error.includes('DO_NOT_LOG_PROVIDER_DETAILS'));
    assert.equal(
      (await db.query('SELECT count(*)::int n FROM ai_suggestions WHERE report_id=$1', [id]))
        .rows[0].n,
      0,
    );
    responseStatus = 200;
    await prioritize();
    await app.get(JobsService).tick();
    row = (await db.query('SELECT state,attempts FROM outbox_jobs WHERE id=$1', [job.id])).rows[0];
    assert.equal(row.state, 'completed');
    assert.equal(row.attempts, 2);
    const result = (await call('GET', '/reports/' + id, undefined, coordinator)).json();
    assert.equal(result.suggestions.length, 1);
    assert.equal(result.suggestions[0].model, 'integration-model');
    assert.equal(result.suggestions[0].output.needsHumanReview, true);
    assert.equal(result.report.state, 'submitted');
    assert.equal(requestAuthorization, 'Bearer synthetic-provider-key');
    assert.ok(!JSON.stringify(requestBody).includes('PRIVATE_CONTACT_NOT_FOR_MODEL'));
    assert.ok(!JSON.stringify(requestBody).includes('trackingToken'));
    assert.equal(requests, 2);
    await app
      .get(JobsService)
      .triage({ id: job.id, kind: 'triage', entity_id: id, region_id: region, attempts: 2 });
    assert.equal(
      (await db.query('SELECT count(*)::int n FROM ai_suggestions WHERE report_id=$1', [id]))
        .rows[0].n,
      1,
    );
    assert.equal(requests, 2, 'Completed jobs must not make another paid inference request');
    const permanent = await call('POST', '/reports/' + id + '/triage', undefined, coordinator);
    assert.equal(permanent.statusCode, 201, permanent.body);
    const permanentJob = (
      await db.query(
        'SELECT id FROM outbox_jobs WHERE entity_id=$1 AND id<>$2 ORDER BY created_at DESC LIMIT 1',
        [id, job.id],
      )
    ).rows[0];
    responseStatus = 401;
    await db.query("UPDATE outbox_jobs SET available_at='1900-01-01' WHERE id=$1", [
      permanentJob.id,
    ]);
    await app.get(JobsService).tick();
    row = (
      await db.query('SELECT state,attempts,error FROM outbox_jobs WHERE id=$1', [permanentJob.id])
    ).rows[0];
    assert.equal(row.state, 'failed');
    assert.equal(row.attempts, 1);
    assert.ok(!row.error.includes('DO_NOT_LOG_PROVIDER_DETAILS'));
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int n FROM ai_suggestions WHERE report_id=$1 AND state='failed'",
          [id],
        )
      ).rows[0].n,
      1,
    );
    responseStatus = 200;
    const retry = await call('POST', '/admin/jobs/' + permanentJob.id + '/retry', undefined, admin);
    assert.equal(retry.statusCode, 201, retry.body);
    await db.query("UPDATE outbox_jobs SET available_at='1900-01-01' WHERE id=$1", [
      permanentJob.id,
    ]);
    await app.get(JobsService).tick();
    assert.equal(
      (await db.query('SELECT state FROM outbox_jobs WHERE id=$1', [permanentJob.id])).rows[0]
        .state,
      'completed',
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int n FROM ai_suggestions WHERE report_id=$1 AND state='ready'",
          [id],
        )
      ).rows[0].n,
      2,
    );

    assert.equal(
      (await call('POST', '/reports/' + id + '/triage', undefined, coordinator)).statusCode,
      201,
    );
    const exhausted = (
      await db.query(
        'SELECT id FROM outbox_jobs WHERE entity_id=$1 ORDER BY created_at DESC LIMIT 1',
        [id],
      )
    ).rows[0];
    responseStatus = 503;
    for (let attempt = 0; attempt < 4; attempt++) {
      await db.query("UPDATE outbox_jobs SET available_at='1900-01-01' WHERE id=$1", [
        exhausted.id,
      ]);
      await app.get(JobsService).tick();
    }
    row = (await db.query('SELECT state,attempts FROM outbox_jobs WHERE id=$1', [exhausted.id]))
      .rows[0];
    assert.equal(row.state, 'failed');
    assert.equal(row.attempts, 4);
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int n FROM ai_suggestions WHERE report_id=$1 AND state='failed'",
          [id],
        )
      ).rows[0].n,
      2,
    );

    process.env.AI_MODE = 'disabled';
    await db.query('DELETE FROM duplicate_candidates WHERE report_id=$1', [id]);
    assert.equal(
      (await call('POST', '/reports/' + id + '/triage', undefined, coordinator)).statusCode,
      201,
    );
    const disabled = (
      await db.query(
        'SELECT id FROM outbox_jobs WHERE entity_id=$1 ORDER BY created_at DESC LIMIT 1',
        [id],
      )
    ).rows[0];
    await db.query("UPDATE outbox_jobs SET available_at='1900-01-01' WHERE id=$1", [disabled.id]);
    const beforeDisabled = requests;
    await app.get(JobsService).tick();
    assert.equal(requests, beforeDisabled);
    assert.ok(
      (await db.query('SELECT count(*)::int n FROM duplicate_candidates WHERE report_id=$1', [id]))
        .rows[0].n > 0,
    );
  } finally {
    for (const name of keys) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
    await new Promise((resolve) => server.close(resolve));
  }
});
test('CSRF, stale revisions and illegal transitions fail closed', async () => {
  const body = { state: 'reviewed', reason: 'Tinjauan uji oleh koordinator.', revision: 1 };
  assert.equal(
    (await call('POST', '/reports/' + report.id + '/reviews', body, { ...coordinator, csrf: '' }))
      .statusCode,
    403,
  );
  assert.equal(
    (
      await call(
        'POST',
        '/reports/' + report.id + '/reviews',
        { ...body, revision: 999 },
        coordinator,
      )
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await call(
        'POST',
        '/reports/' + report.id + '/reviews',
        { ...body, state: 'submitted' },
        coordinator,
      )
    ).statusCode,
    409,
  );
});
test('human review publishes only a separate summary and retains history', async () => {
  const r = await call(
    'POST',
    '/reports/' + report.id + '/reviews',
    {
      state: 'reviewed',
      reason: 'Pengamatan sintetis telah diperiksa untuk pengujian.',
      revision: 1,
      publicSummary: 'Ringkasan sintetis yang ditinjau: genangan di lokasi latihan.',
    },
    coordinator,
  );
  assert.equal(r.statusCode, 201, r.body);
  const feed = (await call('GET', '/regions/' + region + '/public')).json();
  assert.ok(feed.reports.some((r) => r.id === report.id));
  assert.ok(!JSON.stringify(feed).includes(base.description));
  const d = (await call('GET', '/reports/' + report.id, undefined, coordinator)).json();
  assert.equal(d.report.description, base.description);
  assert.equal(d.history.at(-1).actor, coordinator.user.name);
});
test('private assistance and contacts cannot enter the public feed', async () => {
  const secret = 'FICTITIOUS_PRIVATE_CONTACT_' + crypto.randomUUID();
  const r = await call(
    'POST',
    '/reports',
    {
      ...base,
      category: 'follow_up_needed',
      description: 'Permintaan sintetis untuk tindak lanjut komunitas.',
      followUpRequested: true,
      contactPermission: true,
      contactDetails: secret,
      trackingToken: crypto.randomUUID() + crypto.randomUUID(),
    },
    undefined,
    { 'idempotency-key': crypto.randomUUID() },
  );
  assert.equal(r.statusCode, 201, r.body);
  assistanceReport = r.json();
  const list = await call('GET', '/regions/' + region + '/assistance', undefined, coordinator);
  assert.ok(list.json().some((a) => a.contactDetails === secret));
  assert.equal((await call('GET', '/regions/' + region + '/assistance')).statusCode, 401);
  const otherSession = await login('semarang@demo.tandara.test');
  assert.equal(
    (await call('GET', '/reports/' + assistanceReport.id, undefined, otherSession)).statusCode,
    403,
  );
  const rejected = await call(
    'POST',
    '/reports/' + assistanceReport.id + '/reviews',
    {
      state: 'reviewed',
      reason: 'Tinjauan sintetis bantuan.',
      revision: 1,
      publicSummary: 'Jangan terbitkan permintaan bantuan pribadi.',
    },
    coordinator,
  );
  assert.equal(rejected.statusCode, 400);
  assert.ok(
    !JSON.stringify((await call('GET', '/regions/' + region + '/public')).json()).includes(secret),
  );
});
test('uploads reject disguised files; processed photos strip metadata and stay private', async () => {
  const sharpRequire = createRequire(
    new URL('../../packages/backend/package.json', import.meta.url),
  );
  const sharp = sharpRequire('sharp');
  assert.equal(
    (
      await call(
        'POST',
        '/reports/' + report.id + '/attachments',
        { data: Buffer.from('<script>bad</script>').toString('base64') },
        undefined,
        { 'x-tracking-token': token },
      )
    ).statusCode,
    400,
  );
  const picture = await sharp({
    create: { width: 8, height: 8, channels: 3, background: '#aabbcc' },
  })
    .jpeg()
    .withMetadata()
    .toBuffer();
  const uploaded = await call(
    'POST',
    '/reports/' + report.id + '/attachments',
    { data: picture.toString('base64') },
    undefined,
    { 'x-tracking-token': token },
  );
  assert.equal(uploaded.statusCode, 201, uploaded.body);
  const url = '/reports/' + report.id + '/attachments/' + uploaded.json().id;
  assert.equal((await call('GET', url)).statusCode, 401);
  const file = await call('GET', url, undefined, coordinator);
  assert.equal(file.statusCode, 200);
  const meta = await sharp(file.rawPayload).metadata();
  assert.equal(meta.exif, undefined);
});
test('PostGIS coverage respects meter-based duplicate windows and missing information', async () => {
  const r = await call('GET', '/regions/' + region + '/coverage', undefined, coordinator);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().cells.length, 4);
  assert.ok(r.json().cells.some((c) => c.state === 'insufficient_information'));
  assert.ok(r.json().cells.some((c) => c.count > 0));
  assert.ok(!JSON.stringify(r.json()).includes('safe'));
});
test('plan author cannot approve; independent approval publishes immutable version', async () => {
  const content = (await call('GET', '/regions/' + region + '/public')).json().plans[0].content;
  const r = await call(
    'POST',
    '/regions/' + region + '/plans',
    {
      content: { ...content, title: 'Rencana sintetis dari pengujian' },
      reason: 'Draf baru untuk menguji alur tinjauan.',
    },
    coordinator,
  );
  assert.equal(r.statusCode, 201, r.body);
  planId = r.json().id;
  const path = '/regions/' + region + '/plans/' + planId + '/transition';
  assert.equal(
    (
      await call(
        'POST',
        path,
        { state: 'in_review', reason: 'Mohon tinjauan independen.' },
        coordinator,
      )
    ).statusCode,
    201,
  );
  assert.equal(
    (
      await call(
        'POST',
        path,
        { state: 'approved', reason: 'Uji penulis menyetujui sendiri.' },
        coordinator,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await call(
        'POST',
        path,
        { state: 'approved', reason: 'Tinjauan independen sintetis.' },
        admin,
      )
    ).statusCode,
    201,
  );
  assert.equal(
    (
      await call(
        'POST',
        path,
        { state: 'published', reason: 'Publikasi versi ditinjau untuk pengujian.' },
        admin,
      )
    ).statusCode,
    201,
  );
  const feed = (await call('GET', '/regions/' + region + '/public')).json();
  assert.equal(feed.plans.length, 1);
  assert.equal(feed.plans[0].id, planId);
  assert.equal(
    (
      await call(
        'PUT',
        '/regions/' + region + '/plans/' + planId,
        {
          content,
          reason: 'Tidak boleh mengubah versi terbit.',
          updatedAt: feed.plans[0].updatedAt,
        },
        coordinator,
      )
    ).statusCode,
    403,
  );
});
test('source outages preserve old fetched timestamps and other workflows', async () => {
  const sources = (await call('GET', '/regions/' + region + '/sources', undefined, admin)).json();
  const fixture = sources.find((s) => s.provider === 'fixture');
  const before = (await call('GET', '/regions/' + region + '/public'))
    .json()
    .information.find((i) => i.sourceId === fixture.id)?.fetchedAt;
  const input = {
    id: fixture.id,
    name: fixture.name,
    provider: fixture.provider,
    enabled: true,
    mode: fixture.mode,
    sourceUrl: fixture.sourceUrl,
    licenseNote: fixture.licenseNote,
    config: { ...fixture.config, fail: true },
  };
  assert.equal(
    (await call('POST', '/regions/' + region + '/sources', input, admin)).statusCode,
    201,
  );
  await call(
    'POST',
    '/regions/' + region + '/sources/' + fixture.id + '/refresh',
    undefined,
    admin,
  );
  for (let i = 0; i < 15; i++) await app.get(JobsService).tick();
  const current = (await call('GET', '/regions/' + region + '/sources', undefined, admin))
    .json()
    .find((s) => s.id === fixture.id);
  assert.ok(current.lastError);
  const feed = (await call('GET', '/regions/' + region + '/public')).json();
  assert.equal(feed.information.find((i) => i.sourceId === fixture.id)?.fetchedAt, before);
  assert.ok(feed.plans.length);
  await call(
    'POST',
    '/regions/' + region + '/sources',
    { ...input, config: { ...fixture.config, fail: false } },
    admin,
  );
});
test('training results are idempotent and feedback is restricted', async () => {
  const scenario = (await call('GET', '/regions/' + region + '/training')).json()[0];
  const feedback = 'SYNTHETIC_PRIVATE_FEEDBACK_' + crypto.randomUUID();
  const body = {
    answers: scenario.content.steps.map((s) => s.answer),
    feedback,
    completionKey: crypto.randomUUID(),
  };
  for (let i = 0; i < 2; i++)
    assert.equal(
      (await call('POST', '/regions/' + region + '/training/' + scenario.id + '/results', body))
        .statusCode,
      201,
    );
  assert.ok(
    !JSON.stringify((await call('GET', '/regions/' + region + '/training')).json()).includes(
      feedback,
    ),
  );
  assert.ok(
    JSON.stringify(
      (
        await call('GET', '/regions/' + region + '/training/outcomes', undefined, coordinator)
      ).json(),
    ).includes(feedback),
  );
  const rows = await db.query(
    'SELECT count(*)::int n FROM training_results WHERE completion_key=$1',
    [body.completionKey],
  );
  assert.equal(rows.rows[0].n, 1);
});
test('audit storage rejects tampering and governance can erase sensitive records', async () => {
  await assert.rejects(
    () => db.query("UPDATE audit_events SET action='tampered' WHERE entity_id=$1", [report.id]),
    /append-only/,
  );
  assert.equal(
    (
      await call('POST', '/reports/' + report.id + '/deletion-request', undefined, undefined, {
        'x-tracking-token': token,
      })
    ).statusCode,
    201,
  );
  const requests = (await call('GET', '/admin/operations', undefined, admin)).json().deletions;
  const deletion = requests.find((d) => d.reportId === report.id);
  assert.ok(deletion);
  assert.equal(
    (await call('POST', '/admin/deletions/' + deletion.id + '/complete', undefined, admin))
      .statusCode,
    201,
  );
  assert.equal(
    (await call('GET', '/reports/' + report.id, undefined, coordinator)).statusCode,
    404,
  );
  const erased = await db.query('SELECT description,location,erased FROM reports WHERE id=$1', [
    report.id,
  ]);
  assert.equal(erased.rows[0].location, null);
  assert.equal(erased.rows[0].erased, true);
});
test('administrator can configure organizations, regions and scoped user accounts', async () => {
  const org = await call(
    'POST',
    '/admin/organizations',
    {
      name: 'Organisasi uji sintetis ' + crypto.randomUUID().slice(0, 8),
      description: 'Profil fiktif dari pengujian otomatis.',
    },
    admin,
  );
  assert.equal(org.statusCode, 201);
  const config = (await call('GET', '/regions/' + region + '/public')).json().region.config;
  const created = await call(
    'POST',
    '/admin/regions',
    {
      name: 'Wilayah uji sintetis',
      organizationId: org.json().id,
      config,
      boundary: {
        type: 'Polygon',
        coordinates: [
          [
            [106, -7],
            [106.01, -7],
            [106.01, -6.99],
            [106, -6.99],
            [106, -7],
          ],
        ],
      },
      suspended: false,
    },
    admin,
  );
  assert.equal(created.statusCode, 201, created.body);
  const newUser = await call(
    'POST',
    '/admin/users',
    {
      name: 'Koordinator uji sintetis',
      email: crypto.randomUUID() + '@test.tandara.test',
      password: 'test-only-long-password',
      role: 'coordinator',
      regionIds: [created.json().id],
      suspended: false,
    },
    admin,
  );
  assert.equal(newUser.statusCode, 201, newUser.body);
  const memberships = await db.query('SELECT region_id FROM memberships WHERE user_id=$1', [
    newUser.json().id,
  ]);
  assert.equal(memberships.rows[0].region_id, created.json().id);
});
test('login abuse is rate limited without disclosing account existence', async () => {
  let limited = false;
  for (let i = 0; i < 22; i++) {
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: '192.0.2.8',
      headers: { 'x-tandara-client': 'web' },
      payload: { email: 'no-account@demo.tandara.test', password: 'wrong-password' },
    });
    assert.ok([401, 429].includes(r.statusCode), r.body);
    if (r.statusCode === 429) {
      limited = true;
      break;
    }
  }
  assert.equal(limited, true);
});
test('in-app notifications respect preferences and ownership', async () => {
  const start = (await call('GET', '/notifications', undefined, coordinator)).json();
  assert.equal(
    (await call('POST', '/notifications/preferences', { enabled: false }, coordinator)).statusCode,
    201,
  );
  const payload = { ...base, trackingToken: crypto.randomUUID() + crypto.randomUUID() };
  assert.equal(
    (await call('POST', '/reports', payload, undefined, { 'idempotency-key': crypto.randomUUID() }))
      .statusCode,
    201,
  );
  assert.equal(
    (await call('GET', '/notifications', undefined, coordinator)).json().items.length,
    start.items.length,
  );
  assert.equal(
    (await call('POST', '/notifications/preferences', { enabled: true }, coordinator)).statusCode,
    201,
  );
  payload.trackingToken = crypto.randomUUID() + crypto.randomUUID();
  assert.equal(
    (await call('POST', '/reports', payload, undefined, { 'idempotency-key': crypto.randomUUID() }))
      .statusCode,
    201,
  );
  const latest = (await call('GET', '/notifications', undefined, coordinator)).json();
  assert.equal(latest.items.length, Math.min(100, start.items.length + 1));
  assert.notEqual(latest.items[0].id, start.items[0]?.id);
  assert.equal(
    (await call('POST', '/notifications/' + latest.items[0].id + '/read', undefined, admin))
      .statusCode,
    404,
  );
  assert.equal(
    (await call('POST', '/notifications/' + latest.items[0].id + '/read', undefined, coordinator))
      .statusCode,
    201,
  );
  assert.ok((await call('GET', '/notifications', undefined, coordinator)).json().items[0].readAt);
});
test('group summaries expose real sample references and cannot grant region access', async () => {
  const r = await call('GET', '/regions/' + region + '/triage-summary', undefined, coordinator);
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().provider, 'deterministic');
  assert.equal(r.json().needsHumanReview, true);
  assert.ok(r.json().sourceIds.length > 0);
  assert.equal(
    (await call('GET', '/regions/' + other + '/triage-summary', undefined, coordinator)).statusCode,
    403,
  );
});
test('configured retention erases expired raw data while preserving minimal audit', async () => {
  const r = await call(
    'POST',
    '/reports',
    { ...base, trackingToken: crypto.randomUUID() + crypto.randomUUID() },
    undefined,
    { 'idempotency-key': crypto.randomUUID() },
  );
  assert.equal(r.statusCode, 201);
  const id = r.json().id;
  await db.query("UPDATE reports SET created_at=now()-interval '400 days' WHERE id=$1", [id]);
  await app.get(JobsService).retention();
  const erased = (await db.query('SELECT erased,location FROM reports WHERE id=$1', [id])).rows[0];
  assert.equal(erased.erased, true);
  assert.equal(erased.location, null);
  assert.ok(
    (
      await db.query("SELECT id FROM audit_events WHERE entity_id=$1 AND action='privacy.erased'", [
        id,
      ])
    ).rows.length > 0,
  );
});
