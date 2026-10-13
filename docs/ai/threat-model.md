# AI trust boundaries and review scope

Residents, scoped coordinators, organization administrators, separate AI operators
and approvers, workers, the database, approved corpus, model supplier and private
telemetry are separate trust boundaries. Model text and imported reference text
are untrusted inputs. AI runs have no dispatch, publication, notification,
evacuation, plan approval or arbitrary tool capability. Those actions remain
explicit authenticated human workflows.

| Threat                                                    | Implemented control                                                                                                                                                | Verification and remaining evidence                                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Prompt instructions embedded in sources                   | Bounded context, isolated source envelopes, strict output schema, exact source quotes, critical-claim filtering, no model tools                                    | Malformed/fabricated output integration cases; held-out attacks and independent safety review still required     |
| Cross-region disclosure                                   | Authenticated scoped membership, region-scoped SQL, forced RLS non-owner retrieval role, approved security-barrier view, source rechecks                           | Real PostgreSQL cross-region integration cases; deployed service role and IAM must be reviewed                   |
| Contact/identity exposure                                 | Report fields minimized before inference; phone/email/identity redaction, sensitive-text quarantine; no photos, contact payloads or precise coordinates in prompts | Redaction tests and minimal provider-request checks; heuristics do not identify every personal detail            |
| Revoked or erased content resurrected by retries          | Durable source versions, fencing, current actor/source checks before commit; cancelled/erased run content cleared; independent erasure replay after restore        | In-flight erasure/revocation and isolated restore tests; target-account PITR/RPO/RTO drill remains required      |
| Stale published guidance or partial embeddings            | Approved, unexpired immutable versions; withdrawal clears derived corpus; vectors eligible only after complete source-version ingestion                            | Lifecycle, withdrawal and version-promotion tests; source owners must keep real guidance current                 |
| Unreviewed or tampered model configuration                | Immutable endpoint/model/prompt/schema/embedding/price manifest, signed-in role separation, strict registered evaluation and two matching artifact approvals       | Mismatched evidence fails closed; hashes bind artifacts but do not authenticate external reviewers by themselves |
| Runaway billing or worker retries                         | Conservative durable reservations, global/monthly/org/run limits, queue/concurrency bounds, bounded attempts, cached candidates/query embeddings, kill controls    | Budget/retry accounting tests; verify supplier token semantics, prices and bill against ledger in staging        |
| Duplicate execution, late writes or unavailable inference | SQL outbox, renewable leases and fenced writes, durable attempts/checkpoints, linked manual retry, provider circuit breaker                                        | Cancellation/stale-lease/retry tests; provider outage and multi-worker capacity drills remain required           |
| Privileged session takeover                               | Secure same-origin cookies, CSRF, login throttling, encrypted TOTP and atomic counter reuse protection; production AI needs verified MFA                           | HTTP/MFA tests; private account recovery, secret rotation and independent penetration testing required           |
| Sensitive logs, traces or secrets                         | Server-side env only; sanitized errors; LangSmith/content tracing rejected; private manual telemetry with fixed metadata labels                                    | Provider/admin redaction tests; deployment logging, access and retention require operational review              |

Approved plaintext imports avoid parsers, remote URL fetches and executable
attachments. Source URL is provenance; it does not grant the model access to that
site. The importer's independent reviewer checks ownership/license, usefulness,
expiry and safety. Translation retains originals and requires qualified production
review; schema/numeric checks alone do not establish translation accuracy.

The AWS backup task exports only erased report and withdrawn reference UUIDs to
a KMS-encrypted versioned object. It has write-only S3 permissions, serializes
overlapping snapshots and raises an alarm if success is absent. It currently uses
the service database credential in a read-only transaction; an organization may
provision a dedicated SELECT-only credential for tighter operational separation.
Backup replay runs only against quarantined non-serving restores. Confirm
independent storage access, ledger freshness and alarm delivery before launch.

An independent security review must inspect authorization, identity, uploaded
media, corpus poisoning, source lifecycle, privacy/retention, release governance,
provider contracts, operational secrets and restore behavior across deployed
boundaries. Record findings, remediation and artifact hashes in evaluation evidence.
This document and local automated tests are engineering inputs to that review.
