import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql
    .raw(
      `
CREATE TABLE organizations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE regions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), name text NOT NULL, boundary geometry(Polygon,4326) NOT NULL, config jsonb NOT NULL, simulation boolean NOT NULL DEFAULT true, suspended boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), CHECK (ST_IsValid(boundary)));
CREATE INDEX regions_boundary_gist ON regions USING gist(boundary);
CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email citext UNIQUE NOT NULL, name text NOT NULL, password_hash text NOT NULL, role text NOT NULL CHECK(role IN ('coordinator','admin')), suspended boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE memberships (user_id uuid REFERENCES users(id), region_id uuid REFERENCES regions(id), organization_id uuid REFERENCES organizations(id), PRIMARY KEY(user_id,region_id));
CREATE TABLE sessions (token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf_hash text NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE rate_limits (key text PRIMARY KEY, count int NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), region_id uuid NOT NULL REFERENCES regions(id), category text NOT NULL CHECK(category IN ('road_flooding','water_entering_homes','blocked_access','debris','damaged_facility','follow_up_needed','other')), description text NOT NULL CHECK(length(description) BETWEEN 10 AND 2000), landmark_text text, observation_time timestamptz, location geometry(Point,4326), accuracy_meters double precision, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), state text NOT NULL DEFAULT 'submitted' CHECK(state IN ('submitted','under_review','clarification_requested','reviewed','rejected','closed')), follow_up_requested boolean NOT NULL DEFAULT false, tracking_hash text UNIQUE NOT NULL, idempotency_key uuid UNIQUE NOT NULL, payload_hash text NOT NULL, public_summary text, reviewed_by uuid REFERENCES users(id), reviewed_at timestamptz, simulation boolean NOT NULL DEFAULT true, revision int NOT NULL DEFAULT 1, erased boolean NOT NULL DEFAULT false, UNIQUE(id,region_id));
CREATE INDEX reports_region_state_time ON reports(region_id,state,created_at DESC);
CREATE INDEX reports_location_gist ON reports USING gist(location);
CREATE INDEX reports_search_trgm ON reports USING gin(description gin_trgm_ops);
CREATE TABLE report_private_details (report_id uuid PRIMARY KEY REFERENCES reports(id) ON DELETE CASCADE, contact_details text, consent_at timestamptz NOT NULL, retention_until timestamptz NOT NULL);
CREATE TABLE report_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid NOT NULL REFERENCES reports(id), actor_id uuid REFERENCES users(id), action text NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE assistance_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid NOT NULL UNIQUE, region_id uuid NOT NULL, state text NOT NULL DEFAULT 'received' CHECK(state IN ('received','assigned','in_progress','closed')), organization_id uuid REFERENCES organizations(id), note text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(report_id,region_id) REFERENCES reports(id,region_id));
CREATE TABLE report_attachments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid NOT NULL REFERENCES reports(id), name text NOT NULL, content bytea NOT NULL, mime text NOT NULL CHECK(mime='image/jpeg'), created_at timestamptz NOT NULL DEFAULT now(), CHECK(octet_length(content) <= 2000000));
CREATE TABLE ai_suggestions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid NOT NULL REFERENCES reports(id), output jsonb, state text NOT NULL CHECK(state IN ('ready','failed','accepted','edited','rejected')), provider text NOT NULL, model text NOT NULL, prompt_version text NOT NULL, duration_ms int NOT NULL, error text, reviewer_id uuid REFERENCES users(id), human_note text, reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE duplicate_candidates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid NOT NULL, other_id uuid NOT NULL, region_id uuid NOT NULL, evidence text NOT NULL, state text NOT NULL DEFAULT 'suggested' CHECK(state IN ('suggested','linked','dismissed')), reviewer_id uuid REFERENCES users(id), reason text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(report_id,other_id), CHECK(report_id<>other_id), FOREIGN KEY(report_id,region_id) REFERENCES reports(id,region_id), FOREIGN KEY(other_id,region_id) REFERENCES reports(id,region_id));
CREATE TABLE plan_versions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), region_id uuid NOT NULL REFERENCES regions(id), version int NOT NULL, content jsonb NOT NULL, state text NOT NULL CHECK(state IN ('draft','in_review','changes_requested','approved','published','archived')), author_id uuid NOT NULL REFERENCES users(id), reviewer_id uuid REFERENCES users(id), reviewed_at timestamptz, review_note text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), simulation boolean NOT NULL DEFAULT true, UNIQUE(region_id,version), CHECK(reviewer_id IS NULL OR author_id<>reviewer_id));
CREATE UNIQUE INDEX one_published_plan ON plan_versions(region_id) WHERE state='published';
CREATE TABLE information_sources (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), region_id uuid NOT NULL REFERENCES regions(id), name text NOT NULL, provider text NOT NULL CHECK(provider IN ('fixture','bmkg','petabencana','inarisk')), enabled boolean NOT NULL DEFAULT false, mode text NOT NULL CHECK(mode IN ('simulation','live','disabled')), source_url text NOT NULL, license_note text NOT NULL, config jsonb NOT NULL DEFAULT '{}', last_attempt_at timestamptz, last_success_at timestamptz, last_error text, UNIQUE(id,region_id));
CREATE TABLE source_runs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES information_sources(id), state text NOT NULL CHECK(state IN ('success','failed')), error text, record_count int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE information_records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL, region_id uuid NOT NULL, external_id text NOT NULL, title text NOT NULL, body text NOT NULL, source_name text NOT NULL, source_url text NOT NULL, source_type text NOT NULL CHECK(source_type IN ('official_weather','external_community','simulation')), observed_at timestamptz, fetched_at timestamptz NOT NULL, effective_at timestamptz, expires_at timestamptz, verification_status text NOT NULL, version text NOT NULL, simulation boolean NOT NULL, UNIQUE(source_id,external_id), FOREIGN KEY(source_id,region_id) REFERENCES information_sources(id,region_id));
CREATE TABLE information_revisions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), information_id uuid NOT NULL REFERENCES information_records(id), content jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE training_scenarios (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), region_id uuid NOT NULL REFERENCES regions(id), content jsonb NOT NULL, author_id uuid REFERENCES users(id), simulation boolean NOT NULL DEFAULT true CHECK(simulation), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE training_results (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scenario_id uuid NOT NULL REFERENCES training_scenarios(id), completion_key uuid UNIQUE NOT NULL, score int NOT NULL, answers jsonb NOT NULL, feedback text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE audit_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid REFERENCES users(id), region_id uuid REFERENCES regions(id), action text NOT NULL, entity_id text, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX audit_region_time ON audit_events(region_id,created_at DESC);
CREATE FUNCTION protect_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Audit events are append-only'; END $$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION protect_audit();
CREATE TABLE outbox_jobs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK(kind IN ('triage','source_sync','retention')), entity_id uuid, region_id uuid REFERENCES regions(id), state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','completed','failed')), attempts int NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(), locked_at timestamptz, error text, dedupe_key text UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX outbox_available ON outbox_jobs(state,available_at);
CREATE TABLE deletion_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid NOT NULL REFERENCES reports(id), region_id uuid NOT NULL REFERENCES regions(id), state text NOT NULL DEFAULT 'requested' CHECK(state IN ('requested','completed')), created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, UNIQUE(report_id));
CREATE TABLE worker_heartbeat (id text PRIMARY KEY, seen_at timestamptz NOT NULL);
CREATE TABLE notification_preferences (user_id uuid PRIMARY KEY REFERENCES users(id), enabled boolean NOT NULL DEFAULT true);
CREATE TABLE notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id), region_id uuid REFERENCES regions(id), title text NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
`,
    )
    .execute(db);
}

export async function down(): Promise<void> {
  throw new Error(
    'Product migration rollback requires a verified backup; no destructive automatic down migration.',
  );
}
