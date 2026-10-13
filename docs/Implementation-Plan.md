# Tandara — Three-Day Implementation Plan

Historical foundation schedule. The complete implementation and executed evidence
are now recorded in [DELIVERY.md](DELIVERY.md) and the
[requirements matrix](product/requirements-matrix.md). Source and tests take
precedence over the remaining future-tense tasks in this earlier schedule.

Updated: 2026-10-13. Team: **three developers total**. No separate product/QA member.

## 1. Scope and source of truth

PRD defines the product target. TDD defines the technical plan. ARCHITECTURE.md and
ADR-0001 define the accepted repository structure. Source and tests determine what
actually works. This plan supersedes the former four-person schedule.

The boilerplate provides two web shells, API metadata/health, idle worker,
contracts/client/backend/database/UI packages, PostGIS migrations, local Compose,
and CI. It does **not** implement the full MVP.

## 2. Ownership

| Developer       | Primary scope                                                | Shared responsibilities                       |
| --------------- | ------------------------------------------------------------ | --------------------------------------------- |
| 1 — Warga       | apps/resident-web, offline records/queue, shared UI          | UX/copy, resident demo, accessibility         |
| 2 — Core        | apps/api, database/migrations, auth/policies, backend core   | Integration, local infrastructure, deployment |
| 3 — Posko/Async | apps/coordinator-web, apps/worker, backend triage/duplicates | Test automation, AI provenance, pitch         |

All three perform QA and review. Developer 2 owns migrations, not every backend
file. Developer 3 can add triage operations inside its owned backend module without
editing report repositories. Developer 1 owns UI primitives; Developer 3 requests
shared changes instead of maintaining a second UI library.

Contracts have one owner per change and are reviewed by affected consumers.
Agree request/response schemas and synthetic fixtures before feature development.
Mock HTTP responses must conform to those schemas. There is no dependency on a
finished API to build forms/inbox against fixtures.

## 3. Required MVP slices

| Slice           | Deliverable                                                | Gate                                                               |
| --------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| Foundation      | Reproducible install, four apps, strict build, Compose/CI  | lint, typecheck, tests, builds pass                                |
| Public plan     | One simulation region and immutable plan snapshot          | owner/version/review date/disclaimer; printable                    |
| Resident report | Validated create request and secure receipt                | atomic write/audit/outbox; idempotency replay                      |
| Coordinator     | Seeded login, inbox/detail, review and publication         | server authorization; public projection contains no private fields |
| Offline         | Saved plan, one Dexie queue, visible failure/retry         | refresh offline, lost-response retry, no duplicate record          |
| Async/triage    | Outbox dispatcher, consumer, explicit mock/live provenance | AI unavailable does not block manual review                        |
| Duplicate       | Deterministic candidate and human confirmation             | no auto-close; audited and reversible decision                     |
| Privacy         | Restricted synthetic follow-up                             | unauthorized read denied in API; no persistent private cache       |

Use one seeded region. Display simulation labels; server decides simulation context.
Only synthetic data is permitted in this three-day demo. Mock triage is explicitly
labelled as simulation/rule output, not live AI. Live provider is added only after
the complete flow passes; manual review remains available after provider failure.

Defer uploads/storage, full map/tile downloads, plan editor, registration/reset,
admin console, drill analytics, notifications, external APIs, and WebSockets.
Show duplicate suggestions inside report detail; avoid a separate page until needed.
Do not defer ownership checks, CSRF on mutations, receipt security, or private-data filtering.

## 4. Foundation handoff checklist

- pnpm install --frozen-lockfile reproduces the workspace.
- pnpm lint enforces package boundaries and code rules.
- pnpm typecheck, pnpm test, pnpm build pass.
- pnpm infra:up starts loopback-only PostGIS and Redis.
- pnpm db:migrate works twice without duplicate migrations.
- /health is process health; /ready fails when PostgreSQL is unavailable.
- Worker has no listener and rejects premature consumer enablement.
- Warga shell loads offline after a production build and initial online visit.
- Posko has no persistent API/service-worker cache.
- README explains commands, ports, .env, scope, and team boundaries.

