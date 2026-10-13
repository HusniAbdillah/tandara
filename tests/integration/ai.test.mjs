import 'reflect-metadata';
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { eraseReport } from '../../packages/backend/dist/modules/privacy.js';
import { embeddingRelease } from '../../packages/backend/dist/modules/knowledge.js';
import { readAiSettings } from '../../packages/backend/dist/config/ai.js';
import { aiOperationsSettings } from '../../packages/backend/dist/config/ai-operations.js';
import { encryptMfa, newMfa } from '../../packages/backend/dist/modules/mfa.js';
import { createApp } from '../../apps/api/dist/bootstrap.js';
import {
  parseEnvironment,
  JobsService,
  AiService,
  KnowledgeService,
  DatabaseService,
} from '../../packages/backend/dist/index.js';
const require = createRequire(new URL('../../packages/database/package.json', import.meta.url));
const { Client } = require('pg');
const backendRequire = createRequire(
  new URL('../../packages/backend/package.json', import.meta.url),
);
const { TOTP } = backendRequire('otpauth');
const db = new Client({ connectionString: process.env.DATABASE_URL });
const region = '20000000-0000-4000-8000-000000000001';
const other = '20000000-0000-4000-8000-000000000002';
let app, coordinator, admin, server;
let mode = 'valid',
  calls = 0,
  releaseResponse,
  requestSeen,
  notifyRequest;
