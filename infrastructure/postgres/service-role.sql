-- Run as the migration owner after all domain/checkpoint migrations.
-- Set the password through your approved secret manager, never through a committed SQL file.
CREATE ROLE tandara_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
GRANT CONNECT ON DATABASE tandara TO tandara_app;
GRANT USAGE ON SCHEMA public,ai_checkpoints TO tandara_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public,ai_checkpoints TO tandara_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public,ai_checkpoints TO tandara_app;
GRANT tandara_ai_scope TO tandara_app WITH INHERIT FALSE;
REVOKE UPDATE,DELETE ON audit_events,ai_model_releases,ai_release_approvals,ai_evaluations FROM tandara_app;
REVOKE UPDATE ON ai_outputs,ai_reviews,ai_suggestion_reviews FROM tandara_app;
-- Reapply grants after future migrations. This role cannot perform migrations.
