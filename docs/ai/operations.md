# Production AI operations

## Configure inference

Use [provider setup](provider-setup.md). Keep actual keys in an ignored local file
or Secrets Manager. The example model IDs and keys are placeholders. Vikey and
direct DeepSeek generation can be switched through environment settings; embeddings
have an independent profile. Lexical retrieval works without embeddings.

The local Compose stack remains simulation-only. For production, use a separate
database and `.env.production.example`, never seed demo records, set `WEB_ORIGINS`
to exactly two HTTPS origins in **Warga, Posko** order, and use secure cookies and
trusted private proxies. Paid generation requires approved data processing and a
matching evaluated release. All costs/caps must be reviewed and funded.

## Migrate and onboard

Build the `app` and `web-production` Docker targets and reference immutable image
digests. `infrastructure/compose/compose.production.yml` takes `APP_IMAGE`,
`WEB_IMAGE`, `PRODUCTION_ENV_FILE` and a separate `MIGRATION_ENV_FILE`. The latter
has a migration-owner `DATABASE_URL`, `APP_MODE=production`, and
`SERVICE_DATABASE_URL` for `tandara_app` with a separate strong password. Migration
and checkpoint setup run once before replicas start, then grant/rotate the service
role through `tooling/provision-service-role.mjs`. Runtime accounts cannot migrate.

Both URLs require `sslmode=verify-full`; for RDS, set
`sslrootcert=/app/infrastructure/postgres/rds-ca-bundle.pem`. The bundled public
CA file was obtained from AWS's [RDS trust store](https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem)
and has SHA-256 `fe45bbebf92ad3e27a583bbb2ddd1553c521ed4d49af5514dc0a40372ea5395c`.
Review CA rotation with image releases; do not disable certificate verification.

On a fresh database, run `tooling/onboard-production.mjs` with private input and
enrollment-output paths. Its input is `{ "accounts": [...] }`; each account has
`email`, `name`, a password of at least 16 characters, and one `aiRole` (`operator`
or `approver`). Supply at least three distinct accounts: one operator and two
approvers. Set a separately generated 32-byte hexadecimal `MFA_ENCRYPTION_KEY`.
Enrollment output contains TOTP secrets and must use protected storage and an
approved secure handover channel. POSIX file modes do not establish Windows ACLs;
restrict private input/output directories through your OS controls.

Administrators can open `/admin` even before the first region exists, create the
owning organization and real region, then provision coordinators through
`tooling/provision-production-user.mjs`. Input fields are `email`, `name`, `password`,
`role`, `regionIds`, `authorizedBy` (active administrator ID), `reason`, and optional
`aiRole` (`operator` or `approver`, for a new administrator replacing a governance owner) and
`translationQualifications` (`language`, qualification `note`). For an account
already created in the admin interface but lacking MFA, set `enrollExisting=true`;
this installs MFA without resetting an existing enrollment. Run this maintenance
tool only with authorized private database credentials. Accounts without enrolled
MFA cannot log in to production. Enabling/replacing MFA through `/security`
requires password and existing authenticator proof and revokes prior sessions.

After changing the MFA encryption key, existing encrypted secrets require a
controlled re-encryption migration with both keys. Keep the old key available in
the protected recovery process until all secrets are migrated; simply replacing
the environment value is not a valid rotation.

## Knowledge and human decisions

Use Posko `/ai` to import bounded plaintext, an HTTPS source URL, usage/license
note and expiry. A different coordinator must approve it. Production corpus
content needs both a data owner and authorization for provider processing. The
application does not fetch the URL or accept arbitrary document uploads. Withdraw
incorrect or superseded references immediately. Only published, unexpired plans
and independently approved references enter retrieval. Model requests exclude
photos, dedicated contacts and precise coordinates. Free text needs human privacy
review; heuristic redaction is incomplete.

Drafts never publish a plan, verify a report, certify a route or dispatch help.
Operators accept, correct or reject a private result, then use the existing
independent report/plan/training review flows for any operational change. Production
translation acceptance/correction requires a recorded language qualification.
Source changes make dependent outputs unavailable. Erasure removes private
snapshots, candidates, output and review data and fences in-flight work.

## Evaluate, approve and roll back

Protected `.github/workflows/ai-evaluation.yml` evaluates primary/challenger model
IDs against an approved S3 dataset. Configure its protected `ai-staging` environment,
read-only AWS role, dataset bucket, model IDs, provider key, reviewed pricing and
explicit evaluation spending cap. It does not run on untrusted pull requests.
Use [evaluation format](evaluation.md) and independently review actual artifacts.

In `/ai` as an AI operator, upload the scored report and register the matching
release report. Registration rejects incomplete thresholds, missing review hashes,
and a different manifest fingerprint. Two distinct, active AI approvers approve
the same evaluation artifact hash. Only an operator can activate the release.
Approve both triage and assistance manifests. Approval does not independently
verify the truth of human reports; operators and reviewers must verify the frozen
artifacts and evidence. Keep a controlled, evaluated rollback manifest.