const payloads = [];
const saved = { ...process.env };
function call(method, url, payload, session = coordinator) {
  return app.inject({
    method,
    url: '/api/v1' + url,
    ...(payload === undefined ? {} : { payload }),
    headers: {
      'x-tandara-client': 'web',
      ...(session ? { cookie: session.cookie, 'x-csrf-token': session.csrf } : {}),
    },
  });
}
async function login(email) {
  const r = await call('POST', '/auth/login', { email, password: process.env.DEMO_PASSWORD }, null);
  assert.equal(r.statusCode, 201, r.body);
  const cookies = r.headers['set-cookie'];
  return {
    cookie: (Array.isArray(cookies) ? cookies : [cookies]).map((c) => c.split(';')[0]).join('; '),
    csrf: r.json().csrf,
    user: r.json().user,
  };
}
async function submit(task, extra = {}) {
  const r = await call('POST', '/regions/' + region + '/ai/runs', {
    task,
    requestKey: crypto.randomUUID(),
    ...extra,
  });
  assert.equal(r.statusCode, 201, r.body);
  return r.json().id;
}
async function detail(id) {
  const r = await call('GET', '/regions/' + region + '/ai/runs/' + id);
  assert.equal(r.statusCode, 200, r.body);
  return r.json();
}
async function drain(id) {
  for (let i = 0; i < 80; i++) {
    const row = await detail(id);
    if (['ready', 'cancelled', 'unavailable'].includes(row.state)) return row;
    await db.query(
      "UPDATE outbox_jobs SET available_at=now() WHERE entity_id=$1 AND state='pending'",
      [id],
    );
    await app.get(JobsService).tick();
  }
  throw new Error('Workflow did not complete: ' + JSON.stringify(await detail(id)));
}
before(async () => {
  assert.equal(process.env.APP_MODE, 'simulation');
  await db.connect();
  for (const name of [
    'AI_DAILY_BUDGET_MICRO_USD',
    'AI_ORG_DAILY_BUDGET_MICRO_USD',
    'AI_MONTHLY_BUDGET_MICRO_USD',
  ])
    process.env[name] = '1000000000';
  const keys = [
    'login-ip:127.0.0.1',
    ...['ciliwung@demo.tandara.test', 'admin@demo.tandara.test'].map(
      (email) => 'login-email:' + email,
    ),
  ];
  await db.query('DELETE FROM rate_limits WHERE key=ANY($1::text[])', [
    keys.map((k) => createHash('sha256').update(k).digest('hex')),
  ]);
  await db.query('DELETE FROM ai_controls');
  server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks));
    payloads.push(body);
    calls++;
    if (req.url === '/embeddings') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ data: [{ embedding: [1, 0, 0] }] }));
      return;
    }
    if (req.url === '/gemini/embeddings') {
      assert.equal(req.headers['x-goog-api-key'], 'local-fixture-secret');
      assert.equal(body.outputDimensionality, 128);
      assert.ok(['RETRIEVAL_DOCUMENT', 'RETRIEVAL_QUERY'].includes(body.taskType));
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          embedding: { values: [1, ...Array(127).fill(0)] },
          usageMetadata: { promptTokenCount: 11 },
        }),
      );
      return;
    }
    const envelope = JSON.parse(body.messages[1].content);
    const data = envelope.untrustedReport ?? envelope;
    requestSeen = data;
    notifyRequest?.();
    if (mode === 'hold')
      await new Promise((resolve) => {
        releaseResponse = resolve;
      });
    if (mode === 'transient') {
      mode = 'valid';
      res.writeHead(429, { 'retry-after': '0' });
      res.end('{}');
      return;
    }
    if (data.description) {
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestedCategory: 'road_flooding',
                  facts: [
                    { field: 'description', value: data.description, evidence: data.description },
                  ],
                  missingInformation: ['Patokan dan waktu perlu dikonfirmasi.'],
                  summary: 'Kutipan laporan: ' + data.description,
                  sourceIds: [data.id],
                  needsHumanReview: true,
                }),
              },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 80 },
        }),
      );
      return;
    }
    const sources = data.untrustedSources ?? [];
    const claims = sources.slice(0, 5).map((s) => ({
      text: s.text.slice(0, 500),
      state: 'explicit',
      citations: [{ sourceId: s.id, quote: s.text.slice(0, 500) }],
    }));
    if (mode === 'invalid' && claims[0]) claims[0].citations[0].sourceId = 'cross-region-source';
    const source = sources.find((s) => s.kind === 'instruction');
    const draft =
      ['clarification', 'public_summary', 'plan_draft', 'training_draft'].includes(data.task) &&
      sources[0]
        ? {
            kind: data.task,
            sections: [
              {
                heading: 'Draf sintetis',
                text: 'Draf untuk diperiksa manusia.',
                citations: [{ sourceId: sources[0].id, quote: sources[0].text.slice(0, 300) }],
              },
            ],
          }
        : null;
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Hasil sintetis ' + data.task,
                claims,
                questions: ['Informasi apa yang masih perlu dikonfirmasi?'],
                abstained: sources.length === 0,
                limitation: 'Fixture pengujian; bukan hasil model nyata.',
                translation: data.task === 'translation' ? (source?.text ?? null) : null,
                draft,
                needsHumanReview: true,
              }),
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 80 },
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  Object.assign(process.env, {
    AI_MODE: 'compatible',
    AI_PROVIDER: 'custom',
    AI_BASE_URL: 'http://127.0.0.1:' + server.address().port,
    AI_MODEL: 'fixture-only',
    AI_API_KEY: 'local-fixture-secret',
    AI_EMBEDDING_MODE: 'disabled',
  });
  app = await createApp(
    parseEnvironment({ ...process.env, NODE_ENV: 'test', LOG_LEVEL: 'silent' }),
  );
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  coordinator = await login('ciliwung@demo.tandara.test');
  admin = await login('admin@demo.tandara.test');
  await db.query('DELETE FROM rate_limits WHERE key=$1', [
    createHash('sha256')
      .update('ai-submit:' + coordinator.user.id)
      .digest('hex'),
  ]);
});
after(async () => {
  releaseResponse?.();
  await app?.close();
  await new Promise((resolve) => server?.close(resolve));
  await db.end();
  for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
  Object.assign(process.env, saved);
});
test('AI routes reject anonymous and cross-region callers', async () => {
  assert.equal(
    (
      await call(
        'POST',
        '/regions/' + region + '/ai/runs',
        { task: 'briefing', requestKey: crypto.randomUUID() },
        null,
      )
    ).statusCode,
    401,
  );
  assert.equal((await call('GET', '/regions/' + other + '/ai/runs')).statusCode, 403);
});
test('briefing uses complete scoped counts and durable checkpoints; replay does not call provider again', async () => {
  const id = await submit('briefing');
  const row = await drain(id);
  assert.equal(row.state, 'ready');
  const counts = row.sources.find((s) => s.kind === 'counts').text;
  const actual = (
    await db.query(
      "SELECT count(*)::int count FROM reports WHERE region_id=$1 AND NOT erased AND created_at>now()-interval '24 hours'",
      [region],
    )
  ).rows[0].count;
  assert.ok(counts.includes('Jumlah seluruh laporan: ' + actual + '.'));
  assert.ok(row.sources.filter((s) => s.kind === 'report').length <= 20);
  assert.equal(row.output.needsHumanReview, true);
  assert.ok(
    (
      await db.query(
        'SELECT count(*)::int count FROM ai_checkpoints.checkpoints WHERE thread_id=$1',
        [id],
      )
    ).rows[0].count >= 3,
  );
  const before = calls;
  await db.query("UPDATE outbox_jobs SET state='pending',available_at=now() WHERE entity_id=$1", [
    id,
  ]);
  await app.get(JobsService).tick();
  assert.equal(calls, before);
});
test('idempotent AI requests and budgets reserve exactly once under concurrent submissions', async () => {
  const request = { task: 'briefing', requestKey: crypto.randomUUID() };
  const results = await Promise.all([
    call('POST', '/regions/' + region + '/ai/runs', request),
    call('POST', '/regions/' + region + '/ai/runs', request),
  ]);
  assert.ok(
    results.every((r) => r.statusCode === 201),
    results.map((r) => r.body).join(),
  );
  assert.equal(results[0].json().id, results[1].json().id);
  const id = results[0].json().id;
  assert.equal(
    (await db.query('SELECT count(*)::int count FROM ai_budget_reservations WHERE run_id=$1', [id]))
      .rows[0].count,
    1,
  );
  assert.equal(
    (await call('POST', '/regions/' + region + '/ai/runs', { ...request, hours: 48 })).statusCode,
    409,
  );
  await drain(id);
});
test('AI review edits are append-only and preserve original generated output', async () => {
  const id = await submit('briefing');
  const original = await drain(id);
  let r = await call('POST', '/regions/' + region + '/ai/runs/' + id + '/review', {
    action: 'edited',
    note: 'Dikoreksi koordinator sintetis.',
    output: { ...original.output, title: 'Judul hasil koreksi' },
  });
  assert.equal(r.statusCode, 201, r.body);
  const row = await detail(id);
  assert.equal(row.output.title, original.output.title);
  assert.equal(row.reviews[0].output.title, 'Judul hasil koreksi');
  await assert.rejects(
    db.query("UPDATE ai_outputs SET output='{}' WHERE run_id=$1", [id]),
    /append-only/,
  );
  await assert.rejects(
    db.query("UPDATE ai_reviews SET note='changed' WHERE run_id=$1", [id]),
    /append-only/,
  );
});
test('knowledge approval requires independent review and withdrawal retracts dependent drafts', async () => {
  let r = await call('POST', '/regions/' + region + '/knowledge/references', {
    title: 'Referensi sintetis kesiapsiagaan',
    text: 'Simpan dokumen latihan dalam kantong kedap air. Periksa persediaan bersama keluarga.',
    sourceUrl: 'https://example.test/preparedness',
    licenseNote: 'Sumber fiktif diizinkan untuk pengujian.',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  assert.equal(r.statusCode, 201, r.body);
  const ref = r.json().id;
  r = await call('POST', '/regions/' + region + '/knowledge/references/' + ref + '/review', {
    action: 'approved',
    note: 'Peninjauan sumber sintetis.',
  });
  assert.equal(r.statusCode, 409, r.body);
  assert.equal(
    (
      await call(
        'POST',
        '/regions/' + region + '/knowledge/references/' + ref + '/review',
        { action: 'approved', note: 'Peninjau independen menyetujui fixture.' },
        admin,
      )
    ).statusCode,
    201,
  );
  const results = await call('GET', '/regions/' + region + '/knowledge?q=kantong', undefined, null);
  assert.equal(results.statusCode, 200, results.body);
  assert.ok(results.json().some((s) => s.entityId === ref));
  const id = await submit('answer', { question: 'kantong' });
  const row = await drain(id);
  assert.ok(row.sources.some((s) => s.entityId === ref));
  await call(
    'POST',
    '/regions/' + region + '/knowledge/references/' + ref + '/review',
    { action: 'withdrawn', note: 'Referensi sintetis ditarik.' },
    admin,
  );
  assert.equal((await detail(id)).state, 'unavailable');
  assert.equal((await detail(id)).output, null);
  assert.ok(
    !(await call('GET', '/regions/' + region + '/knowledge?q=kantong', undefined, null))
      .json()
      .some((s) => s.entityId === ref),
  );
});
test('retrieval RLS denies other regions and clears transaction-local scope', async () => {
  await db.query('BEGIN');
  await db.query("SELECT set_config('tandara.region',$1,true)", [region]);
  await db.query('SET LOCAL ROLE tandara_ai_scope');
  const rows = (await db.query('SELECT region_id FROM knowledge_documents')).rows;
  assert.ok(rows.every((r) => r.region_id === region));
  await assert.rejects(db.query('SELECT description FROM reports'), /permission denied/);
  await db.query('ROLLBACK');
  const current = (await db.query('SELECT current_user')).rows[0].current_user;
  assert.notEqual(current, 'tandara_ai_scope');
});
test('all assistance tasks produce separate drafts without mutating reports or plans', async () => {
  const key = crypto.randomUUID();
  const r = await call(
    'POST',
    '/reports',
    {
      regionId: region,
      category: 'road_flooding',
      description:
        'Laporan sintetis latihan: genangan terlihat dekat balai. Kontak: person@example.test.',
      landmarkText: 'Balai latihan',
      observationTime: new Date().toISOString(),
      followUpRequested: false,
      contactPermission: false,
      privacyConsent: true,
    },
    null,
  );
  assert.equal(r.statusCode, 400, 'report requires idempotency header');
  const reportId = (
    await db.query(
      "INSERT INTO reports(region_id,category,description,tracking_hash,idempotency_key,payload_hash) VALUES($1,'road_flooding',$2,$3,$4,$5) RETURNING id",
      [
        region,
        'Laporan sintetis latihan: genangan terlihat dekat balai. Kontak: person@example.test.',
        key,
        key,
        key,
      ],
    )
  ).rows[0].id;
  for (const task of [
    'duplicates',
    'clarification',
    'public_summary',
    'coverage',
    'translation',
    'plan_draft',
    'training_draft',
  ]) {
    const extra = ['duplicates', 'clarification', 'public_summary'].includes(task)
      ? { reportId }
      : ['translation', 'plan_draft', 'training_draft'].includes(task)
        ? { question: 'Simpan dokumen untuk 3 hari.', language: 'id' }
        : {};
    const id = await submit(task, extra);
    const row = await drain(id);
    assert.equal(row.state, 'ready');
    assert.equal(row.output.needsHumanReview, true);
    if (task === 'translation') assert.equal(row.output.translation, extra.question);
  }
  assert.equal(
    (await db.query('SELECT state,public_summary FROM reports WHERE id=$1', [reportId])).rows[0]
      .state,
    'submitted',
  );
  assert.ok(payloads.every((p) => !JSON.stringify(p).includes('person@example.test')));
});
test('transient errors retry within one run and reject fabricated citations', async () => {
  mode = 'transient';
  const id = await submit('briefing');
  const row = await drain(id);
  assert.equal(row.state, 'ready');
  assert.equal(
    (await db.query('SELECT count(*)::int count FROM ai_attempts WHERE run_id=$1', [id])).rows[0]
      .count,
    2,
  );
  mode = 'invalid';
  const invalid = await submit('briefing');
  for (let i = 0; i < 30; i++) {
    await app.get(JobsService).tick();
    if ((await detail(invalid)).state === 'failed') break;
  }
  assert.equal((await detail(invalid)).output, null);
  mode = 'valid';
});
test('kill switch and hard budgets stop AI admission while reports stay available', async () => {
  let r = await call(
    'POST',
    '/admin/ai/controls',
    {
      scope: 'global',
      scopeId: '*',
      enabled: false,
      reason: 'Arrêt fixture pour test de disponibilité.',
    },
    admin,
  );
  assert.equal(r.statusCode, 201, r.body);
  assert.equal(
    (
      await call('POST', '/regions/' + region + '/ai/runs', {
        task: 'briefing',
        requestKey: crypto.randomUUID(),
      })
    ).statusCode,
    503,
  );
  assert.equal((await call('GET', '/regions/' + region + '/reports')).statusCode, 200);
  await call(
    'POST',
    '/admin/ai/controls',
    {
      scope: 'global',
      scopeId: '*',
      enabled: true,
      reason: 'Restauration après test synthétique.',
    },
    admin,
  );
  const budget = process.env.AI_DAILY_BUDGET_MICRO_USD;
  process.env.AI_DAILY_BUDGET_MICRO_USD = '0';
  assert.equal(
    (
      await call('POST', '/regions/' + region + '/ai/runs', {
        task: 'briefing',
        requestKey: crypto.randomUUID(),
      })
    ).statusCode,
    503,
  );
  process.env.AI_DAILY_BUDGET_MICRO_USD = budget;
});
test('cancellation during inference prevents late output persistence', async () => {
  mode = 'hold';
  const id = await submit('briefing');
  const requested = new Promise((resolve) => {
    notifyRequest = resolve;
  });
  const tick = app.get(JobsService).tick();
  await requested;
  assert.ok(requestSeen);
  await call('POST', '/regions/' + region + '/ai/runs/' + id + '/cancel');
  mode = 'valid';
  releaseResponse();
  await tick;
  notifyRequest = null;
  assert.equal((await detail(id)).state, 'cancelled');
  assert.equal((await db.query('SELECT id FROM ai_outputs WHERE run_id=$1', [id])).rows.length, 0);
});

test('triage kill control prevents late candidate persistence after a provider response', async () => {
  const key = crypto.randomUUID();
  const reportId = (
    await db.query(
      "INSERT INTO reports(region_id,category,description,tracking_hash,idempotency_key,payload_hash) VALUES($1,'road_flooding',$2,$3,$4,$5) RETURNING id",
      [region, 'SIMULASI uji penghentian inferensi: genangan di jalan latihan.', key, key, key],
    )
  ).rows[0].id;
  await db.query(
    "INSERT INTO outbox_jobs(kind,entity_id,region_id,dedupe_key) VALUES('triage',$1,$2,$3)",
    [reportId, region, 'fixture-kill:' + key],
  );
  const job = (
    await db.query(
      "UPDATE outbox_jobs SET state='processing',lease_owner='fixture-kill',lease_until=now()+interval '2 minutes',fence=fence+1 WHERE entity_id=$1 AND kind='triage' RETURNING id,entity_id,region_id,attempts,fence::text,lease_owner",
      [reportId],
    )
  ).rows[0];
  mode = 'hold';
  const requested = new Promise((resolve) => {
    notifyRequest = resolve;
  });
  const work = app.get(AiService).triage(job, {
    id: reportId,
    description: 'SIMULASI uji penghentian inferensi: genangan di jalan latihan.',
    landmarkText: null,
    observationTime: null,
  });
  // Attach rejection handling before releasing the blocked fixture response.
  const rejected = assert.rejects(work);
  try {
    await requested;
    const control = await call(
      'POST',
      '/admin/ai/controls',
      {
        scope: 'global',
        scopeId: '*',
        enabled: false,
        reason: 'Penghentian saat inferensi sintetis berjalan.',
      },
      admin,
    );
    assert.equal(control.statusCode, 201, control.body);
    mode = 'valid';
    releaseResponse();
    await rejected;
    const row = (
      await db.query(
        'SELECT a.candidate,r.state FROM ai_runs r JOIN ai_attempts a ON a.run_id=r.id WHERE r.request_key=$1',
        ['triage:' + job.id],
      )
    ).rows[0];
    assert.equal(row.candidate, null);
    assert.equal(row.state, 'failed');
    const funded = (
      await db.query(
        'SELECT b.reserved::float8 reserved FROM ai_budget_ledger b JOIN ai_runs r ON r.id=b.run_id WHERE r.request_key=$1',
        ['triage:' + job.id],
      )
    ).rows[0].reserved;
    const prices = aiOperationsSettings();
    const upperBound = Math.ceil(
      (4 *
        (12002 * prices.AI_INPUT_MICRO_USD_PER_MILLION_TOKENS +
          readAiSettings(process.env).AI_MAX_OUTPUT_TOKENS *
            prices.AI_OUTPUT_MICRO_USD_PER_MILLION_TOKENS)) /
        1000000,
    );
    assert.ok(funded >= upperBound, 'Simulation triage must fund all four permitted attempts.');
  } finally {
    mode = 'valid';
    releaseResponse?.();
    notifyRequest = null;
    await call(
      'POST',
      '/admin/ai/controls',
      {
        scope: 'global',
        scopeId: '*',
        enabled: true,
        reason: 'Pemulihan setelah fixture penghentian.',
      },
      admin,
    );
    await db.query(
      "UPDATE outbox_jobs SET state='completed',lease_owner=NULL,lease_until=NULL WHERE id=$1",
      [job.id],
    );
  }
});
test('stale lease cannot finalize a workflow and operations never expose credentials', async () => {
  await assert.rejects(
    app.get(AiService).assertFence(app.get(DatabaseService).db, {
      id: crypto.randomUUID(),
      fence: '0',
      lease_owner: 'stale',
    }),
    /lease lost/,
  );
  await app.get(AiService).operations(admin.user);
  const r = await call('GET', '/admin/ai/operations', undefined, admin);
  assert.equal(r.statusCode, 200, r.body);
  assert.ok(!r.body.includes('local-fixture-secret'));
});
test('query embeddings are accounted separately and reused across generation retries', async () => {
  Object.assign(process.env, {
    AI_EMBEDDING_MODE: 'compatible',
    AI_EMBEDDING_PROVIDER: 'custom',
    AI_EMBEDDING_BASE_URL: process.env.AI_BASE_URL,
    AI_EMBEDDING_MODEL: 'fixture-embedding',
    AI_EMBEDDING_API_KEY: 'local-fixture-secret',
    AI_EMBEDDING_DIMENSIONS: '3',
  });
  try {
    mode = 'transient';
    const before = payloads.filter((p) => p.encoding_format === 'float').length;
    const id = await submit('answer', { question: 'dokumen' });
    const row = await drain(id);
    assert.equal(row.state, 'ready');
    assert.equal(payloads.filter((p) => p.encoding_format === 'float').length - before, 1);
    const attempts = (
      await db.query('SELECT operation,state FROM ai_attempts WHERE run_id=$1 ORDER BY number', [
        id,
      ])
    ).rows;
    assert.deepEqual(
      attempts.map((a) => a.operation),
      ['embedding', 'generation', 'generation'],
    );
    assert.equal(attempts[0].state, 'succeeded');
  } finally {
    process.env.AI_EMBEDDING_MODE = 'disabled';
    mode = 'valid';
  }
});
test('manual retry links a failed run once and preserves its immutable history', async () => {
  mode = 'invalid';
  const id = await submit('briefing');
  for (let i = 0; i < 40; i++) {
    await app.get(JobsService).tick();
    if ((await detail(id)).state === 'failed') break;
  }
  mode = 'valid';
  const responses = await Promise.all([
    call('POST', '/regions/' + region + '/ai/runs/' + id + '/retry'),
    call('POST', '/regions/' + region + '/ai/runs/' + id + '/retry'),
  ]);
  responses.forEach((r) => assert.equal(r.statusCode, 201, r.body));
  assert.equal(responses[0].json().id, responses[1].json().id);
  assert.equal((await drain(responses[0].json().id)).state, 'ready');
  assert.equal((await detail(id)).state, 'failed');
  assert.equal(
    (await db.query('SELECT previous_run_id FROM ai_runs WHERE id=$1', [responses[0].json().id]))
      .rows[0].previous_run_id,
    id,
  );
});
test('erasure during inference removes source snapshots and prevents late model output', async () => {
  const key = crypto.randomUUID();
  const reportId = (
    await db.query(
      "INSERT INTO reports(region_id,category,description,tracking_hash,idempotency_key,payload_hash) VALUES($1,'road_flooding','Laporan sintetis untuk pengujian penghapusan.', $2::text,$2::uuid,$2::text) RETURNING id",
      [region, key],
    )
  ).rows[0].id;
  mode = 'hold';
  const id = await submit('public_summary', { reportId });
  const requested = new Promise((resolve) => {
    notifyRequest = resolve;
  });
  const tick = app.get(JobsService).tick();
  await requested;
  try {
    await app
      .get(DatabaseService)
      .db.transaction()
      .execute((tx) => eraseReport(tx, reportId, region, null, 'Penghapusan fixture.'));
  } finally {
    mode = 'valid';
    releaseResponse();
    notifyRequest = null;
  }
  await tick;
  assert.equal((await detail(id)).state, 'cancelled');
  for (const table of ['ai_outputs', 'ai_output_sources', 'ai_attempts'])
    assert.equal(
      (await db.query('SELECT count(*)::int count FROM ' + table + ' WHERE run_id=$1', [id]))
        .rows[0].count,
      0,
    );
  assert.equal(
    (await db.query('SELECT erased FROM reports WHERE id=$1', [reportId])).rows[0].erased,
    true,
  );
});
test('concurrent erasure and model finalization follow a consistent lock order', async () => {
  const key = crypto.randomUUID();
  const description = 'SIMULASI persaingan penghapusan: genangan di jalan latihan.';
  const reportId = (
    await db.query(
      "INSERT INTO reports(region_id,category,description,tracking_hash,idempotency_key,payload_hash) VALUES($1,'road_flooding',$2,$3,$4,$5) RETURNING id",
      [region, description, key, key, key],
    )
  ).rows[0].id;
  const id = await submit('duplicates', { reportId });
  const lease = (
    await db.query(
      "UPDATE outbox_jobs SET state='processing',lease_owner='fixture-erasure-race',lease_until=now()+interval '2 minutes',fence=fence+1 WHERE entity_id=$1 AND kind='ai_workflow' RETURNING id,entity_id,region_id,attempts,fence::text,lease_owner",
      [id],
    )
  ).rows[0];
  mode = 'hold';
  const requested = new Promise((resolve) => {
    notifyRequest = resolve;
  });
  const outcome = app
    .get(AiService)
    .process(lease)
    .then(
      () => null,
      (error) => error,
    );
  await requested;
  let releaseErasure, notifyLocked;
  const locked = new Promise((resolve) => {
    notifyLocked = resolve;
  });
  const proceed = new Promise((resolve) => {
    releaseErasure = resolve;
  });
  const erased = app
    .get(DatabaseService)
    .db.transaction()
    .execute(async (tx) => {
      await tx.selectFrom('reports').select('id').where('id', '=', reportId).forUpdate().execute();
      notifyLocked();
      await proceed;
      await eraseReport(tx, reportId, region, null, 'Penghapusan fixture konkurensi.');
    })
    .then(
      () => null,
      (error) => error,
    );
  try {
    await locked;
    mode = 'valid';
    releaseResponse();
    let blocked = false;
    for (let i = 0; i < 100; i++) {
      blocked = (
        await db.query(
          "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%FROM reports%' AND query LIKE '%FOR SHARE%') blocked",
        )
      ).rows[0].blocked;
      if (blocked) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(blocked, true, 'Finalization must wait for the held source row.');
    releaseErasure();
    assert.equal(await erased, null, 'Erasure must commit without a deadlock.');
    assert.ok(await outcome, 'The revoked finalization must fail.');
    assert.equal((await detail(id)).state, 'cancelled');
    for (const table of ['ai_outputs', 'ai_output_sources', 'ai_attempts'])
      assert.equal(
        (await db.query('SELECT count(*)::int count FROM ' + table + ' WHERE run_id=$1', [id]))
          .rows[0].count,
        0,
      );
  } finally {
    mode = 'valid';
    releaseResponse?.();
    releaseErasure();
    notifyRequest = null;
    await Promise.all([erased, outcome]);
  }
});

test('release approval fails closed without evaluation evidence and two matching active reviewers', async () => {
  const release = await app.get(AiService).release();
  const r = await call(
    'POST',
    '/admin/ai/releases/' + release.id + '/approve',
    { evaluationHash: 'a'.repeat(64), note: 'Fixture incomplete evidence.' },
    admin,
  );
  assert.equal(r.statusCode, 409, r.body);
  assert.equal(
    (
      await call(
        'POST',
        '/admin/ai/releases/' + release.id + '/evaluations',
        { artifactHash: 'a'.repeat(64), caseCount: 10 },
        admin,
      )
    ).statusCode,
    400,
  );
  assert.equal(
    (await call('POST', '/admin/ai/releases/' + release.id + '/activate', undefined, admin))
      .statusCode,
    409,
  );
});
test('TOTP login requires a fresh code and consumes its counter atomically', async () => {
  const email = 'mfa-fixture-' + crypto.randomUUID() + '@demo.tandara.test';
  const previousKey = process.env.MFA_ENCRYPTION_KEY;
  process.env.MFA_ENCRYPTION_KEY = 'ab'.repeat(32);
  const mfa = newMfa(email);
  const id = crypto.randomUUID();
  try {
    await db.query(
      "INSERT INTO users(id,email,name,password_hash,role,totp_secret) SELECT $1,$2,'Fixture MFA',password_hash,'coordinator',$3 FROM users WHERE email='ciliwung@demo.tandara.test'",
      [id, email, encryptMfa(mfa.secret)],
    );
    assert.equal(
      (await call('POST', '/auth/login', { email, password: process.env.DEMO_PASSWORD }, null))
        .statusCode,
      401,
    );
    const code = new TOTP({ secret: mfa.secret }).generate();
    const responses = await Promise.all(
      [1, 2].map(() =>
        call('POST', '/auth/login', { email, password: process.env.DEMO_PASSWORD, code }, null),
      ),
    );
    assert.deepEqual(responses.map((r) => r.statusCode).sort(), [201, 401]);
    assert.equal(
      (await db.query('SELECT mfa_verified FROM sessions WHERE user_id=$1', [id])).rows[0]
        .mfa_verified,
      true,
    );
  } finally {
    await db.query('DELETE FROM sessions WHERE user_id=$1', [id]);
    await db.query('UPDATE users SET suspended=true,totp_secret=NULL WHERE id=$1', [id]);
    if (previousKey === undefined) delete process.env.MFA_ENCRYPTION_KEY;
    else process.env.MFA_ENCRYPTION_KEY = previousKey;
  }
});
test('revoking the actor during inference prevents candidate and output persistence', async () => {
  mode = 'hold';
  const id = await submit('briefing');
  const requested = new Promise((resolve) => {
    notifyRequest = resolve;
  });
  const tick = app.get(JobsService).tick();
  await requested;
  try {
    await db.query('UPDATE users SET suspended=true WHERE id=$1', [coordinator.user.id]);
    mode = 'valid';
    releaseResponse();
    await tick;
  } finally {
    await db.query('UPDATE users SET suspended=false WHERE id=$1', [coordinator.user.id]);
    notifyRequest = null;
    mode = 'valid';
  }
  assert.equal((await detail(id)).output, null);
  assert.equal((await detail(id)).state, 'failed');
  assert.equal(
    (await db.query('SELECT candidate FROM ai_attempts WHERE run_id=$1', [id])).rows[0].candidate,
    null,
  );
});
for (const provider of ['custom', 'gemini'])
  test(
    provider +
      ' embedding ingestion promotes complete source versions atomically and respects withdrawal',
    async () => {
      const originalFetch = globalThis.fetch;
      const payloadStart = payloads.length;
      const marker = 'native-fixture-' + crypto.randomUUID();
      const searchVector = provider === 'gemini' ? [1, ...Array(127).fill(0)] : [1, 0, 0];
      if (provider === 'gemini')
        globalThis.fetch = (url, options) => {
          const target =
            String(url) ===
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent'
              ? process.env.AI_BASE_URL + '/gemini/embeddings'
              : url;
          return originalFetch(target, options);
        };
      Object.assign(process.env, {
        AI_EMBEDDING_MODE: 'compatible',
        AI_EMBEDDING_PROVIDER: provider,
        AI_EMBEDDING_BASE_URL: provider === 'gemini' ? '' : process.env.AI_BASE_URL,
        AI_EMBEDDING_MODEL: provider === 'gemini' ? 'gemini-embedding-001' : 'fixture-embedding',
        AI_EMBEDDING_API_KEY: 'local-fixture-secret',
        AI_EMBEDDING_DIMENSIONS: provider === 'gemini' ? '128' : '3',
      });
      try {
        const imported = await call('POST', '/regions/' + region + '/knowledge/references', {
          title: 'Referensi indeks sintetis',
          text:
            'Paragraf pertama ' +
            marker +
            ' tentang perlengkapan latihan.\n\nParagraf kedua ' +
            marker +
            ' tentang pencatatan latihan.',
          sourceUrl: 'https://example.test/index',
          licenseNote: 'Fixture diizinkan untuk pengujian.',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        });
        assert.equal(imported.statusCode, 201, imported.body);
        const ref = imported.json().id;
        await call(
          'POST',
          '/regions/' + region + '/knowledge/references/' + ref + '/review',
          { action: 'approved', note: 'Persetujuan independen untuk fixture indeks.' },
          admin,
        );
        await app.get(AiService).scheduleKnowledge();
        const chunks = (
          await db.query(
            'SELECT c.id FROM knowledge_chunks c JOIN knowledge_documents d ON d.id=c.document_id WHERE d.source_id=$1 ORDER BY c.section',
            [ref],
          )
        ).rows;
        assert.equal(chunks.length, 2);
        for (let index = 0; index < chunks.length; index++) {
          const run = (
            await db.query(
              "SELECT id FROM ai_runs WHERE task='knowledge_index' AND request->>'chunkId'=$1 AND release_id IN (SELECT id FROM ai_model_releases WHERE manifest->>'embeddingRelease'=$2)",
              [chunks[index].id, embeddingRelease()],
            )
          ).rows[0];
          assert.ok(run);
          const job = (
            await db.query(
              "UPDATE outbox_jobs SET state='processing',lease_owner='fixture-index-worker',lease_until=now()+interval '2 minutes',fence=fence+1 WHERE entity_id=$1 RETURNING id,region_id,entity_id,attempts,fence::text,lease_owner",
              [run.id],
            )
          ).rows[0];
          await app.get(AiService).indexKnowledge(job);
          await db.query("UPDATE outbox_jobs SET state='completed' WHERE id=$1", [job.id]);
          const result = await app
            .get(KnowledgeService)
            .search(region, 'unmatchedsyntheticword', searchVector);
          assert.equal(
            result.some((r) => r.entityId === ref),
            index === 1,
          );
        }
        if (provider === 'gemini') {
          const submitted = await call(
            'POST',
            '/regions/' + region + '/ai/runs',
            { task: 'answer', requestKey: crypto.randomUUID(), question: 'unmatchedsyntheticword' },
            admin,
          );
          assert.equal(submitted.statusCode, 201, submitted.body);
          const result = await drain(submitted.json().id);
          assert.equal(result.state, 'ready');
          assert.ok(result.sources.some((s) => s.entityId === ref));
          const nativeRequests = payloads
            .slice(payloadStart)
            .filter(
              (body) =>
                body.content?.parts &&
                (body.taskType === 'RETRIEVAL_QUERY' ||
                  body.content.parts[0].text.includes(marker)),
            );
          assert.equal(
            nativeRequests.filter((body) => body.taskType === 'RETRIEVAL_DOCUMENT').length,
            2,
          );
          assert.equal(
            nativeRequests.filter((body) => body.taskType === 'RETRIEVAL_QUERY').length,
            1,
          );
          const usage = (
            await db.query(
              "SELECT usage FROM ai_attempts WHERE run_id=$1 AND operation='embedding'",
              [result.id],
            )
          ).rows[0].usage;
          assert.equal(usage.prompt_tokens, 11);
        }
        await call(
          'POST',
          '/regions/' + region + '/knowledge/references/' + ref + '/review',
          { action: 'withdrawn', note: 'Penarikan referensi indeks sintetis.' },
          admin,
        );
        assert.ok(
          !(
            await app.get(KnowledgeService).search(region, 'unmatchedsyntheticword', searchVector)
          ).some((r) => r.entityId === ref),
        );
      } finally {
        globalThis.fetch = originalFetch;
        await db.query(
          "UPDATE ai_runs SET state='cancelled' WHERE task='knowledge_index' AND state IN ('queued','processing') AND release_id IN (SELECT id FROM ai_model_releases WHERE manifest->>'model'='fixture-only')",
        );
        await db.query(
          "UPDATE outbox_jobs SET state='failed',error='fixture_cleanup',fence=fence+1,lease_owner=NULL,lease_until=NULL WHERE kind='knowledge_index' AND state IN ('pending','processing') AND entity_id IN (SELECT id FROM ai_runs WHERE state='cancelled' AND task='knowledge_index')",
        );
        process.env.AI_EMBEDDING_MODE = 'disabled';
      }
    },
  );
