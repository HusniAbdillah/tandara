import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE reports ADD COLUMN publish_on_map boolean NOT NULL DEFAULT false`.execute(
    db,
  );
  await sql`UPDATE reports SET publish_on_map=true WHERE workflow_status IN ('verified','assigned','in_progress','awaiting_approval','resolved') AND state='reviewed' AND NOT follow_up_requested AND NOT erased AND location IS NOT NULL`.execute(
    db,
  );
}

export async function down(): Promise<void> {
  throw new Error('Forward-only migration: preserve report publication decisions.');
}
