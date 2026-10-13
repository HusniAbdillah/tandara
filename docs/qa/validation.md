# Executed validation

Validated locally on 2026-10-13 (Asia/Jakarta), Windows, Node 24.20.0,
pnpm 10.26.2 and Docker Desktop Linux containers. Data is synthetic. Results
below describe executed checks, not inferred remote CI or production readiness.

| Check                                  | Executed command / evidence                                                                      | Result                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Formatting                             | `npx --yes pnpm@10.26.2 format:check`                                                            | Pass                                                                     |
| Boundaries, lint, types, tests, builds | `npx --yes pnpm@10.26.2 check`                                                                   | Pass; nine package builds                                                |
| Unit and HTTP                          | Included in `check`                                                                              | 23 pass: contracts 3, client 3, backend 12, API 5                        |
| Database and API integration           | `npx --yes pnpm@10.26.2 test:integration`                                                        | 23 pass, actual PostGIS/database and API                                 |
| Browser journeys                       | `npx --yes pnpm@10.26.2 test:e2e` against final Docker images                                    | 8 pass; final run 46.6 seconds                                           |
| OpenAPI generation                     | `npx --yes pnpm@10.26.2 api:openapi`                                                             | Pass; [generated document](../api/openapi.json)                          |
| Production dependency audit            | `npx --yes pnpm@10.26.2 audit --prod --json`                                                     | Zero known advisories across 189 production dependencies                 |
| Docker                                 | `docker compose up --build -d --wait`                                                            | Pass; PostGIS, API, worker and web healthy; migration/seed exit 0        |
| Migration and seed repeatability       | Both commands executed repeatedly on development and Compose databases                           | Existing credentials/reviewed data preserved                             |
| Backup/restore                         | `pwsh -NoProfile -File tooling/backup.ps1`, then `tooling/verify-restore.ps1 -BackupPath <dump>` | Binary dump restored into separate guarded verification DB               |
| Performance                            | `node --env-file=.env tooling/measure-performance.mjs`                                           | 500 samples; five endpoints; p95 16–31 ms on seed dataset                |
| Public adapter probe                   | `node tooling/probe-public-sources.mjs`                                                          | BMKG: 18 normalized weather records; PetaBencana: valid empty collection |
| Repository hygiene                     | `git diff --check`, ignore checks and source scan                                                | No whitespace errors; runtime secrets/backups/build output excluded      |

The final eight browser journeys cover:

1. Resident submission → persisted receipt → provisional triage → coordinator
   review → resident status.
2. Explicitly saved plan and checklist survive a disconnected reload; a queued
   text report reconnects with exactly one receipt stored in IndexedDB.
3. Training submission yields stored score and feedback.
4. Seven resident routes, home widths 360/390/768/1024/1440/1920, no horizontal
   overflow, axe WCAG A/AA scans, and keyboard skip-to-content focus.
5. Ten Posko routes, actual map layer readiness, axe scans, inbox widths
   360/768/1440/1920 and no horizontal overflow.
6. One coordinator authors a version; an independent administrator approves
   and publishes it; Warga reads the new version.
7. Street-basemap attribution, origin-only referrer, absence of private request
   headers and a visibility toggle that changes actual canvas pixels.
8. Tile outages and invalid provider configuration preserve local layers and
   disclose an unavailable basemap.

The map follow-up reran `check`, rebuilt/restarted the Docker web image and
visually confirmed live OpenStreetMap roads/place labels in an in-app browser
at one region viewport. [Live street screenshot](screenshots/posko-map-streets.png)
records that view. Automated map tests use intercepted fixture tiles, including
their real CORS behavior, and never sweep the public provider.

Rapid repeated local runs reached the intentional login throttle. The final
rerun reset only the simulation accounts' and local test gateway's hashed login
counters, preserving the application's rate limits. A fresh simulation database
or the normal throttle-expiry window is needed for repeated high-frequency runs.

Database tests also cover role/region denials, CSRF and hostile origins, consent,
concurrent idempotency conflicts, location/time bounds, secret receipt access,
original preservation, AI rejection, duplicate link/dismiss/undo, review revision
conflicts, public/private separation, photo validation and metadata stripping,
coverage geometry, independent immutable plan review, source failure preservation,
training idempotency/private feedback, notification preferences/ownership,
append-only audit, erasure, retention, account configuration and login throttling.

The tested restore contained 2 regions, 6 reports, 4 plan versions and 27 audit
events. PostgreSQL extensions included PostGIS, citext and pg_trgm. Primary data
was not overwritten. The binary dump and local execution logs are ignored runtime
artifacts; the restore verification script remains in the repository.

Visual inspection included desktop/mobile Warga, report and plan forms, Posko
overview, report detail, plan, populated map, mobile inbox and administration.
[Screenshots](screenshots) were captured from the running application. Synthetic
browser runs intentionally add records, so counts/timestamps vary across runs.

See [performance measurements](performance.json), [public probe](public-source-probe.json)
and [dependency audit](dependency-audit.json). Performance uses a small synthetic
dataset and is not a production load/capacity test. An empty external feed does
not exercise all non-empty variants. Automated accessibility scans do not replace
screen-reader and community usability trials. The integration suite mutates only
simulation data and must not target an operational database.

Defects corrected during execution included first-visit service-worker control,
retry duplication, private upload error handling, stale cache disclosure, contrast,
Caddy configuration, MapLibre's missing worker bundle and old router advisories.
Remote CI is configured; its success is not claimed without an observed run.
