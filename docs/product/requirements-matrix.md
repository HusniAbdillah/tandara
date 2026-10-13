# Completion and verification matrix

Scope: integrated **local simulation**, 2026-10-13. External operational activation
is explicitly separate. Evidence is executed source/tests and artifacts, not the
older PRD/TDD's future-tense schedule.

| Requirement                                      | Implementation                                                                 | Verification / status                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Repository audit and existing-stack preservation | Nine pnpm/Turbo packages; additive product modules                             | Audit committed before implementation; boundary check passes                     |
| Branch-only delivery                             | `bulk/everything`                                                              | Local main remains 221617e; remote main remains 575d10b at audit                 |
| Organizations and scoped users                   | Profiles, memberships, role/region assignments, suspension                     | Real DB admin creation and unauthorized access tests pass                        |
| Sessions and logout                              | Hashed opaque sessions, scrypt, expiry, revocation                             | Password/session/CSRF/origin/abuse tests pass                                    |
| Citizen region and public information            | Manual region selection, source/time detail, stale states                      | Public DTO test and browser/axe route checks pass                                |
| Resident reports and optional location/photo     | Validated consented form, bounds/time/category checks                          | Actual DB and citizen-to-coordinator browser journey pass                        |
| Receipt tracking                                 | Private secret, simplified status/history, erasure state                       | Secret enumeration tests and browser tracking pass                               |
| Immutable originals and human review             | Separate summary/decisions, revision guard, reasons/history                    | Original preservation, stale/invalid transition tests pass                       |
| Duplicate hints and reversible linking           | Meter/time/similarity constraints, link/dismiss/undo                           | Human link/undo/dismiss asserts both originals survive                           |
| Private assistance                               | Scoped request, owning org assignment and progress                             | Cross-region and public-exclusion tests pass                                     |
| Private attachments                              | Signature/size/pixel/count limits, EXIF-free JPEG, scoped read                 | Disguised upload, metadata stripping and privacy tests pass                      |
| Plan authoring and review                        | Structured forms, immutable versions, independent approval                     | DB invariants and independent-browser publication pass                           |
| Plan expiry/source/owner metadata                | Current publication, review/expiry/version/owner                               | Public publication DTO and screenshot/browser checks pass                        |
| Offline plans and checklist                      | Explicit IndexedDB saving, stale/expiry warnings, local progress               | Disconnected reload and persisted checklist browser test pass                    |
| Offline drafts and retries                       | Text-only durable queue, stable keys, multi-tab lock, bounded retries          | Reconnection gives one receipt; concurrent DB replay pass                        |
| Privacy of cached data                           | No persistent contact/GPS/photo drafts; no API/SW caching                      | Code/cache review and actual offline browser behavior verified                   |
| Provisional triage                               | Strict facts/references/missing information, deterministic fallback            | Injection, malformed JSON, fabrication, outage tests pass                        |
| Human AI acceptance/edit/rejection               | Separate auditable record; originals unchanged                                 | Actual DB rejection/preservation tests and rendered controls verified            |
| Report-group summaries                           | Deterministic bounded sample/counts/source links                               | Actual reference and cross-region tests pass                                     |
| Coverage gaps                                    | Recent located observation counts, intersected quadrants                       | Spatial tests pass; no safe/unsafe scoring                                       |
| Layered clustered map and fallback               | OSM street tiles, MapLibre local layers, runtime provider and text fallback    | Visible live streets verified; fixture privacy/toggle/outage browser tests pass  |
| External source normalization                    | BMKG/PetaBencana timeout/size/schema/attribution adapters                      | Read-only public probes pass: 18 weather records, valid empty crowd feed         |
| Independent source failures                      | Source runs/revisions, preserved prior timestamps, disable/refresh             | Outage test retains old feed and working plans/reports                           |
| In-app updates and preferences                   | Scoped, opt-out, read state; no external messages                              | Preference/ownership DB tests and route accessibility checks pass                |
| Simulation training                              | Authored questions/schedule, answers/score/feedback, private aggregates        | Idempotency/privacy DB test and completion browser journey pass                  |
| Administration                                   | Organizations, access, region polygon/categories/contacts/retention/suspension | Actual DB configuration tests; screens and controls verified                     |
| Governance and erasure                           | Receipt requests, admin processing, shared erasure, daily retention            | Append-only audit tamper rejection and expiration/erasure tests pass             |
| Durable jobs and monitoring                      | SQL outbox, leases, four attempts/backoff, heartbeat/retry                     | Worker container health and actual jobs/admin diagnostics checked                |
| Docker and persistence                           | Full build, migrations/seed, private DB, health checks                         | Complete Compose startup succeeds; idempotent seed preserves data                |
| Backup and restoration                           | Binary-safe dump/copy, separate guarded restore database                       | Successful restore with data counts and required extensions                      |
| Responsive/accessibility                         | Tokens, focus, skip link, semantic status, AA contrasts, reduced motion        | Six Warga widths, four Posko widths; route axe scans and keyboard pass           |
| OpenAPI and CI                                   | Generated implemented routes, lockfile and full test workflow                  | Generated spec/checks executed locally; remote CI result not inferred            |
| Performance measurement                          | Five endpoints, 100 measured samples each, concurrency 5                       | Local p95 < 500ms; JSON evidence; not a production capacity claim                |
| Dependency and secret hygiene                    | Patched router, pinned lockfile, ignored secrets, private images               | Production dependency audit zero known advisories after upgrade; repository scan |
| Documentation and demo                           | Architecture/security/design/offline/adapters/operations/demo/delivery         | Exact startup used; fixtures and limitations disclosed                           |

## External gates, not activated in the simulation

| Gate                            | Current state                                         | Needed for operational launch                                                      |
| ------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Community plans and contacts    | Fictional owners; no invented emergency numbers       | Real owner review, validated accessibility/routes and current contacts             |
| External live sources           | Read-only probes; adapters disabled in seeded regions | Authorized use, correct regional identifiers, reviewed attribution/terms/capacity  |
| InaRISK                         | Reference-only, disclosed unavailable live connector  | Approved supported access method/data and source governance                        |
| Live inference                  | Compatible adapter, no approved credentials/model     | Provider approval, data-handling policy, model credentials and evaluations         |
| Public hosting                  | Loopback Docker simulation                            | Domain/TLS, secrets, encryption/backup policy, monitoring and accountable operator |
| Real user/operational assurance | Automated AA checks and synthetic journeys            | Screen-reader/usability field trials, independent security and load evaluation     |

Optional translation, external message delivery, predictive risk scoring and
automatic evacuation decisions are not supplied. The latter are not implied by
the AI or coverage features. All delivered simulation actions are reviewable and
attributable; deployment limitations are described in [DELIVERY.md](../DELIVERY.md).
