import { createRequire } from 'node:module';
const require = createRequire(new URL('../packages/database/package.json', import.meta.url));
const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 2000,
});
try {
  await client.connect();
  const r = await client.query(
    "SELECT seen_at > now()-interval '30 seconds' AS healthy FROM worker_heartbeat WHERE id='primary'",
  );
  if (!r.rows[0]?.healthy) process.exitCode = 1;
} catch {
  process.exitCode = 1;
} finally {
  await client.end();
}
