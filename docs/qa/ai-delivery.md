# Full AI software verification — 13 October 2026

Verified locally on `bulk/everything`, with Node 24.20.0, pnpm 10.26.2,
PostgreSQL 16, PostGIS and pgvector. The running Warga/Posko stack remains a
clearly labelled simulation. Provider integration tests use loopback HTTP fixtures;
no resident data or paid inference was sent to Vikey or DeepSeek.

| Check                                               | Observed result                                                                                                                                                                                                                  |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formatting, lint, boundaries, TypeScript and builds | Passed                                                                                                                                                                                                                           |
| Unit, API and tooling tests                         | 69 passed: backend 55, contracts 3, API client 3, API 5, tooling 3                                                                                                                                                               |
| PostgreSQL integration tests                        | 45 passed, including all assistance tasks, real RLS, retries/accounting, in-flight cancellation/erasure/revocation, kill controls, concurrent erasure/finalization, MFA counter reuse, source withdrawal and embedding promotion |
| Isolated restore                                    | Actual dump/restore into temporary drill databases; replayed later erasures and withdrawals before serving; passed                                                                                                               |
| Browser workflows                                   | 13 passed, including reviewed AI briefing, approved-source search, keyboard, responsive checks and WCAG AA scans                                                                                                                 |
| Docker                                              | App, worker, custom PostgreSQL and web built; running API, worker, PostgreSQL and web healthy                                                                                                                                    |
| Production web                                      | Production target built; Caddy configuration validation passed                                                                                                                                                                   |
| AWS configuration                                   | Terraform 1.13.5 formatting and validation passed; no account apply or cloud deployment                                                                                                                                          |
| Dependency advisory audit                           | Production audit reported zero known advisories across 305 dependencies at verification time                                                                                                                                     |
| Secrets                                             | No configured inference/MFA secret values or recognizable private keys found in repository files or browser bundles                                                                                                              |
| Short load diagnostic                               | Five seconds, 200 configured virtual users, two simulation regions: 10 reports, 5 AI requests and 198 public reads all returned 2xx; no throttling or paid inference                                                             |

The reviewed AI and resident search screenshots were inspected visually. The
browser test follows the submitted AI run by its ID, so existing history cannot
redirect its review assertion. A transient Windows screenshot-file write failure
was followed by a complete clean 13-test browser run. All persisted test content
is fictional and remains labelled simulation.

The load diagnostic recorded report p95 257 ms, AI request-admission p95 633 ms
and public-read p95 696 ms while sharing local resources with build activity. AI
admission latency is not model completion latency. These numbers do not establish
production SLOs or the declared 20-region, 15-minute traffic profile. The harness
keeps actual abuse limits and rejects billable generation/embedding configurations.

Reproduce with the README commands against isolated simulation data. Integration
checks mutate synthetic records and create/drop only explicitly bounded temporary
restore databases. Production tools require separate private configuration; model
and credential placeholders remain in both environment examples.

Real-provider evaluation on the reviewed 1,000-case held-out dataset, independent
security/translation review, provider/data agreements, target-account TLS/secrets,
alert delivery, canary/rollback, on-call ownership, declared capacity/fault tests
and cloud PITR/privacy-ledger RPO/RTO evidence remain external launch gates. See
[readiness](../ai/readiness.md), [operations](../ai/operations.md),
[evaluation](../ai/evaluation.md) and [threat model](../ai/threat-model.md).

Later native Gemini support and authorized synthetic provider checks are recorded
in [Vikey/Gemini verification](gemini-provider-verification.md).
