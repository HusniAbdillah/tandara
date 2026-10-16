import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE resident_notifications
    ALTER COLUMN history_id DROP NOT NULL,
    ADD COLUMN update_id uuid UNIQUE REFERENCES report_updates(id) ON DELETE CASCADE,
    ADD CONSTRAINT resident_notification_one_event CHECK(num_nonnulls(history_id,update_id)=1)`.execute(
    db,
  );
  await sql
    .raw(
      `
    CREATE FUNCTION notify_resident_workflow_update() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      -- Workflow updates are already resident-visible. Store only their status code here.
      INSERT INTO resident_notifications(resident_id,report_id,update_id,action,created_at)
      SELECT resident_id,id,NEW.id,'workflow.' || NEW.action,NEW.created_at FROM reports
      WHERE id=NEW.report_id AND resident_id IS NOT NULL AND NOT erased
      ON CONFLICT(update_id) DO NOTHING;
      RETURN NEW;
    END $$;
    CREATE TRIGGER resident_workflow_notification AFTER INSERT ON report_updates
      FOR EACH ROW EXECUTE FUNCTION notify_resident_workflow_update();
  `,
    )
    .execute(db);
}
export async function down(): Promise<void> {
  throw new Error('Forward-only migration: preserve workflow notification state.');
}
