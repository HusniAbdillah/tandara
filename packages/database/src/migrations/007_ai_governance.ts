import { sql, type Kysely } from 'kysely';
export async function up(db: Kysely<unknown>) {
  await sql
    .raw(
      `
CREATE TABLE ai_budget_ledger(run_id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES organizations(id),day date NOT NULL,reserved bigint NOT NULL,actual bigint,estimated boolean NOT NULL DEFAULT true);
INSERT INTO ai_budget_ledger SELECT run_id,organization_id,day,reserved,actual,estimated FROM ai_budget_reservations;
CREATE TABLE ai_evaluations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),release_id uuid NOT NULL REFERENCES ai_model_releases(id),artifact_hash text NOT NULL,report jsonb NOT NULL,actor_id uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(release_id,artifact_hash));
CREATE TRIGGER ai_evaluation_immutable BEFORE UPDATE OR DELETE ON ai_evaluations FOR EACH ROW EXECUTE FUNCTION protect_audit();
CREATE FUNCTION protect_approved_reference() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.state<>'draft' AND (NEW.title IS DISTINCT FROM OLD.title OR NEW.text IS DISTINCT FROM OLD.text OR NEW.source_url IS DISTINCT FROM OLD.source_url OR NEW.expires_at IS DISTINCT FROM OLD.expires_at) THEN RAISE EXCEPTION 'Approved reference text is immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER approved_reference_immutable BEFORE UPDATE ON knowledge_references FOR EACH ROW EXECUTE FUNCTION protect_approved_reference();
`,
    )
    .execute(db);
}
export async function down() {
  throw new Error('Governance rollback requires verified restore.');
}
