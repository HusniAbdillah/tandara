# Rebase and final regression verification

Executed on 2026-10-13, Asia/Jakarta, Windows, Node 24.20.0, pnpm 10.26.2
and Docker Desktop Linux containers. This records local executed results.

## History and preservation

- Original branch HEAD: `b3e413b78786c5661ef729b5981403dc4dc9d839`.
- Rebased `bulk/everything` onto `origin/main` at
  `20b006fb9ca361ac1d585f6d3d68e366f6167e32`.
- All 27 conflicted paths used the original implementation branch's final
  content, including its intentional deletions. Git's rebase ours/theirs naming
  was not used to accidentally select main's implementation.
- Non-conflicting main additions are retained, including readiness validation,
  Dependabot, tooling type configuration and three foundational browser tests.
- Original coordinator/resident feature code, backend product modules, domain
  contracts, migrations, API client and UI were compared to the recovery branch
  and remain unchanged by the rebase.
- Local recovery branch: `codex/backup-bulk-before-main-rebase-20261013`.
- Local `main` remains `221617e29fc8da1167a8fc7ff237ca26085765c2`; no push to main.
- Delivery push uses an explicit force-with-lease against the original remote
  branch SHA, so an unexpected concurrent remote update cannot be overwritten.

## Executed checks

| Check                                           | Result                                                                            |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                | Pass; lockfile unchanged                                                          |
| `pnpm format:check`                             | Pass                                                                              |
| `pnpm check`                                    | Lint, package boundaries, type checks, unit/HTTP and nine builds pass             |
| Tooling/browser-test TypeScript configuration   | Pass; included in root typecheck and CI                                           |
| Unit/HTTP tests                                 | 23 pass                                                                           |
| Migrations and simulation seed, each twice      | Pass; repeatable, existing records preserved                                      |
| `pnpm test:integration`                         | 23 pass against actual PostGIS and API                                            |
| `pnpm api:openapi` and generated-file diff      | Pass; generated specification unchanged                                           |
| `docker compose up --build -d --wait`           | Pass; database, API, worker and web healthy; migration exits 0                    |
| `pnpm test:e2e`                                 | 11 pass in 45.7 seconds                                                           |
| Live street map in existing visible browser     | Roads/place labels verified; [screenshot](screenshots/posko-map-after-rebase.png) |
| `pnpm audit --prod --json`                      | Zero known advisories; 189 production dependencies                                |
| Local performance, 500 samples / five endpoints | p95 17–29 ms; below seed-dataset 500 ms budget                                    |
| Fresh binary backup and isolated restoration    | Pass; 2 regions, 25 reports, 12 plans, 249 audit events                           |
| Required restored database extensions           | PostGIS, citext and pg_trgm present                                               |

The new backup was restored with the existing verification script in a newly
created, private `tandara-rebase-restore-check` Compose project. The script's
guarded verification database was separate from primary data. After successful
verification, only that temporary project's container/network/volume were
removed. The primary stack remains healthy and the local backup is retained
under ignored `.local/backups`.

## Integration corrections

Main's three browser tests originally targeted retired placeholder headings and
development ports. Their intent is preserved against the actual Docker product:
resident shell reloads offline without cached API responses; unauthenticated
Posko has no worker or private report access; mobile keyboard navigation works.
The original eight product/map journeys remain present and pass.

One database duplicate test depended on initial seed observations remaining
inside the one-hour evidence window. After several hours it failed correctly.
The test now creates a fresh nearby report pair through the real API and asserts
the specific candidate ID. No duplicate-window rule or production behavior was
weakened. The complete 23-test suite then passed.

Historical PRD/TDD/foundation validation documents identify current architecture,
delivery and QA sources. Remote CI is configured but its success is not inferred
from local execution. These results validate the synthetic local deployment;
they are not proof of production availability or independent field assurance.
