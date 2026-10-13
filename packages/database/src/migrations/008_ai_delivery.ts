import { sql, type Kysely } from 'kysely';
export async function up(db: Kysely<unknown>) {
  await sql
    .raw(
      `
ALTER TABLE ai_runs ADD COLUMN previous_run_id uuid REFERENCES ai_runs(id) ON DELETE SET NULL;
CREATE OR REPLACE VIEW ai_approved_plans WITH (security_barrier=true) AS SELECT id,content,state FROM plan_versions WHERE region_id::text=current_setting('tandara.region',true) AND state='published' AND (content->>'expiresAt')::timestamptz>now() UNION ALL SELECT id,jsonb_build_object('title',title,'sourceUrl',source_url),'published'::text state FROM knowledge_references WHERE region_id::text=current_setting('tandara.region',true) AND state='approved' AND expires_at>now();
CREATE INDEX ai_pending_deadline ON ai_runs(deadline) WHERE state IN ('queued','processing');
`,
    )
    .execute(db);
}
export async function down() {
  throw new Error('Delivery rollback requires verified restore.');
}
