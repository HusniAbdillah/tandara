import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE TABLE residents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    phone text NOT NULL UNIQUE,
    name text NOT NULL DEFAULT 'Warga',
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`.execute(db);
  await sql`CREATE TABLE resident_sessions (
    token_hash text PRIMARY KEY,
    resident_id uuid NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
    csrf_hash text NOT NULL,
    expires_at timestamptz NOT NULL
  )`.execute(db);
  await sql`CREATE INDEX resident_sessions_expiry ON resident_sessions(expires_at)`.execute(db);
}
export async function down(): Promise<void> {
  throw new Error('Forward-only migration: preserve resident accounts.');
}
