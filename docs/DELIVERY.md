# Tandara / ArahSiaga delivery

## Executive summary

Integrated local simulation of resident preparedness and community coordination:
two responsive web applications, one scoped API, PostGIS persistence and an actual
durable worker. Reporting, human review, plan publication, privacy, source failures,
offline reopening/synchronization and training are exercised end to end. This is
a runnable simulation, not a claim of an operational emergency service.

## Repository information

- Repository: [HusniAbdillah/tandara](https://github.com/HusniAbdillah/tandara).
- Implementation branch: `bulk/everything`; delivery revision is its HEAD (`git rev-parse HEAD`).
- Initial audit was committed/pushed as `87614d0` before implementation.
- Local `main` remained `221617e29fc8da1167a8fc7ff237ca26085765c2`; initial remote
  `main` was `575d10bf5e9bced35a0667c02da6f8a6e799a540`. It advanced independently
  to `20b006fb9ca361ac1d585f6d3d68e366f6167e32` during implementation. This work
  neither checked out nor merged/pushed to main.
- No pull request was created; compare the implementation branch to main for review.
  The final chat records the exact pushed delivery SHA.

## Implemented capabilities

Warga supports manual regions, attributed information, current plans, checklist,
consented observation reports, optional GPS/private processed photos, receipt
tracking, erasure requests, saved offline plans and text drafts, and simulation
learning. Posko supports scoped search/pagination, original evidence, uncertainty,
human triage/review, reversible duplicate decisions, assistance progress, clustered
map/coverage, versioned independent plan approval/publication, training aggregates,
source health and audit. Admin manages organizations, accounts/permissions,
regional configuration, source permissions, jobs and governance. In-app updates
respect preferences and never send external emergency messages.

AI classification/facts/missing information are provisional. The working fallback
is explicitly deterministic, with quoted evidence; compatible inference is a
server-only adapter awaiting an approved model. Group summaries expose their
bounded report sample. Coverage gaps mean insufficient information, not safety.

## Architecture

React/Vite, React Query and browser-safe Zod/client/UI packages; NestJS/Fastify API;
standalone Nest worker; Kysely/PostgreSQL 16/PostGIS; durable SQL outbox rather than
an unnecessary Redis-dependent consumer. Dexie/Workbox provide explicit resident
offline persistence. Caddy serves two same-origin API frontends. Existing pnpm/Turbo
package boundaries remain enforced. [Architecture](ARCHITECTURE.md) explains
transactions, leases, constraints, spatial precision and source separation.

## UI/UX

Original wave-line branding, deep teal and warm neutrals, restrained uncertainty,
labelled forms and separate source/review evidence. Mobile Warga has five bottom
navigation items; Posko adapts its sidebar and contains wide tables. Plan location
and access editing uses ordinary fields. Keyboard skip/focus, visible status,
larger text, reduced motion and print metadata are provided. Six Warga widths and
four Posko widths were checked, with route-level WCAG A/AA scans. Representative
screens are in [screenshots](qa/screenshots), including home, report detail, map,
plans, assistance, training, sources, audit and administration. Automated checks
do not substitute for resident usability or screen-reader trials.

## Testing

Executed locally: `pnpm format:check`, `pnpm check` (lint, boundary check, typecheck,
unit/HTTP tests and all nine builds), `pnpm test:integration`, `pnpm test:e2e`,
`pnpm api:openapi`, `pnpm audit --prod`, full Docker build/start and backup restore.
The evidence summary is in [validation](qa/validation.md).

The suites contain **23 unit/HTTP tests, 23 actual DB/API integration tests and
8 Chromium journeys**. They exercise cross-region/role denials, CSRF/hostile
origins, concurrent retries, human-only decisions, upload metadata privacy, source
outages, plan independence/immutability, private training feedback, notifications,
retention and actual disconnected browsing. Final rendering waits for real map
layer readiness rather than accepting a blank canvas.

Issues found and fixed include Caddy parsing, missing test dependency, private-photo
error response ordering, stale fallback disclosure, failed-submit duplication,
first-visit worker control, small-text contrast, bundled MapLibre workers and the
older router's dependency advisories. React Router is pinned to 8.4.0; production
audit reports zero known advisories at validation time. The maintainer's
[security advisories](https://github.com/remix-run/react-router/security/advisories)
were consulted; audit success is not a vulnerability-free guarantee.

Five endpoints were measured with 100 samples each and concurrency five. Initial
local p95 was 16–31 ms, below the 500 ms seed-dataset budget. See actual
[performance JSON](qa/performance.json); this does not establish production
capacity. Spatial, recent-report, notification and retention indexes are migrated.

## How to run

Docker Desktop/Linux containers, ports 8080/8081 free:

```powershell
Copy-Item .env.example .env # only when absent
# Choose POSTGRES_PASSWORD and DEMO_PASSWORD (>=12 chars) in .env.
docker compose up --build -d --wait
```

Warga: [127.0.0.1:8080](http://127.0.0.1:8080).
Posko: [127.0.0.1:8081](http://127.0.0.1:8081).
Use `ciliwung@demo.tandara.test`, `semarang@demo.tandara.test`, or
`admin@demo.tandara.test` with your configured seed password. Seed is idempotent
and does not reset existing passwords. Root [README](../README.md) has development
and exact validation commands; [runbook](operations/runbook.md) covers operations.

## Demonstration

The [walkthrough](product/demo.md) connects citizen observation → receipt →
provisional triage → reversible duplicates → human review → private assistance →
coverage gaps → independently reviewed plan publication → saved offline plan and
draft reconnection → training feedback → source failure/admin/audit/erasure.
All data and ownership are visibly simulation; no real personal data is needed.

## External dependencies

BMKG and PetaBencana network adapters use real documented public endpoints; a
read-only probe normalized 18 weather records and an empty crowd report collection.
The probe did not activate or store live data in the fictional demo, and an empty
feed does not validate every possible non-empty payload. [Probe evidence](qa/public-source-probe.json)
and [adapter notes](integrations/adapters.md) disclose the boundary. Fixture
ingestion remains simulation. Live source activation, real regional identifiers,
terms/attribution/capacity and operator permission are external launch gates.
InaRISK is reference-only. No approved inference provider/key was supplied.
Posko has an attributed OpenStreetMap street basemap with runtime provider
configuration and a local-layer fallback on tile failure. No offline tile bulk
download is supplied. Public tile service capacity remains an operational gate.

## Security and operational readiness

Verified controls include hashed revocable sessions, salted passwords, strict
inputs, scoped relationships, CSRF/origin checks, abuse limits, no public private
reports/media, metadata-free uploads, immutable audit events, erasure/retention,
bounded adapters/jobs, honest health and structured request IDs/logging. The
database is private and containers use actual health checks. A binary backup
restored successfully into a separate guarded database with required extensions
and expected data; primary data was not overwritten. See [security model](security/model.md).

## Known limitations

Local HTTP cookies require Secure/TLS for public hosting. Public deployment needs
unique secrets, volume/backup encryption and accountable operations. Inference is
not live without approved configuration. No official emergency dispatch, safe
route guarantee or hazard prediction is supplied. Coverage is four explained
quadrants and the map displays the latest 20 reports; this is not a complete
hazard model. The street basemap requires internet and is not a safe-route service. Sensitive in-memory
submissions can lose receipt recovery if the page closes before acknowledgement.
Daily retention handles 200 expired reports per run; larger volumes require
operator sizing. Audit/backup retention needs owner governance. No MFA/SSO,
independent penetration test, field-user certification or production load SLO is
claimed. Remote CI success is not inferred from local results.

## Completion matrix

[Requirement-by-requirement matrix](product/requirements-matrix.md) maps each
implemented area to evidence and separates external activation gates.

## Recommended next steps

Remaining launch work requires genuine community owners and contacts, operational/legal
approval of sources/model handling, public hosting credentials/domain, real-user
accessibility trials, and independent security/capacity assessment. Do not treat
the simulation fixtures or reviewed example plans as approved operational guidance.
