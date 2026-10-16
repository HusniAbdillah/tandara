import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE reports ADD COLUMN publish_on_map boolean NOT NULL DEFAULT false`.execute(
    db,
  );
}

export async function down(): Promise<void> {
  throw new Error('Forward-only migration: preserve report publication decisions.');
}
