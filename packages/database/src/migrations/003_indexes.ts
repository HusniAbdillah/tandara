import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Database } from '../client.js';
export async function up(db: Kysely<Database>): Promise<void> {
  await sql`CREATE INDEX reports_geography_gist ON reports USING gist((location::geography)) WHERE NOT erased`.execute(
    db,
  );
  await sql`CREATE INDEX reports_region_recent ON reports(region_id,created_at DESC,id) WHERE NOT erased`.execute(
    db,
  );
  await sql`CREATE INDEX reports_retention ON reports(created_at) WHERE NOT erased`.execute(db);
  await sql`CREATE INDEX notifications_user_recent ON notifications(user_id,created_at DESC)`.execute(
    db,
  );
}
export async function down(db: Kysely<Database>): Promise<void> {
  await sql`DROP INDEX notifications_user_recent, reports_retention, reports_region_recent, reports_geography_gist`.execute(
    db,
  );
}
