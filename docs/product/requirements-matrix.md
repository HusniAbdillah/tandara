# Requirements and verification tracker

Status starts pending; a compiled feature is not evidence of completed verification.

| Requirement group | Implementation | Evidence | Status |
|---|---|---|---|
| Identity, organizations, scoped regions | backend identity + migration | DB/API security tests | Pending |
| Citizen feed, report, receipt tracking | Warga + reports module | browser journey | Pending |
| Coordinator review, duplicate decisions | Posko + moderation module | state/tenant tests | Pending |
| Plans, independent review, publication, history | plans module + both apps | DB + browser | Pending |
| Source provenance, independent failure | source adapters + jobs | normalization/failure tests | Pending |
| Uncertain AI, evidence, human acceptance | triage adapter + Posko | injection/schema tests | Pending |
| Map and explainable coverage gaps | PostGIS + MapLibre | spatial tests + visual QA | Pending |
| Offline plans/checklist/report retries | IndexedDB + PWA | real offline browser test | Pending |
| Private assistance + attachments | protected backend | access/upload tests | Pending |
| Training and aggregate outcomes | simulation module | browser journey | Pending |
| Administration/governance/retention | admin module | scoped API tests | Pending |
| Containers, jobs, monitoring, recovery | Compose + worker + runbooks | fresh launch/restore | Pending |
| UI/responsive/accessibility | shared design tokens | screenshots + axe + keyboard | Pending |
| CI, security, performance, delivery | checks + report | executed command results | Pending |

External source permissions, approved model credentials, verified local emergency
contacts and real operational plan ownership are deployment dependencies.
