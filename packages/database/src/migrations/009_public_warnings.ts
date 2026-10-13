import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE information_sources DROP CONSTRAINT information_sources_provider_check`.execute(
    db,
  );
  await sql`ALTER TABLE information_sources ADD CONSTRAINT information_sources_provider_check CHECK(provider IN ('fixture','bmkg','bmkg_nowcast','petabencana','inarisk'))`.execute(
    db,
  );
  await sql`ALTER TABLE information_records DROP CONSTRAINT information_records_source_type_check`.execute(
    db,
  );
  await sql`ALTER TABLE information_records ADD CONSTRAINT information_records_source_type_check CHECK(source_type IN ('official_weather','official_alert','external_community','simulation'))`.execute(
    db,
  );
  await sql`ALTER TABLE information_records ADD COLUMN issued_at timestamptz`.execute(db);
}

export async function down(): Promise<void> {
  throw new Error('Forward-only migration: preserve warning provenance.');
}
