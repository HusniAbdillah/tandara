import { createDatabase } from '@tandara/database';
import { hostname } from 'node:os';
// Installed in the backend package, whose declared dependency is @tandara/database.
const { pool } = createDatabase(process.env.DATABASE_URL);
try {
  const result = await pool.query(
    "SELECT EXISTS(SELECT 1 FROM worker_heartbeat WHERE id LIKE $1 AND seen_at>now()-interval '45 seconds') AS healthy",
    [hostname() + ':%'],
  );
  if (!result.rows[0]?.healthy) process.exitCode = 1;
} catch {
  process.exitCode = 1;
} finally {
  // The query uses pg directly, so close pg explicitly (Kysely's lazy driver was not initialized).
  await pool.end();
}