Changing provider, endpoint, prompt/schema, embeddings, model, prices or output
limit creates a manifest. Production execution needs matching approvals. Provider,
endpoint, price, embedding or workflow mismatch stops pending runs; retry them as
new funded requests after configuration/release approval. Activating a compatible
older model uses its pinned output limit and a new funded reservation. There is
no automatic model fallback. Failed assistance requests have a linked retry button;
index retries in administration create a linked funded run and preserve history.

## Observe and respond

AWS templates in `infrastructure/aws` include private multi-AZ RDS, encrypted
artifacts, two API/web replicas, workers, TLS load balancing, deployment rollback,
CPU-based API scaling, dashboards and core alarms. Existing multi-AZ subnets,
egress/NAT, ACM certificates, secret ARNs and funding are explicit inputs. Use
encrypted remote Terraform state with locking. Apply infrastructure in a reviewed
account, run the emitted one-off migration task, onboard, and then deploy services.
ECS services may initially be unhealthy until migrations and secrets are ready;
release traffic only after both `/health/backend` endpoints pass. Application
execution roles cannot read the migration secret. Review provider/VPC egress and
image registries before deployment. No AWS apply was performed for this delivery.

Set `OTEL_EXPORTER_OTLP_ENDPOINT` to a private HTTPS collector. The application
emits task/provider timing, queue counts/age, worker health and reserved-budget
percentage, with no prompts, output, source text, credentials or account/region
labels. External LangSmith/LangChain content tracing is rejected.
`infrastructure/monitoring` supplies collector and alert-rule templates. Pin and
validate collector/Prometheus images in staging, wire an owned alert receiver and
test missing worker/collector, five-minute backlog and 80% budget alarms. Confirm
alert delivery within the agreed on-call target; templates do not prove delivery.

Disable AI by global `*`, provider, task, organization or release in administration.
This prevents new admission and finalization while report acceptance and human
review continue. Investigate supplier failures using sanitized attempt codes and
metadata; do not copy provider bodies into logs. Retry limits, deadlines, circuit
breaker and funded admission bound work. Budget reservations stay against caps
even when usage is missing or run history expires. Compare supplier invoices with
usage estimates; conservative caps depend on accurate reviewed upper-bound prices.
Changing funding does not authorize an unevaluated model or source corpus.

## Load, faults and recovery

`pnpm ai:load <private-output.json>` defaults to a 900-second, 200-user synthetic
profile, two report submissions and one knowledge request per second. It requires
an authenticated admin session (`AI_LOAD_SESSION_COOKIE`, `AI_LOAD_CSRF`), an
isolated all-simulation target and nonbillable inference. Configure target with
`AI_LOAD_URL`; non-loopback staging additionally needs `AI_LOAD_ALLOW_STAGING=true`.
Short diagnostics use `AI_LOAD_SECONDS` and `AI_LOAD_USERS`. Preserve latency,
error and throttle counts. Production capacity must use an approved traffic profile
with realistic independent client identities and contracted model quotas; this
single-origin smoke does not bypass abuse limits or establish those targets.

Integration fixtures exercise provider 429/outage, invalid citations, replay,
lease loss, in-flight cancellation/erasure/access revocation, source withdrawal
and budget exhaustion. Repeat live supplier/worker/database fault drills in isolated
staging, preserve core-service and queue-recovery evidence, and confirm evaluated
rollback. Do not infer a month of availability from local checks.

Export the minimal independent privacy ledger using `pnpm privacy:export <private-path>`.
The AWS template schedules `privacy-ledger-backup.mjs` every minute in a private
ECS task. It serializes exports, uses verified database TLS and writes only erasure
and withdrawal identifiers to a versioned, KMS-encrypted S3 object. Its task role
can write that object but cannot read backups or delete versions. A CloudWatch
alarm reports five minutes without a successful export. Confirm scheduler delivery,
object versions and on-call alarm receipt in the target account. This handover is a launch
gate, not supplied account credentials. RDS provides PITR; rehearse your actual
account's RPO/RTO and export consistency under failure.

Restore into a quarantined, non-serving database, obtain the **latest independent**
ledger (not the restored database's ledger), set `RESTORE_QUARANTINE=true`, and run
`pnpm privacy:restore <ledger-path>`. It reapplies erasures/withdrawals, removes
derived reference chunks, revokes sessions and fences/cancels queued work. Keep
quarantine until fresh-source, authorization, budget and queued-job checks pass;
never simply expose a raw backup. The integration suite performs an isolated
dump/restore of synthetic data and proves later erasures and withdrawals replay.
Cloud PITR recovery time remains an external measured gate.

For local PostgreSQL base-image changes, compare stored/actual collation versions.
Rebuild affected indexes before `ALTER DATABASE ... REFRESH COLLATION VERSION`;
refreshing metadata alone is insufficient. Keep production engine/extension/OS
changes in a reviewed migration and isolated restore procedure.
