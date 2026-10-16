import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE report_private_details ADD COLUMN resident_phone text`.execute(db);
  await sql`INSERT INTO report_private_details(report_id,resident_phone,consent_at,retention_until)
    SELECT r.id,a.phone,r.created_at,r.created_at+(g.config->>'retentionDays')::int*interval '1 day'
    FROM reports r JOIN residents a ON a.id=r.resident_id JOIN regions g ON g.id=r.region_id
    WHERE NOT r.erased AND r.created_at+(g.config->>'retentionDays')::int*interval '1 day'>now()
    ON CONFLICT(report_id) DO UPDATE SET resident_phone=EXCLUDED.resident_phone
    WHERE report_private_details.retention_until>now()`.execute(db);
}
export async function down(): Promise<void> {
  throw new Error('Forward-only migration: preserve report contact retention.');
}
