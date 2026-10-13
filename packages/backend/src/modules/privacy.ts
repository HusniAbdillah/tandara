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
  await sql`UPDATE reports SET description=${reason},state='closed',landmark_text=NULL,location=NULL,accuracy_meters=NULL,observation_time=NULL,public_summary=NULL,erased=true,updated_at=now(),revision=revision+1 WHERE id=${id}::uuid AND NOT erased`.execute(
    tx,
  );
  await sql`DELETE FROM report_private_details WHERE report_id=${id}::uuid`.execute(tx);
  await sql`DELETE FROM report_attachments WHERE report_id=${id}::uuid`.execute(tx);
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
