import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  createDatabase,
  demoAccounts,
  seedDemoAccounts,
} from '../../packages/database/dist/index.js';
const { sql } = createRequire(new URL('../../packages/database/package.json', import.meta.url))(
  'kysely',
);

test('demo synchronization preserves unrelated accounts and sessions unless a fixture password changes', async () => {
  assert.equal(process.env.APP_MODE, 'simulation');
  const password = process.env.DEMO_PASSWORD;
  assert.ok(password);
  const { db } = createDatabase(process.env.DATABASE_URL);
  const resident = demoAccounts.residents[0];
  const marker = randomBytes(16).toString('hex');
  const phone = '+628' + String(Date.now()).slice(-10);
  try {
    await seedDemoAccounts(db, password, true);
    await sql`INSERT INTO residents(phone,name,password_hash) VALUES(${phone},'Warga lain','unrelated-hash')`.execute(
      db,
    );
    await sql`INSERT INTO resident_sessions(token_hash,resident_id,csrf_hash,expires_at) VALUES(${marker},${resident.id}::uuid,${marker},now()+interval '1 hour')`.execute(
      db,
    );
    const before = (
      await sql`SELECT password_hash FROM residents WHERE id=${resident.id}::uuid`.execute(db)
    ).rows[0];
    await seedDemoAccounts(db, password, true);
    assert.ok(
      (await sql`SELECT password_hash FROM residents WHERE id=${resident.id}::uuid`.execute(db))
        .rows[0].password_hash === before.password_hash,
      'Repeat seed must preserve the existing password hash',
    );
    assert.equal(
      (await sql`SELECT token_hash FROM resident_sessions WHERE token_hash=${marker}`.execute(db))
        .rows.length,
      1,
    );
    await seedDemoAccounts(db, password + '-changed', true);
    assert.equal(
      (await sql`SELECT token_hash FROM resident_sessions WHERE token_hash=${marker}`.execute(db))
        .rows.length,
      0,
    );
    assert.deepEqual(
      (await sql`SELECT name,password_hash FROM residents WHERE phone=${phone}`.execute(db))
        .rows[0],
      { name: 'Warga lain', password_hash: 'unrelated-hash' },
    );
    assert.equal(
      (
        await sql`SELECT count(*)::int AS count FROM residents WHERE id IN (${demoAccounts.residents[0].id}::uuid,${demoAccounts.residents[1].id}::uuid)`.execute(
          db,
        )
      ).rows[0].count,
      2,
    );
  } finally {
    await seedDemoAccounts(db, password, true);
    await sql`DELETE FROM residents WHERE phone=${phone}`.execute(db);
    await db.destroy();
  }
});
