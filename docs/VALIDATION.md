# Foundation validation

Historical validation from main's foundation stage. Current delivered-product
verification is recorded in [QA validation](qa/validation.md), including the
post-rebase checks. The runtime/path/version statements below describe that
earlier execution and are not the current deployment instructions.

Date: 2026-10-13 (Asia/Bangkok). Workspace: D:/Hackathon/Tandara.
Environment actually tested: Windows, Node 22.13.1, pnpm 10.26.2, Docker Desktop Linux engine.
Recommended/CI runtime: Node 22.23.3, pinned in .node-version.

| Check                                       | Result                                                                           |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| Frozen/offline dependency install           | Passed; lockfile up to date                                                      |
| ESLint + architecture dependency boundaries | Passed for nine workspace packages                                               |
| TypeScript checks                           | Passed for nine packages and Playwright/tooling configuration                    |
| Unit/HTTP tests                             | 14 passed: report schema, API client, environment, Fastify HTTP                  |
| Production builds                           | All nine packages/apps passed; Warga service worker generated                    |
| PostGIS migrations                          | First run succeeded; second run performed no duplicate migration                 |
| Real PostgreSQL integration                 | 1 test passed; PostGIS, pg_trgm, citext and migration history verified           |
| Browser tests                               | 3 passed: Warga offline reload/no API cache, Posko no SW, mobile keyboard/layout |
| Visual inspection                           | Warga 360px and Posko desktop screenshots inspected                              |
| pnpm dev smoke                              | API, Warga, Posko and idle standalone worker started; test processes stopped     |
| Redis                                       | 7.4.11-alpine healthy; AOF and noeviction configured                             |
| Runtime dependency advisory audit           | No known vulnerabilities reported by pnpm audit --prod                           |
| Formatting / whitespace                     | Prettier and git diff --check passed                                             |

## Corrections found during verification

- Aligned direct Fastify version with Nest's dependency to eliminate incompatible plugin types.
- Used Kysely's current migration entry point and file URL imports for Windows ESM paths.
- Updated React Router to 7.18.4 after runtime advisories were found.
- Used browser connectivity state separately from query errors to label offline reload correctly.
- Kept PWA update activation user-controlled so updates do not force-reload drafts.

## Reproduce

Copy .env.example to .env if no local .env exists, then run:

```text
pnpm install --frozen-lockfile
pnpm infra:up
pnpm check
pnpm db:migrate
pnpm db:migrate
pnpm test:integration
pnpm exec playwright install chromium
pnpm test:e2e
pnpm api:openapi
pnpm format:check
```

The GitHub Actions workflow is configured but was not executed on GitHub in this
session. Production routing/deployment, authentication/RBAC, report persistence,
plan saving, offline report sync, outbox/consumers, live AI, and media are not
implemented or validated by this foundation. No pilot readiness claim is made.
