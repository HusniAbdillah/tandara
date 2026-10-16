import { sql } from 'kysely';
import type { Connection } from './shared.js';

export async function retainResidentPhone(db: Connection, reportId: string) {
  // Use the authenticated account association, never a phone supplied in report input.
  // Keep the snapshot in the existing private-contact retention and erasure lifecycle.
  await sql`INSERT INTO report_private_details(report_id,resident_phone,consent_at,retention_until)
    SELECT r.id,a.phone,now(),r.created_at+(g.config->>'retentionDays')::int*interval '1 day'
    FROM reports r JOIN residents a ON a.id=r.resident_id JOIN regions g ON g.id=r.region_id
    WHERE r.id=${reportId}::uuid AND NOT r.erased
      AND r.created_at+(g.config->>'retentionDays')::int*interval '1 day'>now()
    ON CONFLICT(report_id) DO UPDATE SET resident_phone=EXCLUDED.resident_phone
    WHERE report_private_details.retention_until>now()`.execute(db);
}
