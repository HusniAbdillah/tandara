# Operating the simulation

## Startup and health

Follow root README. `.env` configures local secrets; Compose has private PostGIS,
a migration/seed one-shot, non-root API and worker, and Caddy serving two origins.
`docker compose up --build -d --wait` must finish with API, worker, database and
web healthy. Migration exit zero is expected. `docker compose ps -a` and
`docker compose logs --tail 100 api worker web` expose real runtime state.

`/health` is process liveness; `/ready` checks PostgreSQL. Redis is not required.
Admin → Operasional shows DB connectivity, heartbeat age, actual triage mode,
outbox attempts/failure and erasure requests. A stale worker heartbeat does not
become a green healthy indicator. Jobs have four attempts and exponential delay;
manual retry is restricted to failed jobs. Multiple worker instances claim jobs
with SQL leases; capacity/load testing beyond the local dataset is not claimed.

## Environment reference

| Variable                          | Meaning                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `DATABASE_URL`                    | Server connection, private network; local dev URL differs from Compose         |
| `POSTGRES_USER/PASSWORD/DB`       | Compose database creation; password changes require actual DB rotation         |
| `DEMO_PASSWORD`                   | Initial simulation seed password; >=12 chars; does not reset existing accounts |
| `APP_MODE`                        | Only `simulation` supported by this delivery                                   |
| `WORKER_ENABLED`                  | Strict true/false; true runs actual consumers                                  |
| `AI_MODE`                         | disabled, heuristic or compatible                                              |
| `AI_BASE_URL/AI_MODEL/AI_API_KEY` | Approved server-only compatible inference configuration                        |
| `ALLOW_LIVE_SOURCES`              | Strict false by default; also needs per-source permission                      |
| `SESSION_SECURE`                  | False only for loopback HTTP; true with public TLS                             |
| `WEB_ORIGINS`                     | Exact comma-separated trusted write origins                                    |
| `TRUST_PROXY`                     | True only behind controlled Caddy; direct API/dev defaults false               |
| `API_HOST/PORT/LOG_LEVEL`         | Listener and logging settings                                                  |

Host-level production deployment is deliberately separate from the local example.
Use a verified domain, automatic TLS or an approved ingress, restricted exposed
ports, unique secrets, backup encryption and reviewed permissions. Do not set a
wildcard Origin or expose demo accounts. The root Dockerfile builds browser assets
without importing server secrets. Caddy policy does not permit unapproved remote
tile/model connections from browsers. The permitted exception is the Posko
OpenStreetMap basemap host. Its runtime `basemap.json` is mounted read-only from
`apps/coordinator-web/public/basemap.json`: edit that file to disable/change
the provider and reload the map. A new external host also requires an exact CSP
allowlist update and reviewed provider attribution/terms. [Map notes](../features/map.md)
describe privacy, failure fallback and public tile-service capacity.

## Backup and restoration

PowerShell 7 (`pwsh`) scripts avoid terminal redirection of binary backups:

```powershell
pwsh -NoProfile -File tooling/backup.ps1
pwsh -NoProfile -File tooling/verify-restore.ps1 -BackupPath .local/backups/<file>.dump
```

The dump is written inside Postgres and copied to `.local/backups`; a SHA256 is
printed. Verification creates **tandara_restore_verification**, refuses if it
already exists, and restores there with `--exit-on-error`. It never drops or
overwrites the main database. It prints region/report/plan/audit counts and
extensions. Use a fresh isolated verification container for repeat drills. Treat
backup files as private: encrypt them, restrict access and expire on a reviewed
schedule. The simulation drill restored 2 regions, 6 reports, 4 plans and 27 audit
records plus PostGIS/citext/pg_trgm; source data continued operating.

A real restore requires comparing counts, checking representative geography,
sessions/revocation and report visibility, and reapplying erasures made after the
backup. Restore to a separate database first; coordinate cutover and downtime.
No disaster recovery RPO/RTO is claimed from a local drill.

## Failure and incident response

1. Check readiness and container logs, then DB connectivity and disk space.
2. For stale worker status, inspect process health, attempts and database leases;
   restart the worker after resolving the cause. Abandoned leases recover after
   two minutes; exact report retry remains idempotent.
3. For source outages, inspect each source's last attempt/success/error, disable
   the affected source if needed, and retain honest stale timestamps. Never replace
   a failed source with invented current information.
4. For inference failure, use human review or disabled mode. Check schema/provider
   configuration before regeneration. Do not turn model output into verification.
5. For suspected exposure, suspend affected accounts/revoke sessions, isolate the
   service, preserve minimal audit evidence, rotate secrets and involve the data
   owner. Evaluate backup copies and cached browser data in the scope assessment.
6. Residents can request report erasure with their receipt. Administrators complete
   it in Operasional; audit records remain without raw text. Daily retention also
   erases expired reports in bounded batches and expires sessions/contact details.

## Release and rollback

Run format, lint/type/unit/build, real DB tests, browser/offline/accessibility and
OpenAPI generation before a release. CI executes these on `bulk/everything` and
pull requests. Back up first, inspect migrations and retain the previous image.
Migration 002 deliberately has no automatic destructive rollback. Roll back the
application image only when schema-compatible; otherwise restore a verified backup
to a separate DB and coordinate cutover. `docker compose down -v` destroys local
database storage; it is not a normal stop command.
