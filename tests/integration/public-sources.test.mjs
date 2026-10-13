import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { createApp, JobsService } from '../../apps/api/dist/bootstrap.js';
import { parseEnvironment } from '../../packages/backend/dist/index.js';

const { Client } = createRequire(new URL('../../packages/database/package.json', import.meta.url))(
  'pg',
);
const db = new Client({ connectionString: process.env.DATABASE_URL });
const regionId = '20000000-0000-4000-8000-000000000001';
let app;
const originalFetch = globalThis.fetch;
const sourceIds = [];
const capUrl = 'https://www.bmkg.go.id/alerts/nowcast/id/CJK_fixture_alert.xml';
const rss = (items = true) =>
  `<rss><channel><title>BMKG</title>${items ? `<item><title>Hujan di Jakarta</title><link>${capUrl}</link></item>` : ''}</channel></rss>`;
function cap(polygon, identifier = 'source-integration-fixture') {
  return `<alert><identifier>${identifier}</identifier><sender>fixture@bmkg.go.id</sender><sent>${new Date(Date.now() - 60000).toISOString()}</sent><status>Actual</status><msgType>Alert</msgType><scope>Public</scope><info><language>id</language><event>Fixture</event><headline>PERINGATAN SINTETIS TEST</headline><description>Fixture integration, bukan peringatan nyata.</description><effective>${new Date(Date.now() - 30000).toISOString()}</effective><expires>${new Date(Date.now() + 3600000).toISOString()}</expires><area><areaDesc>Jakarta</areaDesc><polygon>${polygon}</polygon></area></info></alert>`;
}
before(async () => {
  assert.equal(process.env.APP_MODE, 'simulation');
  await db.connect();
  process.env.AI_MODE = 'heuristic';
  process.env.AI_EMBEDDING_MODE = 'disabled';
  process.env.ALLOW_LIVE_SOURCES = 'true';
  app = await createApp(
    parseEnvironment({ ...process.env, NODE_ENV: 'test', LOG_LEVEL: 'silent' }),
  );
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});
after(async () => {
  globalThis.fetch = originalFetch;
  await db.query('UPDATE information_sources SET enabled=false WHERE id=ANY($1::uuid[])', [
    sourceIds,
  ]);
  await app?.close();
  await db.end();
});
async function source() {
  const id = crypto.randomUUID();
  sourceIds.push(id);
  await db.query(
    "INSERT INTO information_sources(id,region_id,name,provider,enabled,mode,source_url,license_note,config) VALUES($1,$2,'Synthetic integration source','bmkg_nowcast',true,'live','https://data.bmkg.go.id/peringatan-dini-cuaca/','Fixture only for tests',$3)",
    [id, regionId, JSON.stringify({ authorized: true, province: 'DKI Jakarta' })],
  );
  return id;
}
async function run(id) {
  const jobs = app.get(JobsService);
  const jobId = crypto.randomUUID();
  const job = (
    await db.query(
      "INSERT INTO outbox_jobs(id,kind,entity_id,region_id,state,lease_owner,lease_until,fence) VALUES($1,'source_sync',$2,$3,'processing',$4,now()+interval '2 minutes',1) RETURNING id,kind,entity_id,region_id,attempts,fence::text,lease_owner",
      [jobId, id, regionId, jobs.workerId],
    )
  ).rows[0];
  try {
    await jobs.source(job);
  } finally {
    await db.query("UPDATE outbox_jobs SET state='completed',lease_until=NULL WHERE id=$1", [
      jobId,
    ]);
  }
}
async function publicFeed() {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/regions/' + regionId + '/public',
  });
  assert.equal(response.statusCode, 200, response.body);
  return response.json();
}
test('CAP region clipping, stable outage timestamps, public health and complete empty snapshots', async () => {
  const id = await source();
  const xml = cap('-6.23,106.85 -6.23,106.87 -6.21,106.87 -6.21,106.85 -6.23,106.85');
  globalThis.fetch = async (url) => new Response(String(url).endsWith('/id') ? rss() : xml);
  await run(id);
  const first = await publicFeed();
  const warning = first.information.find((i) => i.sourceId === id);
  assert.equal(warning.sourceType, 'official_alert');
  assert.ok(warning.issuedAt);
  assert.equal(warning.observedAt, null);
  assert.equal(first.sources.find((s) => s.id === id).failed, false);
  assert.equal('config' in first.sources.find((s) => s.id === id), false);
  globalThis.fetch = async () => {
    throw new TypeError('Synthetic outage');
  };
  await assert.rejects(run(id), /Source failed/);
  const failed = await publicFeed();
  assert.equal(failed.information.find((i) => i.sourceId === id).fetchedAt, warning.fetchedAt);
  assert.equal(failed.sources.find((s) => s.id === id).failed, true);
  globalThis.fetch = async () => new Response(rss(false));
  await run(id);
  assert.equal(
    (await publicFeed()).information.some((i) => i.sourceId === id),
    false,
  );
});
test('overlapping valid CAP polygons remain valid as a collection', async () => {
  const id = await source();
  const xml = cap(
    '-6.23,106.85 -6.23,106.87 -6.21,106.87 -6.21,106.85 -6.23,106.85',
    'overlapping-fixture',
  ).replace(
    '</area>',
    '<polygon>-6.22,106.86 -6.22,106.88 -6.20,106.88 -6.20,106.86 -6.22,106.86</polygon></area>',
  );
  globalThis.fetch = async (url) => new Response(String(url).endsWith('/id') ? rss() : xml);
  await run(id);
  assert.equal(
    (await publicFeed()).information.find((i) => i.sourceId === id).sourceType,
    'official_alert',
  );
});
test('province membership alone cannot import a warning outside the region', async () => {
  const id = await source();
  globalThis.fetch = async (url) =>
    new Response(
      String(url).endsWith('/id')
        ? rss()
        : cap('-7,107 -7,108 -8,108 -8,107 -7,107', 'outside-fixture'),
    );
  await run(id);
  assert.equal(
    (await publicFeed()).information.some((i) => i.sourceId === id),
    false,
  );
  const count = await db.query(
    'SELECT record_count FROM source_runs WHERE source_id=$1 ORDER BY created_at DESC LIMIT 1',
    [id],
  );
  assert.equal(count.rows[0].record_count, 0);
});
test('invalid geometry fails without retiring the previous warning', async () => {
  const id = await source();
  const valid = cap('-6.23,106.85 -6.23,106.87 -6.21,106.87 -6.21,106.85 -6.23,106.85');
  globalThis.fetch = async (url) => new Response(String(url).endsWith('/id') ? rss() : valid);
  await run(id);
  const first = (await publicFeed()).information.find((i) => i.sourceId === id);
  const invalid = cap(
    '-6.23,106.85 -6.21,106.87 -6.23,106.87 -6.21,106.85 -6.23,106.85',
    'invalid-fixture',
  );
  globalThis.fetch = async (url) => new Response(String(url).endsWith('/id') ? rss() : invalid);
  await assert.rejects(run(id));
  assert.equal(
    (await publicFeed()).information.find((i) => i.sourceId === id).fetchedAt,
    first.fetchedAt,
  );
});
test('changed configuration during the fetch cannot publish the old response', async () => {
  const id = await source();
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/id')) return new Response(rss());
    await db.query(
      "UPDATE information_sources SET config=jsonb_set(config,'{province}','\"Aceh\"') WHERE id=$1",
      [id],
    );
    return new Response(cap('-6.23,106.85 -6.23,106.87 -6.21,106.87 -6.21,106.85 -6.23,106.85'));
  };
  await run(id);
  assert.equal(
    (await publicFeed()).information.some((i) => i.sourceId === id),
    false,
  );
});
