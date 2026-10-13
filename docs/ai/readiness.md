# AI delivery and launch readiness

The full AI software is installed on `bulk/everything`. This installation remains
a local simulation. Authorized synthetic verification has exercised Vikey chat
and Gemini embeddings; no resident data was sent for those checks. Filling a model/key placeholder
does not close production launch gates.

Local results are recorded in the [verification report](../qa/ai-delivery.md).
The real-provider smoke results are in [Vikey/Gemini verification](../qa/gemini-provider-verification.md).

| Capability               | Delivered behavior                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Triage and duplicates    | Bounded, validated suggestions; spatial duplicate evidence remains available through inference outage; human decisions stay separate                                                 |
| Regional briefings       | Full authorized SQL counts, bounded clearly labelled report samples, source versions and private drafts                                                                              |
| Knowledge                | Independently approved published plans and licensed plaintext references; scoped RLS; lexical/pgvector hybrid retrieval; complete-version vector promotion; expiry/withdrawal checks |
| Draft assistance         | Clarification, public-summary, plan and training drafts with exact source quotations; no automatic publication or dispatch                                                           |
| Translation and coverage | Original/translation side by side, numeric preservation and qualified production review; explanations grounded in PostGIS counts                                                     |
| Execution                | Durable runs, attempts, checkpoints and provenance; fenced renewable leases; bounded retries, idempotency, cancellation and in-flight erasure/revocation protection                  |
| Governance               | Immutable originals, append-only decisions, kill controls, independent operator/approver roles, evaluated manifest registration and two matching approvals                           |
| Cost and privacy         | Funded conservative admission, persistent ledger, reported/estimated usage, separate embedding accounting, redaction/quarantine and privacy restore replay                           |
| Production setup         | Separate environment, secure sessions/MFA, least-privilege service role, migration/onboarding tools, AWS/Compose templates and private metrics/alerts                                |

Local verification uses deterministic and loopback provider fixtures, PostgreSQL
16 with PostGIS/pgvector, real browser workflows and an isolated dump/restore.
The test suite covers private/scoped access, retries, budgets, source lifecycle,
immutable reviews, embedding replay/promotion, cancellation, erasure during
inference, actor revocation, MFA reuse, and restoration of later erasures. Browser
checks cover keyboard, WCAG AA scans, responsive interfaces and evidence/review
flows. Terraform validation establishes configuration validity only.

The short local load smoke is diagnostic. It does not establish the declared
20-region, 200-user, 15-minute burst or live-model latency targets. Repeated local
tests preserve real abuse limits; a single-IP load generator must report any
throttling, not bypass it. Production load evidence needs the approved traffic
and identity profile.

| External gate         | Evidence required before launch                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Provider and model    | Real exact model IDs, credentials, JSON/embedding support, processing/retention agreement, quotas, upper-bound prices and funded budget                                                          |
| Quality               | Two candidate artifacts on the same held-out reviewed dataset, at least 1,000 cases including 200 adversarial cases, independent human grounding/translation review and all specified thresholds |
| Security and data     | Independent security review, approved real plans/reference licenses, named data owners, privileged account/enrollment handover and secret rotation procedure                                     |
| Hosting               | Reviewed immutable images, private hosting accounts/network, TLS domains, managed database and secrets, private collector and alert routing                                                      |
| Operations            | Named on-call/product/data/security owners, verified alert delivery, controlled canary and evaluated rollback target                                                                             |
| Capacity and recovery | Declared-load/fault results, supplier quota/outage drill, cloud PITR and independent privacy-ledger replay demonstrating the 5-minute RPO/60-minute RTO targets                                  |

Production execution is blocked by missing configuration, simulation data,
privileged database roles, unverified MFA sessions, missing evaluation evidence,
insufficient release approvals, revoked access, withdrawn sources, kill controls
or exhausted funded admission. These controls complement independent review;
they do not prove model accuracy, complete personal-data detection or real-world
route safety. No claim of production availability or delivery-ready operation is
made until the external evidence is recorded.
