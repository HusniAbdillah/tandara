import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql
    .raw(
      `
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE outbox_jobs DROP CONSTRAINT outbox_jobs_kind_check;
ALTER TABLE outbox_jobs ADD CONSTRAINT outbox_jobs_kind_check CHECK(kind IN ('triage','source_sync','retention','ai_workflow','knowledge_index'));
ALTER TABLE outbox_jobs ADD COLUMN lease_owner text, ADD COLUMN lease_until timestamptz, ADD COLUMN fence bigint NOT NULL DEFAULT 0;
ALTER TABLE ai_suggestions ADD COLUMN reviewed_output jsonb, ADD COLUMN legacy_provenance boolean NOT NULL DEFAULT false;
UPDATE ai_suggestions SET legacy_provenance=true WHERE state='edited';
CREATE TABLE ai_suggestion_reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), suggestion_id uuid NOT NULL REFERENCES ai_suggestions(id) ON DELETE CASCADE, reviewer_id uuid NOT NULL REFERENCES users(id), action text NOT NULL, note text NOT NULL, output jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION protect_ai_original() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.output IS DISTINCT FROM OLD.output THEN RAISE EXCEPTION 'Generated output is immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER ai_suggestion_original BEFORE UPDATE ON ai_suggestions FOR EACH ROW EXECUTE FUNCTION protect_ai_original();
CREATE TABLE ai_model_releases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), manifest jsonb NOT NULL, fingerprint text UNIQUE NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE ai_release_approvals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), release_id uuid NOT NULL REFERENCES ai_model_releases(id), actor_id uuid NOT NULL REFERENCES users(id), evaluation_hash text NOT NULL, note text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(release_id,actor_id));
CREATE TRIGGER ai_release_immutable BEFORE UPDATE OR DELETE ON ai_model_releases FOR EACH ROW EXECUTE FUNCTION protect_audit();
CREATE TRIGGER ai_approval_immutable BEFORE UPDATE OR DELETE ON ai_release_approvals FOR EACH ROW EXECUTE FUNCTION protect_audit();
CREATE TABLE ai_controls(scope text NOT NULL CHECK(scope IN ('global','provider','task','organization','release')), scope_id text NOT NULL, enabled boolean NOT NULL, reason text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(scope,scope_id));
CREATE TABLE ai_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), region_id uuid NOT NULL REFERENCES regions(id), organization_id uuid NOT NULL REFERENCES organizations(id), actor_id uuid REFERENCES users(id), report_id uuid REFERENCES reports(id), task text NOT NULL, request jsonb NOT NULL, request_key text UNIQUE NOT NULL, release_id uuid NOT NULL REFERENCES ai_model_releases(id), state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','processing','ready','failed','cancelled','expired','unavailable')), deadline timestamptz NOT NULL DEFAULT now()+interval '15 minutes', error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX ai_runs_queue ON ai_runs(region_id,state,created_at);
CREATE TABLE ai_attempts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL REFERENCES ai_runs(id) ON DELETE CASCADE, region_id uuid NOT NULL REFERENCES regions(id), number int NOT NULL, provider text NOT NULL, model text NOT NULL, state text NOT NULL, estimated_tokens int NOT NULL DEFAULT 0, usage jsonb, candidate jsonb, duration_ms int NOT NULL DEFAULT 0, error text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(run_id,number));
CREATE TABLE ai_outputs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL UNIQUE REFERENCES ai_runs(id) ON DELETE CASCADE, region_id uuid NOT NULL REFERENCES regions(id), output jsonb NOT NULL, provenance jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION protect_ai_output() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'AI records are append-only; erasure uses DELETE'; END $$;
CREATE TRIGGER ai_output_immutable BEFORE UPDATE ON ai_outputs FOR EACH ROW EXECUTE FUNCTION protect_ai_output();
CREATE TABLE ai_reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL REFERENCES ai_runs(id) ON DELETE CASCADE, region_id uuid NOT NULL REFERENCES regions(id), reviewer_id uuid NOT NULL REFERENCES users(id), action text NOT NULL CHECK(action IN ('accepted','edited','rejected')), note text NOT NULL, output jsonb, previous_id uuid REFERENCES ai_reviews(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER ai_review_immutable BEFORE UPDATE ON ai_reviews FOR EACH ROW EXECUTE FUNCTION protect_ai_output();
CREATE TRIGGER ai_suggestion_review_immutable BEFORE UPDATE ON ai_suggestion_reviews FOR EACH ROW EXECUTE FUNCTION protect_ai_output();
CREATE TABLE ai_output_sources(run_id uuid NOT NULL REFERENCES ai_runs(id) ON DELETE CASCADE, region_id uuid NOT NULL REFERENCES regions(id), source_id text NOT NULL, entity_id uuid NOT NULL, kind text NOT NULL, version text NOT NULL, snapshot jsonb NOT NULL, PRIMARY KEY(run_id,source_id));
CREATE INDEX ai_dependency_entity ON ai_output_sources(entity_id);
CREATE TABLE ai_budget_reservations(run_id uuid PRIMARY KEY REFERENCES ai_runs(id) ON DELETE CASCADE, organization_id uuid NOT NULL REFERENCES organizations(id), day date NOT NULL DEFAULT current_date, reserved bigint NOT NULL CHECK(reserved>=0), actual bigint, estimated boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX ai_budget_day ON ai_budget_reservations(organization_id,day);
CREATE TABLE knowledge_documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), region_id uuid NOT NULL REFERENCES regions(id), source_id uuid NOT NULL REFERENCES plan_versions(id), version text NOT NULL, content_hash text NOT NULL, expires_at timestamptz NOT NULL, simulation boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(source_id,version));
CREATE TABLE knowledge_chunks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE, region_id uuid NOT NULL REFERENCES regions(id), section text NOT NULL, text text NOT NULL, lexical tsvector GENERATED ALWAYS AS (to_tsvector('simple',text)) STORED, embedding vector, embedding_release text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(document_id,section));
CREATE INDEX knowledge_lexical ON knowledge_chunks USING gin(lexical);
CREATE INDEX knowledge_scope ON knowledge_chunks(region_id,document_id);
DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='tandara_ai_scope') THEN CREATE ROLE tandara_ai_scope NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF; END $$;
GRANT tandara_ai_scope TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO tandara_ai_scope;
GRANT SELECT,INSERT,UPDATE,DELETE ON ai_runs,ai_attempts,ai_outputs,ai_reviews,ai_output_sources,knowledge_documents,knowledge_chunks TO tandara_ai_scope;
CREATE VIEW ai_approved_plans WITH (security_barrier=true) AS SELECT id,content,state FROM plan_versions WHERE region_id::text=current_setting('tandara.region',true) AND state='published' AND (content->>'expiresAt')::timestamptz>now();
GRANT SELECT ON ai_approved_plans TO tandara_ai_scope;
`,
    )
    .execute(db);
  for (const table of [
    'ai_runs',
    'ai_attempts',
    'ai_outputs',
    'ai_reviews',
    'ai_output_sources',
    'knowledge_documents',
    'knowledge_chunks',
  ]) {
    await sql
      .raw(
        `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; ALTER TABLE ${table} FORCE ROW LEVEL SECURITY; CREATE POLICY ai_scope ON ${table} TO tandara_ai_scope USING(region_id::text=current_setting('tandara.region',true)) WITH CHECK(region_id::text=current_setting('tandara.region',true)); CREATE POLICY ai_service ON ${table} TO PUBLIC USING(current_user <> 'tandara_ai_scope') WITH CHECK(current_user <> 'tandara_ai_scope');`,
      )
      .execute(db);
  }
}
export async function down(): Promise<void> {
  throw new Error('AI rollback requires a verified backup and compatible application release.');
}
