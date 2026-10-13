# AI branch rebase onto main — 13 October 2026

Executed locally on Windows with Node 24.20.0, pnpm 10.26.2 and Docker Desktop.

## History and preservation

- Latest fetched main: `21e0ae4b8e1347da8186ca2fb7c1ef7b05783dd6`.
- Main's squash `11bd325` has an identical file tree to this branch's earlier
  `ea26d47`. Rebase therefore replayed only the four later commits: provider
  connection, governed AI workflows, Gemini embeddings and the demo script.
- The previously uncommitted demo documentation was saved before rebasing.
- Recovery branch: `codex/backup-bulk-before-main-rebase-20261013-ai`, pointing
  to `13e1bce66288e2117977e7bb3a1c87fc8f08139b`.
- Conflicts in `package.json` and `.github/workflows/ci.yml` were resolved by
  retaining main's sequential unit tests, deployment checks and opt-in browser
  policy, while retaining AI tooling checks and sequential shared-DB integration.
- Backend, contracts, database code and both frontend feature directories match
  the recovery branch. Main's bodyless API action fix and deployment additions
  are retained. Local `main` was not modified.

## Integration corrections

Main's deployment database image had no pgvector, which the AI migrations
require. The release now builds a database image from the same PostgreSQL 16 /
PostGIS 3.5 base, installs pgvector 0.8.7 and transfers both app/database images
in one private release archive. Both tags use the release SHA. Database volume
names and the PostgreSQL major version are preserved.

The legacy base's PGDG/security package repositories returned HTTP 404. The build
uses the official signed archives, preserving package signature verification.
See the [PostgreSQL archive announcement](https://www.postgresql.org/message-id/ar5tx9q20-2CWfM3%40msg.df7cb.de),
[PGDG archive instructions](https://apt-archive.postgresql.org/) and
[Debian security archive](https://archive.debian.org/debian-security/dists/bullseye-security/Release).

The pruned deployment worker health check now checks recent heartbeat entries
for its own hostname, matching the governed worker's per-process identities.
The previous `primary` heartbeat check would reject the new worker.

The product integration suite originally inherited the operator's live provider
configuration, causing its deterministic-provider assertion to fail. Its setup
now explicitly selects heuristic generation and disabled embeddings; tests that
need inference opt into loopback fixtures. The complete repeat run passed.

## Executed checks

| Check                                       | Result                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Frozen dependency install                   | Passed; main's injected workspace packaging retained                                             |
| Formatting, lint, boundaries and TypeScript | Passed                                                                                           |
| Unit/API/tooling tests                      | 97 passed: backend 82, contracts 3, API client 4, API 5, tooling 3                               |
| PostgreSQL integration                      | 46 passed, including native Gemini fixtures and isolated privacy restore                         |
| Browser workflows                           | 13 passed, including offline, auth, map layers, accessibility and reviewed AI                    |
| Deployment routing/package tests            | 3 passed                                                                                         |
| Portable image identity tests               | 8 passed                                                                                         |
| Deployment shell scripts                    | Bash syntax and ShellCheck passed                                                                |
| OpenAPI regeneration                        | Passed; checked-in specification unchanged                                                       |
| Local Docker builds                         | App, worker, web and database passed                                                             |
| Pruned deployment images                    | Backend and PG16/PostGIS/pgvector images built successfully                                      |
| Deployment smoke test                       | Fresh isolated migrations/seed, API session/CSRF, worker heartbeat and backup/restore passed     |
| Combined release archive                    | Both app/database tags resolved to their expected image config digests                           |
| Secrets                                     | No configured AI/MFA secrets or recognizable private keys in repository files or browser bundles |

Browser tests temporarily used heuristic generation and disabled embeddings.
Afterward the local stack was restored to compatible Vikey chat and Gemini
embeddings. The isolated deployment smoke containers, network and volume were
removed by the guarded smoke script; primary simulation data was preserved.

No cloud release or production activation was performed. Remote GitHub CI results
are separate from these executed local checks. The deployment demo retains its
configured heuristic AI mode; changing live providers there requires its own
operator configuration and release approvals.
