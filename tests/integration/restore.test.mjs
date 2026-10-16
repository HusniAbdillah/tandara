import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase } from '../../packages/database/dist/client.js';
import { eraseReport } from '../../packages/backend/dist/modules/privacy.js';
const { Client } = createRequire(new URL('../../packages/database/package.json', import.meta.url))(
  'pg',
);
test('isolated backup restore replays later erasures and withdrawals before serving', async () => {
  assert.equal(process.env.APP_MODE, 'simulation');
  const source = new URL(process.env.DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(source.hostname));
  assert.equal(source.port, '55432');
  const container = process.env.PG_DRILL_CONTAINER ?? 'tandara-dev-postgres-1';
  assert.match(container, /^tandara-(dev-postgres-1|ci-db)$/);
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  const original = 'drill_original_' + suffix,
    restored = 'drill_restored_' + suffix;
  const dump = '/tmp/tandara-drill-' + suffix + '.dump';
  const dir = mkdtempSync(join(tmpdir(), 'tandara-restore-'));
  const ledger = join(dir, 'ledger.json');
  const owner = new Client({ connectionString: source.href });
  await owner.connect();
  let db, restoredClient;
  const run = (command, args, env = {}) => {
    const result = spawnSync(command, args, {
      encoding: 'utf8',
      env: { ...process.env, ...env },
      timeout: 60000,
    });
    assert.equal(result.status, 0, result.stderr);
  };
  const url = (name) => {
    const value = new URL(source);
    value.pathname = '/' + name;
    return value.href;
  };
  try {
    for (const name of [original, restored]) {
      assert.match(name, /^drill_(original|restored)_[a-f0-9]{12}$/);
      await owner.query('CREATE DATABASE ' + name);
    }
    const env = { DATABASE_URL: url(original), DEMO_PASSWORD: 'isolated-restore-fixture-password' };
    run(process.execPath, ['packages/database/dist/migrate.js'], env);
    run(process.execPath, ['packages/database/dist/seed.js'], env);
    db = createDatabase(url(original)).db;
    const client = new Client({ connectionString: url(original) });
    await client.connect();
    const region = '20000000-0000-4000-8000-000000000001',
      reportId = crypto.randomUUID(),
      refId = crypto.randomUUID(),
      key = crypto.randomUUID();
    await client.query(
      "INSERT INTO reports(id,region_id,category,description,tracking_hash,idempotency_key,payload_hash) VALUES($1,$2,'other','SIMULASI data sintetis sebelum permintaan penghapusan.',$3::text,$3::uuid,$3::text)",
      [reportId, region, key],
    );
    const users = (await client.query('SELECT id FROM users ORDER BY email LIMIT 2')).rows;
    await client.query(
      "INSERT INTO knowledge_references(id,region_id,title,text,source_url,license_note,expires_at,state,author_id,reviewer_id) VALUES($1,$2,'Referensi restore sintetis','Materi sintetis untuk menguji penarikan sumber.','https://example.test/restore','Fixture diizinkan untuk pengujian.',now()+interval '1 day','approved',$3,$4)",
      [refId, region, users[0].id, users[1].id],
    );
    await client.query(
      "INSERT INTO sessions(token_hash,user_id,csrf_hash,expires_at) VALUES($1,$2,$1,now()+interval '1 hour')",
      ['restore-fixture-session', users[0].id],
    );
    await client.query(
      "WITH resident AS (INSERT INTO residents(phone,password_hash) VALUES('+6281234567890','restore-fixture-only') RETURNING id) INSERT INTO resident_sessions(token_hash,resident_id,csrf_hash,expires_at) SELECT 'restore-resident-session',id,'restore-fixture-csrf',now()+interval '1 hour' FROM resident",
    );
    await client.query(
      "UPDATE reports SET resident_id=(SELECT id FROM residents WHERE phone='+6281234567890') WHERE id=$1",
      [reportId],
    );
    await client.query(
      "INSERT INTO report_history(report_id,action,reason) VALUES($1,'under_review','Fixture notification before backup')",
      [reportId],
    );
    await client.end();
    run('docker', [
      'exec',
      container,
      'pg_dump',
      '-U',
      decodeURIComponent(source.username),
      '-Fc',
      '-f',
      dump,
      original,
    ]);
    await db
      .transaction()
      .execute((tx) =>
        eraseReport(tx, reportId, region, null, 'Penghapusan fixture setelah backup.'),
      );
    const mutate = new Client({ connectionString: url(original) });
    await mutate.connect();
    await mutate.query("UPDATE knowledge_references SET state='withdrawn' WHERE id=$1", [refId]);
    await mutate.end();
    run(process.execPath, ['tooling/export-privacy-ledger.mjs', ledger], env);
    run('docker', [
      'exec',
      container,
      'pg_restore',
      '-U',
      decodeURIComponent(source.username),
      '-d',
      restored,
      '--no-owner',
      dump,
    ]);
    restoredClient = new Client({ connectionString: url(restored) });
    await restoredClient.connect();
    assert.equal(
      (await restoredClient.query('SELECT erased FROM reports WHERE id=$1', [reportId])).rows[0]
        .erased,
      false,
    );
    assert.ok(
      (await restoredClient.query('SELECT resident_id FROM reports WHERE id=$1', [reportId]))
        .rows[0].resident_id,
    );
    assert.equal(
      (
        await restoredClient.query(
          'SELECT count(*)::int n FROM resident_notifications WHERE report_id=$1',
          [reportId],
        )
      ).rows[0].n,
      1,
    );
    run(process.execPath, ['tooling/restore-privacy.mjs', ledger], {
      DATABASE_URL: url(restored),
      RESTORE_QUARANTINE: 'true',
    });
    assert.equal(
      (await restoredClient.query('SELECT erased FROM reports WHERE id=$1', [reportId])).rows[0]
        .erased,
      true,
    );
    assert.equal(
      (await restoredClient.query('SELECT resident_id FROM reports WHERE id=$1', [reportId]))
        .rows[0].resident_id,
      null,
    );
    assert.equal(
      (
        await restoredClient.query(
          'SELECT count(*)::int n FROM resident_notifications WHERE report_id=$1',
          [reportId],
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (await restoredClient.query('SELECT state FROM knowledge_references WHERE id=$1', [refId]))
        .rows[0].state,
      'withdrawn',
    );
    assert.equal(
      (await restoredClient.query('SELECT count(*)::int count FROM sessions')).rows[0].count,
      0,
    );
    assert.equal(
      (await restoredClient.query('SELECT count(*)::int count FROM resident_sessions')).rows[0]
        .count,
      0,
    );
  } finally {
    await db?.destroy();
    await restoredClient?.end();
    for (const name of [restored, original]) {
      assert.match(name, /^drill_(original|restored)_[a-f0-9]{12}$/);
      await owner.query('DROP DATABASE IF EXISTS ' + name + ' WITH (FORCE)');
    }
    await owner.end();
    spawnSync('docker', ['exec', container, 'rm', '-f', dump], { encoding: 'utf8' });
    try {
      unlinkSync(ledger);
    } catch {
      /* Export may not have been created. */
    }
    rmdirSync(dir);
  }
});
