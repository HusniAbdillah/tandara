# Tandara architecture and repository boundaries

Updated: 2026-10-13. Team: three developers. Stage: implemented foundation.

## Current structure

```text
apps/
  resident-web/src/{app,features,offline}
  coordinator-web/src/{app,features}
  api/src/{http,app.module.ts,bootstrap.ts,main.ts}
  worker/src/{jobs,worker.module.ts,main.ts}
packages/
  contracts/src/       # Public API vocabulary and Zod schemas
  api-client/src/      # Typed browser transport, response validation
  backend/src/
    config/           # Validated server configuration and DI wiring
    platform/         # Database adapter and structured logger
    modules/          # Future server-only feature modules
  database/src/
    migrations/       # One ordered, reviewed migration stream
    client.ts         # Kysely + pg pool and database type
    migrate.ts        # Dedicated CLI; not API/worker startup
  ui/src/             # Shared presentational components and styles
tooling/typescript/   # Shared strict compiler settings
tooling/check-boundaries.mjs
infrastructure/{compose,caddy}
tests/integration/
docs/{adr,api}
```

No generic utils, security, map, AI, or runtime-config package is created without
a demonstrated reuse need. Configuration for build tooling stays in tooling;
server environment parsing stays in backend. UI has no API/session/business-policy dependency.

## Enforced dependency graph

```text
resident-web --------> api-client ------> contracts
             \------> ui
coordinator-web -----> api-client ------> contracts
                \---> ui
api -----------------> backend --------> database
  \-----------------> contracts   \----> contracts
worker --------------> backend
```

Each workspace is a package with a manifest and explicit public exports.
Applications are deployment entry points, never reusable libraries.
Imports across package src directories, cross-app imports, undeclared workspace
dependencies, and server imports in browser packages fail lint/boundary checks.
The allow-list dependency graph is acyclic. Root dev dependencies are shared tooling;
runtime dependencies belong to the package that imports them.

## Business module conventions

Create auth/reports/plans/regions/triage/audit modules under backend/modules only
when implementing their first slice. A module owns its repositories and writes.
Start with service/repository/policy files; introduce domain/application/infrastructure
subdirectories when the module needs them. Do not generate empty layered folders.

API controllers and worker consumers call exported operations. Controllers own
HTTP parsing/authentication; services own authorization, tenant invariants,
transactions, state transitions, and audit writes. A worker has no HTTP guards:
its operations need explicit service permissions and validated job input.

Public request/response schemas live in contracts. Database records and internal
job payloads must not be exported as public DTOs. Never return a raw database row.
Zod strict objects reject unexpected fields, including nested fields. The report
input rejects client-supplied visibility and simulation mode; these are server decisions.

## Runtime behavior provided now

- Warga and Posko boot, show honest foundation status, and query public API metadata.
- API implements /health, /ready, /api/v1/system/info, and /api/v1/system/openapi.json.
- /health is process liveness. /ready requires PostgreSQL; Redis is not an API readiness dependency.
- API has helmet, cookie parsing, generated request IDs, no-store responses, and sanitized errors.
- Worker starts a standalone Nest context without HTTP, with consumers disabled.
- Local Compose provides loopback-only PostgreSQL/PostGIS and Redis AOF/noeviction.
- Kysely migrations provision extensions and app_metadata only, not business tables.
- Warga precaches its public app shell; neither application caches API responses persistently.
- Dexie schema exists; offline saving/report delivery are not implemented.
- OpenAPI describes implemented routes and is generated from their response schemas.

## Decisions required for feature slices

1. Sessions: opaque, revocable server-side sessions in PostgreSQL, HTTP-only secure
   host-only cookies, expiration, logout, CSRF protection, exact trusted origins.
   No refresh-token architecture is necessary for the three-day web MVP.
2. Authorization: organization membership and region assignment checked inside each
   service operation. Normalize region assignments and enforce tenant-compatible relations.
3. Plans: immutable published version snapshots including contacts/locations,
   version-specific review records, and a current published version reference.
4. Reports: reviewState, visibility, and closure reason are separate dimensions;
   define transitions/reopening, optimistic concurrency, and atomic audit records.
5. Idempotency: bind key to submitter/context, compare payload fingerprint, define
   replay and receipt recovery after a committed write with a lost response.
6. Async: persist report/audit/outbox in one PostgreSQL transaction. Dispatcher and
   consumers use leases, retries, and idempotent effects; distinguish queued from processed.
7. Offline: one Dexie queue, multi-tab leases, retryable/non-retryable errors,
   quotas, explicit send consent, and no offline private follow-up contact storage by default.
8. AI: strict schema, unknown fields, source evidence, sanitized input, and explicit
   live/mock provenance. Demo fixtures never masquerade as live AI or verification.
9. Geospatial: index expressions match geometry/geography queries; metric precision
   policy, observation freshness, unknown locations, tenant and simulation filters.
10. Storage: defer media in the MVP. Choose a maintained S3-compatible implementation
    through an adapter before uploads; require private access, processing, and revocation policy.

PRD remains the product target. TDD describes implementation decisions. This file
and ADR-0001 are the accepted foundation structure and supersede legacy folder
examples. Implementation status must be reported from code/tests, not inferred from docs.
