import { sql } from 'kysely';
import { audit } from './shared.js';
import type { Connection } from './shared.js';
export async function eraseReport(
  tx: Connection,
  id: string,
  regionId: string,
  actor: string | null,
  reason: string,
) {
  await sql`SELECT id FROM reports WHERE id=${id}::uuid FOR UPDATE`.execute(tx);
  await sql`INSERT INTO erasure_ledger(report_id) VALUES(${id}::uuid) ON CONFLICT DO NOTHING`.execute(
    tx,
  );
  await sql`UPDATE reports SET description=${reason},state='closed',landmark_text=NULL,location=NULL,accuracy_meters=NULL,observation_time=NULL,public_summary=NULL,erased=true,updated_at=now(),revision=revision+1 WHERE id=${id}::uuid AND NOT erased`.execute(
    tx,
  );
  await sql`DELETE FROM report_private_details WHERE report_id=${id}::uuid`.execute(tx);
  await sql`DELETE FROM report_attachments WHERE report_id=${id}::uuid`.execute(tx);
  const runs = (
    await sql<{
      id: string;
    }>`SELECT id FROM ai_runs WHERE report_id=${id}::uuid OR id IN (SELECT run_id FROM ai_output_sources WHERE entity_id=${id}::uuid) FOR UPDATE`.execute(
      tx,
    )
  ).rows;
  for (const run of runs) {
    await sql`UPDATE ai_runs SET state='cancelled',request='{}'::jsonb,error='source_erased',updated_at=now() WHERE id=${run.id}::uuid`.execute(
      tx,
    );
    await sql`DELETE FROM ai_outputs WHERE run_id=${run.id}::uuid`.execute(tx);
    await sql`DELETE FROM ai_reviews WHERE run_id=${run.id}::uuid`.execute(tx);
    await sql`DELETE FROM ai_attempts WHERE run_id=${run.id}::uuid`.execute(tx);
    await sql`DELETE FROM ai_output_sources WHERE run_id=${run.id}::uuid`.execute(tx);
    await sql`UPDATE outbox_jobs SET state='failed',error='source_erased',lease_owner=NULL,lease_until=NULL,fence=fence+1 WHERE entity_id=${run.id}::uuid AND kind='ai_workflow'`.execute(
      tx,
    );
  }
  await sql`DELETE FROM ai_suggestions WHERE report_id=${id}::uuid`.execute(tx);
  await sql`DELETE FROM duplicate_candidates WHERE report_id=${id}::uuid OR other_id=${id}::uuid`.execute(
    tx,
  );
  await sql`UPDATE assistance_requests SET note='',state='closed',updated_at=now() WHERE report_id=${id}::uuid`.execute(
    tx,
  );
  await sql`UPDATE report_history SET reason=${reason} WHERE report_id=${id}::uuid`.execute(tx);
  await sql`UPDATE deletion_requests SET state='completed',completed_at=now() WHERE report_id=${id}::uuid AND state='requested'`.execute(
    tx,
  );
  await audit(tx, actor, regionId, 'privacy.erased', id, { reason });
}
