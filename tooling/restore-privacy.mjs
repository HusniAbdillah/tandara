import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { eraseReport } from '../packages/backend/dist/modules/privacy.js';
const require = createRequire(new URL('../packages/backend/package.json', import.meta.url));
const { createDatabase } = await import('../packages/database/dist/client.js');
const { sql } = require('kysely');
if (process.env.RESTORE_QUARANTINE !== 'true')
  throw new Error('Restore replay is allowed only in an isolated, non-serving quarantine.');
const file = process.argv[2];
if (!file)
  throw new Error('Provide the latest independently exported erasure and withdrawal ledger.');
const ledger = JSON.parse(await readFile(file, 'utf8'));
if (
  !Array.isArray(ledger.erasedReports) ||
  !Array.isArray(ledger.withdrawnReferences) ||
  !ledger.exportedAt
)
  throw new Error('Invalid privacy ledger.');
const { db } = createDatabase(process.env.DATABASE_URL);
try {
  await db.transaction().execute(async (tx) => {
    for (const id of ledger.erasedReports) {
      if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid ledger identity');
      const row = (await sql`SELECT region_id FROM reports WHERE id=${id}::uuid`.execute(tx))
        .rows[0];
      if (row)
        await eraseReport(
          tx,
          id,
          row.region_id,
          null,
          'Penghapusan dipulihkan dari ledger privasi.',
        );
    }
    for (const id of ledger.withdrawnReferences) {
      if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid ledger identity');
      await sql`UPDATE knowledge_references SET state='withdrawn' WHERE id=${id}::uuid`.execute(tx);
    }
    await sql`DELETE FROM knowledge_documents WHERE source_id IN (SELECT id FROM knowledge_references WHERE state='withdrawn')`.execute(
      tx,
    );
    await sql`DELETE FROM sessions`.execute(tx);
    await sql`DO $$ BEGIN IF to_regclass('public.resident_sessions') IS NOT NULL THEN DELETE FROM resident_sessions; END IF; END $$`.execute(
      tx,
    );
    await sql`UPDATE ai_runs SET state='cancelled',request='{}'::jsonb WHERE state IN ('queued','processing','failed')`.execute(
      tx,
    );
    await sql`UPDATE outbox_jobs SET state='failed',error='restore_quarantine',fence=fence+1,lease_owner=NULL,lease_until=NULL WHERE state IN ('pending','processing')`.execute(
      tx,
    );
  });
  console.info(
    'Privacy replay completed; keep quarantine until source freshness and authorization checks pass.',
  );
} finally {
  await db.destroy();
}
