import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE reports
    ADD COLUMN workflow_status text NOT NULL DEFAULT 'received' CHECK(workflow_status IN ('received','verified','assigned','in_progress','awaiting_approval','resolved','closed','rejected','needs_information')),
    ADD COLUMN assignee_id uuid REFERENCES users(id),
    ADD COLUMN priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('normal','high','urgent')),
    ADD COLUMN resolution_author_id uuid REFERENCES users(id)`.execute(db);
  await sql`UPDATE reports SET workflow_status=CASE state WHEN 'closed' THEN 'closed' WHEN 'rejected' THEN 'rejected' WHEN 'reviewed' THEN 'verified' WHEN 'clarification_requested' THEN 'needs_information' ELSE 'received' END`.execute(
    db,
  );
  await sql`CREATE TABLE report_updates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid NOT NULL REFERENCES reports(id),
    actor_id uuid REFERENCES users(id), action text NOT NULL, message text NOT NULL,
    rating integer CHECK(rating BETWEEN 1 AND 5), created_at timestamptz NOT NULL DEFAULT now()
  )`.execute(db);
  await sql`CREATE INDEX report_updates_report_time ON report_updates(report_id,created_at)`.execute(
    db,
  );
  await sql`CREATE INDEX reports_workflow_queue ON reports(region_id,workflow_status,assignee_id) WHERE NOT erased`.execute(
    db,
  );
}
export async function down(): Promise<void> {
  throw new Error('Forward-only migration: preserve report history.');
}
