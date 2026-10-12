import { sql } from 'kysely';
import type { Kysely } from 'kysely';

// Unknown keeps this migration independent of the current generated application schema.
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS postgis`.execute(db);
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`.execute(db);
  await sql`CREATE EXTENSION IF NOT EXISTS citext`.execute(db);
  await db.schema
    .createTable('app_metadata')
    .addColumn('key', 'text', (column) => column.primaryKey())
    .addColumn('value', 'jsonb', (column) => column.notNull())
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('app_metadata').execute();
  // Shared database extensions are deliberately retained.
}
