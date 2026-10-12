import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../packages/database/package.json', import.meta.url));
const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 3000,
});
after(async () => {
  await client.end();
});

test('real PostgreSQL has required extensions and a repeatable migration', async () => {
  await client.connect();
  const result = await client.query(
    "SELECT extname FROM pg_extension WHERE extname IN ('postgis', 'pg_trgm', 'citext')",
  );
  assert.equal(result.rowCount, 3);
  const migrations = await client.query(
    "SELECT name FROM kysely_migration WHERE name = '001_foundation'",
  );
  assert.equal(migrations.rowCount, 1);
  const metadata = await client.query('SELECT key FROM app_metadata LIMIT 1');
  assert.ok(Array.isArray(metadata.rows));
});
