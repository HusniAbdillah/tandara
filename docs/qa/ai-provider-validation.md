# AI provider integration validation

Validated locally on 2026-10-13. This change implements the Vikey/DeepSeek report
triage connection and environment configuration. The broader production AI plan
remains a proposed delivery specification; this is not a public production launch.

## Verified results

| Check                                      | Result                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| `pnpm check`                               | Lint, workspace boundaries, types, 53 unit/HTTP tests and 9 package builds pass  |
| `pnpm test:integration`                    | 24 real PostgreSQL/API tests pass; final run approximately 6 seconds             |
| `pnpm test:e2e`                            | 11 browser tests pass in 53.2 seconds against the rebuilt stack                  |
| `pnpm format:check` and `git diff --check` | Pass                                                                             |
| `pnpm api:openapi`                         | Pass; generated API contract unchanged                                           |
| `docker compose up --build -d --wait`      | Pass; API, worker, web and PostgreSQL healthy; migration/seed exits successfully |
| Synthetic `ai:verify` CLI                  | Exactly one local mock request, validated result, no credential printed          |
| Placeholder CLI                            | Rejects model/key placeholders locally before any inference request              |

The backend's 42 tests include named-provider endpoint selection, actual-format
Vikey/DeepSeek requests, output limits, disabled DeepSeek thinking, required JSON
instructions, refusal/truncation/empty/schema rejection, credential/endpoint
validation, transient versus permanent failures, and timeout sanitization.

The database/API provider workflow uses a local HTTP server rather than a paid
service. It proves that a report becomes an outbox job; a rate-limited attempt is
rescheduled without a premature suggestion; recovery stores one validated result;
private dedicated contacts and receipt secrets are excluded; completed replay
does not make another provider call; authentication rejection fails immediately;
an audited admin retry retains failure history; exhaustion stops at four attempts;
and duplicate hints still work when AI is disabled.

The final backend change also rechecks erasure before dispatch and cancels oversized
provider response bodies. Types, backend tests, database/API integration and Docker
build/health were rerun after that change. Browser assets and UI behavior did not
change; the preceding full browser regression result is recorded above.

## Configuration and limits

Model/key placeholders exist in `.env.example` and the ignored local `.env`.
Existing local environment settings were preserved. Runtime verification confirms
heuristic mode with the Vikey profile and unfilled model/key placeholders. `.env`
and temporary logs/fixtures are ignored by Git.

No paid provider requests were made and no real credentials were supplied. Actual
Vikey/DeepSeek account access, selected-model quality, quotas, billing, and data
handling must be verified once configured. The live-model operator command is
documented in [provider setup](../ai/provider-setup.md).
