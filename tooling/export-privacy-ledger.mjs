import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../packages/database/package.json', import.meta.url));
const { Client } = require('pg');
const db = new Client({ connectionString: process.env.DATABASE_URL });
if (!process.argv[2])
  throw new Error(
    'Provide a private export path. Store the export independently from database backups.',
  );
await db.connect();
try {
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const ledger = {
    exportedAt: new Date().toISOString(),
    erasedReports: (await db.query('SELECT report_id FROM erasure_ledger')).rows.map(
      (r) => r.report_id,
    ),
    withdrawnReferences: (
      await db.query("SELECT id FROM knowledge_references WHERE state='withdrawn'")
    ).rows.map((r) => r.id),
  };
  await db.query('COMMIT');
  await writeFile(process.argv[2], JSON.stringify(ledger), { mode: 0o600 });
  console.info('Minimal privacy ledger exported.');
} finally {
  await db.end();
}
