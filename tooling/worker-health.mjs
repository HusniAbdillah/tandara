import { createRequire } from 'node:module';
import { hostname } from 'node:os';
const require = createRequire(new URL('../packages/database/package.json', import.meta.url));
const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 2000,
});
try {
  await client.connect();
  const r = await client.query(
    "SELECT EXISTS(SELECT 1 FROM worker_heartbeat WHERE id LIKE $1 AND seen_at>now()-interval '45 seconds') AS healthy",
    [hostname() + ':%'],
  );
  if (!r.rows[0]?.healthy) process.exitCode = 1;
} catch {
  process.exitCode = 1;
} finally {
  await client.end();
}
