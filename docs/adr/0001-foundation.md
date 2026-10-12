# ADR-0001: Shared server modules in a small TypeScript monorepo

Date: 2026-10-13. Status: accepted for foundation.

## Context

Three developers have three days for a simulation MVP. Two UIs need shared API
contracts; API and jobs need shared server policies without cross-app imports.
The original package list mixed runtime config, security, repositories, and generic utils.

## Decision

Use pnpm 10 workspaces and Turborepo. Four apps: resident-web, coordinator-web,
api, worker. Five runtime packages: contracts, api-client, backend, database, ui.
Use ESM with compiled package exports and strict TypeScript. Nest compiles with
legacy decorators and metadata; no source aliases across workspace boundaries.
Use TypeScript 5.9.3 because the selected typescript-eslint supports versions below 6.1.
The baseline supports Node 22.13.1+ within Node 22; production must use a supported,
patched runtime. Dependency versions and the lockfile are committed.

Frontend routes use React Router and queries use TanStack Query. Dexie owns future
offline records. Warga service worker caches public shell assets only. Posko has
no service worker. API uses Nest/Fastify with shared backend services; worker uses
a standalone application context and no HTTP listener. Worker consumers remain disabled.

Database package owns the pool, schema types, and migrations. Business repositories
belong to backend feature modules. Migrations use Kysely's migration locking and
run from a dedicated command, never concurrently from application startup.
API readiness depends on PostgreSQL; Redis failure must not block future report
creation after an outbox transaction is available.

Future browser sessions use opaque server-side cookies, rather than adding JWT
access/refresh complexity. Production mutation endpoints require CSRF controls.
Media is deferred; no MinIO dependency or running storage service is introduced.

## Consequences and limits

Shared packages must build before apps run. `pnpm dev` builds then watches them;
root tooling prevents forbidden imports. Small PRs use explicit package ownership.
Auth, report workflows, outbox/consumers, AI, and offline report synchronization
still require implementation and tests. Foundation does not establish pilot readiness.

## References

- https://pnpm.io/workspaces
- https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository
- https://docs.nestjs.com/standalone-applications
- https://developer.chrome.com/docs/workbox/modules/workbox-strategies
- https://github.com/minio/minio (community repository archived; storage choice needs review)
