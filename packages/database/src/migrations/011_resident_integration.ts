import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql
    .raw(
      `
    ALTER TABLE reports ADD COLUMN resident_id uuid REFERENCES residents(id) ON DELETE SET NULL;
    CREATE INDEX reports_resident_time ON reports(resident_id,created_at DESC,id) WHERE resident_id IS NOT NULL;
    CREATE TABLE resident_notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      resident_id uuid NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
      report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      history_id uuid NOT NULL UNIQUE REFERENCES report_history(id) ON DELETE CASCADE,
      action text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      read_at timestamptz
    );
    CREATE INDEX resident_notifications_owner_time ON resident_notifications(resident_id,created_at DESC,id);
    CREATE INDEX resident_notifications_unread ON resident_notifications(resident_id) WHERE read_at IS NULL;
    -- Publish only status codes, never private coordinator notes or contact details.
    -- This runs in the same transaction as report/assistance history creation.
    CREATE FUNCTION notify_resident_report_history() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.action IN ('under_review','clarification_requested','reviewed','rejected','closed',
                       'assistance.received','assistance.assigned','assistance.in_progress','assistance.closed') THEN
        INSERT INTO resident_notifications(resident_id,report_id,history_id,action,created_at)
        SELECT resident_id,id,NEW.id,NEW.action,NEW.created_at FROM reports
        WHERE id=NEW.report_id AND resident_id IS NOT NULL AND NOT erased
        ON CONFLICT(history_id) DO NOTHING;
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER resident_report_history_notification AFTER INSERT ON report_history
      FOR EACH ROW EXECUTE FUNCTION notify_resident_report_history();
    -- Erasure (including replay after a backup restore) also removes the new account association.
    CREATE FUNCTION erase_resident_report_association() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.erased THEN
        NEW.resident_id := NULL;
        DELETE FROM resident_notifications WHERE report_id=NEW.id;
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER resident_report_erasure BEFORE UPDATE OF erased ON reports
      FOR EACH ROW EXECUTE FUNCTION erase_resident_report_association();
  `,
    )
    .execute(db);
}
export async function down(): Promise<void> {
  throw new Error('Forward-only migration: preserve resident ownership and notification state.');
}