## 5. Before writing business tables

Developer 2 coordinates a short contract/schema review with both consumers:

1. Region/organization foreign keys and normalized membership assignments.
2. Opaque PostgreSQL sessions, expiry/revocation, host-only cookies, CSRF.
3. Public versus coordinator DTOs, including redacted descriptions.
4. Independent reviewState, visibility, closure reason; concurrent review conflicts.
5. Idempotency key scope/fingerprint, receipt replay after a lost response.
6. Immutable plan version content/contacts/locations and version-specific approval.
7. Leased outbox dispatch and idempotent jobs with input revision tracking.

Do not copy the older example SQL unchanged into migrations. Business schema and
feature operations are still design work; foundation migration contains extensions
and app_metadata only. Retain UUID resource IDs, UTC timestamps, and strict schemas.

## 6. Day 1 — Complete the online report path

| Developer | Work                                                                                     |
| --------- | ---------------------------------------------------------------------------------------- |
| 1         | Warga plan/form UI, tokens/copy, contract fixtures; coordinate offline payload model     |
| 2         | Business migrations, seeded coordinator session, report create/receipt, list/detail      |
| 3         | Posko login/inbox/detail against fixtures; worker/job input contracts and triage adapter |

Integrate small slices during the day, not one large branch per developer. First
deploy the foundation early so HTTPS/proxy/env problems are discovered before Day 3.

**Day 1 gate:** resident sends a report, database commits, authorized coordinator
sees it, public user cannot read the private endpoint. Contracts/CI remain green.
If the gate fails, freeze all optional UI/map/live-AI work and fix this flow.

## 7. Day 2 — Review, offline, and async reliability

| Developer | Work                                                                                  |
| --------- | ------------------------------------------------------------------------------------- |
| 1         | Immutable offline plan, checklist, Dexie queue, retry and draft preservation          |
| 2         | Review/publish policy, concurrency/audit, public projection, restricted follow-up     |
| 3         | Leased dispatcher/consumer, mock triage provenance, duplicate candidate and review UI |

Share integration tests: lost acknowledgement/retry, cross-region denial,
restricted fields absent publicly, Redis/provider outage, and malformed AI output.
Do not enqueue synchronously in the resident request if outbox is the agreed design.

**Day 2 gate:** offline saved plan opens after reload; queued report syncs once;
review/publication are authorized and audited; suggestions never change status;
private follow-up remains private. Optional live AI requires a clear failure label.

## 8. Day 3 — Verification and demo

| Developer | Work                                                                     |
| --------- | ------------------------------------------------------------------------ |
| 1         | Mobile/accessibility/error states, resident/offline rehearsal, demo copy |
| 2         | Deployment/migration/health smoke tests, demo reset, local fallback      |
| 3         | Integrated workflow tests, mock/provider failure rehearsal, pitch/video  |

Freeze features at midday; complete fixes and rehearsals afterward. Keep roughly
the final quarter of the available effort for integration, verification, and demo,
not new features. Estimates are planning assumptions, not guaranteed delivery times.

**Release gate:** deployed and local fallback work; no real personal data; no secrets
in bundles; no raw private records publicly; all mandatory flows have evidence.
This gate authorizes a simulation demo, not a public disaster-response pilot.

## 9. Git and collaboration

- main remains green; use short feature branches per slice rather than long-lived personal branches.
- Keep PRs small, with exact validation and implemented behavior.
- Developer 2 reviews schema/auth changes; consumers review contracts.
- Shared files have one active editor; separate feature modules reduce conflicts.
- Integrate at least twice daily; report blockers and adjust scope quickly.
- Run pnpm check before merge; run real database tests for migration changes.
- Reset scripts are simulation-only and must refuse production environments.
- Product, QA, and pitch ownership is shared; no fourth team member is assumed.

## 10. Required evidence

Record commands/results for offline refresh, retry after lost response, cross-region
authorization, public redaction, worker duplicate delivery, AI/provider failure,
migrations twice, HTTPS deployment, and local demo fallback. Document untested
items honestly. A successful scaffold build alone is not evidence of working
report synchronization, human review, live AI, or pilot readiness.
