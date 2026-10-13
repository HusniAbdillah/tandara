import { sql, type Kysely } from 'kysely';
export async function up(db: Kysely<unknown>) {
  await sql
    .raw(
      `
ALTER TABLE users ADD COLUMN totp_secret text, ADD COLUMN totp_pending text, ADD COLUMN totp_counter bigint NOT NULL DEFAULT -1;
ALTER TABLE sessions ADD COLUMN mfa_verified boolean NOT NULL DEFAULT false;
CREATE TABLE ai_admin_roles(user_id uuid PRIMARY KEY REFERENCES users(id), role text NOT NULL CHECK(role IN ('operator','approver')));
CREATE TABLE erasure_ledger(report_id uuid PRIMARY KEY REFERENCES reports(id), erased_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE ai_dispatch_turns(region_id uuid PRIMARY KEY REFERENCES regions(id),dispatched_at timestamptz NOT NULL DEFAULT now());
`,
    )
    .execute(db);
}
export async function down() {
  throw new Error('Security rollback requires verified restore.');
}
