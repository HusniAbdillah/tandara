import { sql, type Kysely } from 'kysely';
export async function up(db: Kysely<unknown>) {
  await sql
    .raw(
      `
ALTER TABLE ai_attempts ADD COLUMN operation text NOT NULL DEFAULT 'generation';
CREATE TABLE knowledge_references(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),region_id uuid NOT NULL REFERENCES regions(id),version int NOT NULL DEFAULT 1,title text NOT NULL,text text NOT NULL,source_url text NOT NULL,license_note text NOT NULL,expires_at timestamptz NOT NULL,state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','approved','withdrawn')),author_id uuid NOT NULL REFERENCES users(id),reviewer_id uuid REFERENCES users(id),review_note text,created_at timestamptz NOT NULL DEFAULT now(),CHECK(author_id<>reviewer_id));
ALTER TABLE knowledge_documents DROP CONSTRAINT knowledge_documents_source_id_fkey;
ALTER TABLE knowledge_documents ADD COLUMN source_kind text NOT NULL DEFAULT 'plan' CHECK(source_kind IN ('plan','reference'));
CREATE OR REPLACE VIEW ai_approved_plans WITH (security_barrier=true) AS SELECT id,content,state FROM plan_versions WHERE region_id::text=current_setting('tandara.region',true) AND state='published' AND (content->>'expiresAt')::timestamptz>now() UNION ALL SELECT id,jsonb_build_object('title',title),'published'::text state FROM knowledge_references WHERE region_id::text=current_setting('tandara.region',true) AND state='approved' AND expires_at>now();
CREATE TABLE translation_reviewers(user_id uuid NOT NULL REFERENCES users(id),language text NOT NULL CHECK(language IN ('id','jv','su')),qualification_note text NOT NULL,PRIMARY KEY(user_id,language));
`,
    )
    .execute(db);
}
export async function down() {
  throw new Error('Knowledge rollback requires verified restore.');
}
