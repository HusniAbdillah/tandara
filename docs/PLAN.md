# Tandara — 3-Day Implementation Plan  
## Hackathon MVP Execution Plan for 3 Technical Members + 1 Non-Technical Member

**Team assumption:**

- **Person A — Product, UX/UI, Research, QA, Pitch** *(non-technical primary role)*
- **Person B — Frontend & PWA Engineer**
- **Person C — Backend, Database & Infrastructure Engineer**
- **Person D — Full-Stack Dashboard, AI & Integration Engineer**

> If only **3 people total** are actively working, merge Person A and Person D responsibilities carefully. However, the ideal configuration is **3 technical builders + 1 product/design/pitch owner**.

---

# 1. Critical Scope Decision

A full PRD for Tandara describes a platform that could take several months to build properly.

In **3 days**, the objective is **not** to implement every production feature. The objective is:

> Build a polished, working, safe, end-to-end MVP that proves Tandara’s core value:
>
> **Resident submits a local flood report → system structures it with AI assistance → coordinator reviews it → public/local readiness information becomes clearer.**

The product must feel complete in the demo, even though only the highest-value workflow is built.

---

# 2. MVP Definition

## 2.1 The One Core Story

> A resident in a flood-prone neighborhood receives uncertain local information. They open Tandara, access a verified preparedness plan, report an observed flood condition even with poor connectivity, and a local coordinator reviews the report with AI assistance before making it visible as reviewed community information.

This single story should be visible through the entire demo.

---

## 2.2 MVP Must-Have Features

These features are mandatory for the hackathon prototype.

| ID | Feature | Why it matters |
|---|---|---|
| MVP-01 | Tandara Warga landing/home page | Establishes the resident experience and trust model |
| MVP-02 | Region selection | Shows that Tandara is locally configurable |
| MVP-03 | Published preparedness plan | Solves the “what should I do next?” problem |
| MVP-04 | Preparedness checklist | Connects information to practical action |
| MVP-05 | Offline plan access | Strong sustainability/resilience differentiator |
| MVP-06 | Community report form | Allows residents to submit local conditions |
| MVP-07 | Offline report draft/queue | Demonstrates poor-connectivity resilience |
| MVP-08 | Coordinator login | Demonstrates role separation |
| MVP-09 | Coordinator report inbox | Shows a real operational workflow |
| MVP-10 | Report detail page | Shows original report, evidence, and AI output |
| MVP-11 | AI triage suggestion | Demonstrates structured AI assistance |
| MVP-12 | Duplicate-report candidate | Demonstrates useful intelligence, not generic chatbot AI |
| MVP-13 | Human review workflow | Shows safety-first human-in-the-loop design |
| MVP-14 | Restricted help request | Demonstrates privacy and role-based access |
| MVP-15 | Local-plan metadata | Owner, source, status, review date, and disclaimer |
| MVP-16 | Demo map or location list | Demonstrates spatial context without claiming route safety |
| MVP-17 | Clear status labeling | Official/plan/community report/AI/simulation distinctions |
| MVP-18 | Seeded simulation data | Makes demo reliable without live external API dependency |

---

## 2.3 Nice-to-Have Features

Implement only if all Must-Have items are done and tested.

| ID | Feature | Priority |
|---|---|---|
| NTH-01 | Photo upload with MinIO | Medium |
| NTH-02 | Full map with MapLibre markers | Medium |
| NTH-03 | Drill/simulation mini quiz | Medium |
| NTH-04 | Dark mode | Low |
| NTH-05 | Detailed analytics dashboard | Low |
| NTH-06 | Full plan editing workflow | Low |
| NTH-07 | Notifications | Low |
| NTH-08 | Real AI provider integration | Medium; use only if stable |
| NTH-09 | External BMKG/PetaBencana integration | Do not prioritize |
| NTH-10 | Multi-region administration panel | Low |

---

## 2.4 Explicitly Deferred Features

Do **not** build these in the 3-day MVP.

| Feature | Reason |
|---|---|
| Real official-alert API integration | Legal, reliability, and licensing concerns; adds demo risk |
| Full user registration / password reset | Login with seeded coordinator account is enough for demo |
| Real emergency dispatch | Unsafe and operationally impossible |
| Dynamic evacuation routing | High safety risk and out of scope |
| Full native mobile app | PWA is sufficient |
| Kubernetes | Massive infrastructure overkill |
| Advanced multi-tenant organization management | Not necessary for one pilot-region demo |
| Complete MinIO malware scanning | Valuable but not hackathon-critical |
| Full database encryption-at-rest implementation | Infrastructure-level concern; document it for pilot |
| Comprehensive admin console | Use simple seeded configuration |
| Full real-time WebSocket architecture | Poll/refetch after action is sufficient |
| Every PRD feature | Impossible in three days without sacrificing quality |

---

# 3. Product Scope for the 3-Day Demo

## 3.1 Tandara Warga Pages

| Page | Route | Must build? | Purpose |
|---|---|---:|---|
| Welcome / Region Selection | `/` | Yes | Select simulated neighborhood |
| Home | `/home` | Yes | Status overview and quick actions |
| Preparedness Plan | `/plan` | Yes | Show verified local plan |
| Preparedness Checklist | `/checklist` | Yes | Household readiness actions |
| Submit Report | `/report` | Yes | Submit flood condition |
| Report Submission Status | `/report/status/:id` | Yes | Confirm queued/submitted/reviewed state |
| Offline Information | `/offline` | Yes | Explain cached/offline state |
| Local Contacts | `/contacts` | Optional | Emergency/local contacts and disclaimer |
| Drill / Quiz | `/drill` | Nice-to-have | Demonstrate learning outcome |

---

## 3.2 Tandara Posko Pages

| Page | Route | Must build? | Purpose |
|---|---|---:|---|
| Login | `/login` | Yes | Coordinator authentication |
| Dashboard | `/dashboard` | Yes | Overview of incoming reports |
| Report Inbox | `/reports` | Yes | Filterable report list |
| Report Detail | `/reports/:id` | Yes | Raw report + AI + human review |
| Duplicate Candidates | `/duplicates` | Yes | Show possible duplicate reports |
| Help Requests | `/help-requests` | Yes | Restricted sensitive requests |
| Local Plan Overview | `/plans` | Yes | Show existing published plan metadata |
| Plan Editor | `/plans/:id/edit` | Optional | Only if time remains |
| Drill Insights | `/drills` | Nice-to-have | Aggregate drill results |
| Settings | `/settings` | Do not build | Use static seeded config instead |

---

# 4. Team Structure and Ownership

## 4.1 Recommended Team Roles

| Person | Role | Primary Ownership |
|---|---|---|
| Person A | Product/UX/UI/Research/QA/Pitch | Product scope, Figma, copy, seed data, usability QA, pitch deck, demo script |
| Person B | Frontend & PWA Engineer | Tandara Warga, offline cache, IndexedDB, responsive UI, accessibility |
| Person C | Backend & Infrastructure Engineer | API, PostgreSQL/PostGIS, authentication, report workflow, Docker/VPS |
| Person D | Dashboard, AI & Integration Engineer | Tandara Posko, AI triage UI/API integration, duplicate logic, coordinator flow |

---

## 4.2 Responsibility Matrix

| Area | A: Product | B: Frontend | C: Backend | D: Dashboard/AI |
|---|---:|---:|---:|---:|
| Problem framing | **Owner** | Support | Support | Support |
| UI flow and wireframe | **Owner** | Support | — | Support |
| Design system | **Owner** | Implement | — | Implement |
| Resident PWA | QA | **Owner** | API support | Support |
| Offline-first flow | QA | **Owner** | Support | — |
| Database schema | Review | — | **Owner** | Support |
| API implementation | Review | Support | **Owner** | Support |
| Auth and authorization | Review | — | **Owner** | Support |
| Coordinator dashboard | QA | Support | API support | **Owner** |
| AI triage | Content review | Support | Queue/API support | **Owner** |
| Demo seed data | **Owner** | Support | Support | Support |
| VPS deployment | — | — | **Owner** | Support |
| Testing and QA | **Owner** | Fix UI bugs | Fix backend bugs | Fix dashboard bugs |
| Pitch deck | **Owner** | Technical slides | Architecture slides | AI slides |
| Final demo | **Owner/narrator** | Resident flow | System/API fallback | Coordinator flow |

---

## 4.3 Daily Rituals

Because the timeline is only three days, avoid long meetings.

### Mandatory schedule

| Time | Activity | Duration |
|---|---|---:|
| Morning | Daily stand-up: blockers, priorities, scope changes | 10 minutes |
| Midday | Integration checkpoint | 15 minutes |
| Evening | Demo test and bug triage | 30–45 minutes |
| End of day | Freeze unstable features, update task board | 15 minutes |

### Stand-up format

Each person answers only:

1. What was completed?
2. What will I complete next?
3. What is blocking me?
4. Does any task threaten the MVP timeline?

---

# 5. Delivery Strategy

## 5.1 Development Principle

> Build vertical slices, not isolated layers.

Do not build “all frontend first” or “all backend first.”

Instead, build one complete flow at a time:

```text
Resident report form
        ↓
API endpoint
        ↓
Database record
        ↓
Coordinator inbox
        ↓
Report detail
        ↓
Review action
        ↓
Updated status
```

Once that works, add AI, offline handling, duplicate candidates, and polish.

---

## 5.2 Priority Order

```text
1. Working end-to-end reporting flow
2. Coordinator review flow
3. Preparedness plan flow
4. Offline plan + offline report queue
5. AI triage
6. Duplicate suggestions
7. UI polish and accessibility
8. Map
9. Optional extras
```

If time becomes limited, sacrifice advanced map interactions, analytics, and photo upload—not the core report-review workflow.

---

# 6. Technical MVP Architecture

```text
Tandara Warga PWA
React + Vite + TypeScript
        │
        │ REST API
        ▼
Tandara API
NestJS + Fastify
        │
        ├── PostgreSQL + PostGIS
        ├── Redis + BullMQ
        ├── AI Triage Adapter
        └── Audit Log
        │
        ▼
Tandara Posko Dashboard
React + Vite + TypeScript
```

For the hackathon:

- Use **one VPS only** or a stable cloud demo environment.
- Use Docker Compose.
- Use simulation data.
- Use a mock AI fallback.
- Avoid hard dependency on external APIs.
- Avoid complex real-time architecture.

---

# 7. Detailed Task Breakdown

Below, every task has:

- **Task ID**
- **Owner**
- **Dependencies**
- **Deliverables**
- **Definition of Done**
- **Estimated effort**

---

# EPIC 0 — Project Setup and Working Agreement

## T-001 — Create Monorepo

**Owner:** Person C  
**Support:** Person B, Person D  
**Estimate:** 1–2 hours  
**Priority:** Critical

### Brief

Create a TypeScript monorepo that supports two frontend applications, one backend API, and shared contracts.

### Deliverables

```text
/apps/resident-web
/apps/coordinator-web
/apps/api
/packages/contracts
/packages/ui
/packages/config
/infrastructure/compose
/docs
```

### Definition of Done

- `pnpm install` succeeds.
- All applications run locally.
- Shared TypeScript package can be imported.
- Basic lint and format scripts work.
- README contains local setup instructions.

---

## T-002 — Create Shared Design Tokens

**Owner:** Person A  
**Implementation:** Person B and D  
**Estimate:** 1 hour  
**Priority:** High

### Deliverables

- Color palette.
- Typography scale.
- Spacing scale.
- Status colors.
- Badge styles.
- Buttons.
- Card components.
- Form states.
- Empty states.
- Loading states.

### Recommended Tandara Palette

| Token | Color | Usage |
|---|---|---|
| `navy-900` | `#102A43` | Primary text/navigation |
| `teal-600` | `#167D7F` | Trust/readiness primary |
| `teal-100` | `#DFF4F1` | Soft background |
| `amber-500` | `#E8A317` | Attention/review needed |
| `red-600` | `#C83E4D` | Critical/restricted/error |
| `blue-600` | `#2563EB` | Information |
| `gray-900` | `#1F2937` | Text |
| `gray-100` | `#F3F4F6` | Background |
| `white` | `#FFFFFF` | Surface |

### Status Visual Rules

| Status | Color | Text label |
|---|---|---|
| Published plan | Teal | Published Local Plan |
| Submitted report | Blue | Submitted |
| Awaiting review | Amber | Awaiting Review |
| Reviewed report | Teal | Reviewed |
| Restricted | Red | Restricted |
| Offline | Gray | Saved Offline |
| Simulation | Purple/outlined | Simulation |

---

## T-003 — Create Demo Seed Data

**Owner:** Person A  
**Support:** Person C  
**Estimate:** 1.5 hours  
**Priority:** Critical

### Seed Region

```text
Region:
Kampung Sido Rukun — Simulated Flood-Prone Community
```

### Seed Plan

```text
Plan title:
Flood Preparedness Plan — Kampung Sido Rukun

Owner:
Kampung Sido Rukun Community Preparedness Team

Version:
v1.2

Last reviewed:
20 October 2026

Next review:
20 January 2027
```

### Seed Reports

1. **Report A — Road Flooding**
   - “Water is knee-high near Jalan Melati, close to the community hall. Cars cannot pass.”

2. **Report B — Possible Duplicate**
   - “The road near the hall is flooded and motorcycles are turning back.”

3. **Report C — Ambiguous**
   - “Flooding is happening nearby. Please check.”

4. **Report D — Restricted Follow-Up**
   - “An elderly resident may need follow-up near the health post.”

### Definition of Done

- Seed script can populate a fresh database.
- Demo can be reset in under five minutes.
- Every record has `is_simulation = true`.
- Seed data uses no real personal information.

---

# EPIC 1 — Backend Foundation

## T-101 — PostgreSQL/PostGIS Setup

**Owner:** Person C  
**Estimate:** 2 hours  
**Priority:** Critical  
**Dependencies:** T-001

### Deliverables

- PostgreSQL Docker service.
- PostGIS extension enabled.
- Migration system.
- Database connection configuration.
- Basic health check.

### Definition of Done

- `SELECT PostGIS_Version();` succeeds.
- Application can connect to PostgreSQL.
- Migration command works.
- Database is not exposed publicly in production Compose file.

---

## T-102 — Core Database Schema

**Owner:** Person C  
**Support:** Person D  
**Estimate:** 3–4 hours  
**Priority:** Critical  
**Dependencies:** T-101

### MVP Tables

```text
users
organizations
organization_memberships
regions
preparedness_plans
preparedness_plan_versions
reports
report_reviews
ai_triage_results
duplicate_candidates
help_requests
audit_logs
```

### Simplification for MVP

Do not implement every future table. Use only data needed for the demo.

### Definition of Done

- All tables created by migrations.
- Foreign keys exist.
- Core indexes exist.
- Seed script works.
- Report status enum/constraint works.
- `is_simulation` exists on reports and help requests.
- Audit logs can be inserted.

---

## T-103 — Auth and Role Guard

**Owner:** Person C  
**Support:** Person D  
**Estimate:** 3 hours  
**Priority:** Critical  
**Dependencies:** T-102

### MVP Approach

- Seed one coordinator account:
  ```text
  Email: coordinator@tandara.demo
  Password: demo-password-change-before-deploy
  ```
- Use secure cookie session or JWT in HTTP-only cookie.
- Roles:
  - `PUBLIC`
  - `COORDINATOR`
  - `ORG_ADMIN`

### Definition of Done

- Coordinator can log in.
- Unauthenticated users cannot access dashboard API.
- Public user can view published plans.
- Help requests are blocked for public users.
- API returns `401`/`403` correctly.
- Password is hashed; never stored in plaintext.

---

## T-104 — Preparedness Plan API

**Owner:** Person C  
**Support:** Person B  
**Estimate:** 2 hours  
**Priority:** High  
**Dependencies:** T-102

### Endpoints

```text
GET /api/v1/regions
GET /api/v1/regions/:regionId/plans
GET /api/v1/plans/:planId
```

### Required Response Data

```json
{
  "id": "plan-id",
  "title": "Flood Preparedness Plan",
  "status": "published",
  "version": "1.2",
  "ownerName": "Kampung Sido Rukun Community Preparedness Team",
  "effectiveAt": "2026-10-20T00:00:00Z",
  "reviewDueAt": "2027-01-20T00:00:00Z",
  "preparationSteps": [],
  "assemblyPoints": [],
  "contacts": [],
  "safetyDisclaimer": "..."
}
```

### Definition of Done

- Public users can fetch the published plan.
- Draft plans are not exposed publicly.
- API includes review date and owner.
- Plan data is stable for offline cache.

---

## T-105 — Resident Report Submission API

**Owner:** Person C  
**Support:** Person B  
**Estimate:** 3 hours  
**Priority:** Critical  
**Dependencies:** T-102

### Endpoint

```text
POST /api/v1/reports
```

### Required Input

```json
{
  "regionId": "uuid",
  "category": "road_flooding",
  "description": "Water is knee-high near the community hall.",
  "observationTime": "2026-10-21T08:30:00+07:00",
  "landmarkText": "Near community hall",
  "location": {
    "latitude": -7.7956,
    "longitude": 110.3695,
    "accuracyMeters": 50
  },
  "followUpRequested": false,
  "isSimulation": true
}
```

### Requirements

- Validate payload using Zod.
- Require `Idempotency-Key`.
- Store status as `submitted`.
- Create audit-log event.
- Generate guest receipt token or return simple local report ID for MVP.
- Add AI triage outbox event.

### Definition of Done

- Valid report saves to database.
- Invalid report returns useful field errors.
- Duplicate request with same idempotency key does not create duplicate report.
- Submission works without authentication.
- API never falsely returns success if database write failed.

---

## T-106 — Coordinator Report Inbox API

**Owner:** Person C  
**Support:** Person D  
**Estimate:** 2.5 hours  
**Priority:** Critical  
**Dependencies:** T-103, T-105

### Endpoints

```text
GET /api/v1/reports
GET /api/v1/reports/:reportId
```

### Filters

```text
status
category
regionId
isSimulation
followUpRequested
```

### Definition of Done

- Coordinator sees seeded and new reports.
- Report list sorts newest first.
- API provides status, category, report time, submitted time, and ambiguity flag.
- Public users cannot access this endpoint.
- Pagination can be simple page/limit for MVP.

---

## T-107 — Coordinator Review API

**Owner:** Person C  
**Support:** Person D  
**Estimate:** 2.5 hours  
**Priority:** Critical  
**Dependencies:** T-106

### Endpoint

```text
POST /api/v1/reports/:reportId/review
```

### Supported Actions

```text
mark_under_review
mark_reviewed
publish
request_clarification
restrict
close_duplicate
close_outdated
close_inappropriate
```

### Definition of Done

- Only coordinators can review reports.
- Status transitions are validated.
- Review reason is recorded.
- Audit event is created.
- Report list updates after review.
- AI result cannot change status by itself.

---

# EPIC 2 — AI Triage and Duplicate Suggestions

## T-201 — AI Triage Contract

**Owner:** Person D  
**Support:** Person C  
**Estimate:** 1.5 hours  
**Priority:** Critical  
**Dependencies:** T-105

### Build

- Shared Zod schema.
- `AiTriageProvider` interface.
- `MockAiTriageProvider`.
- Optional live provider adapter.

### Required Output

```json
{
  "suggestedCategory": "road_flooding",
  "confidenceBand": "medium",
  "explicitFacts": {
    "locationText": "near the community hall",
    "observationTimeText": "unknown",
    "conditionText": "road flooded",
    "assistanceRequested": false
  },
  "missingInformation": [
    "exact observation time"
  ],
  "summary": "A resident reports road flooding near the community hall.",
  "safetyNote": "AI suggestion only. Requires coordinator review."
}
```

### Definition of Done

- Output is validated by Zod.
- Invalid AI output cannot be stored.
- `unknown` is allowed.
- Output is stored separately from report data.

---

## T-202 — Deterministic Mock AI Engine

**Owner:** Person D  
**Estimate:** 2 hours  
**Priority:** Critical  
**Dependencies:** T-201

### Why It Is Important

A live LLM API can fail because of:

- Internet issues.
- Rate limits.
- API quota.
- JSON formatting failures.
- Slow response.
- Provider outage.

For a hackathon, use a deterministic mock AI engine as fallback.

### Rule Examples

| Keywords | Suggested category |
|---|---|
| road, vehicle, motorcycle, cannot pass | `road_flooding` |
| house, home, entering | `water_entering_homes` |
| elderly, senior, disabled, needs help | `follow_up_needed` |
| tree, debris | `debris` |
| unclear/nothing specific | `unknown` |

### Definition of Done

- Reports A–D always produce predictable expected AI output.
- Demo works without any external AI provider.
- UI clearly labels it as AI assistance, not verified information.

---

## T-203 — Optional Live AI Adapter

**Owner:** Person D  
**Estimate:** 2–3 hours  
**Priority:** Medium  
**Dependencies:** T-201

### Rule

Only implement after the deterministic engine works.

### Requirements

- API key stored only in backend environment variable.
- Output must pass Zod validation.
- Timeout: 10–15 seconds maximum.
- Fall back to mock or “AI unavailable.”
- No resident personal contact data sent to provider.
- No automatic publishing.

### Definition of Done

- Can be enabled via environment variable:
  ```text
  AI_PROVIDER=mock | live
  ```
- Demo remains functional when set to `mock`.

---

## T-204 — Duplicate Candidate Logic

**Owner:** Person D  
**Support:** Person C  
**Estimate:** 2 hours  
**Priority:** High  
**Dependencies:** T-105, T-102

### MVP Logic

Two reports are potential duplicates if:

- Same region.
- Same/similar category.
- Submitted within two hours.
- Similar landmark text or location proximity.
- Similar keywords.

### For Demo

Hard-code or calculate Report A ↔ Report B as duplicate candidate.

### Definition of Done

- Coordinator sees candidate pair.
- UI explains why:
  > Same category, submitted 12 minutes apart, both near the community hall.
- No report is closed automatically.
- Coordinator can confirm or reject duplicate status.

---

# EPIC 3 — Tandara Warga Frontend

## T-301 — Resident App Shell and Region Selection

**Owner:** Person B  
**Support:** Person A  
**Estimate:** 2 hours  
**Priority:** Critical  
**Dependencies:** T-001, T-104

### Screens

1. Welcome.
2. Region selection.
3. Consent explanation:
   - Location is optional.
   - Tandara is not an official warning system.
4. Continue to home.

### Definition of Done

- Region selection is stored in local storage or IndexedDB.
- User can proceed without location permission.
- Responsive on mobile width 360px.
- Empty/loading/error states exist.

---

## T-302 — Resident Home Screen

**Owner:** Person B  
**Support:** Person A  
**Estimate:** 3 hours  
**Priority:** Critical  
**Dependencies:** T-301, T-104

### Required Sections

1. Header:
   - Tandara logo.
   - Selected region.
   - Offline/online state.

2. Trust banner:
   > Tandara supports community preparedness. Follow official authorities during emergencies.

3. Main readiness card:
   - Published plan status.
   - Last reviewed date.
   - “View Plan” button.

4. Quick actions:
   - View Plan.
   - Checklist.
   - Submit Report.
   - Contacts.

5. Recent community information:
   - Reviewed only, or seeded simulated reports.
   - Clear status label.

6. Offline card:
   - Last sync time.
   - Save plan action.

### Definition of Done

- User can navigate to all core resident features.
- Every card has source/status/time labels.
- Mobile layout is polished.
- No information is shown as official unless labeled.

---

## T-303 — Preparedness Plan Page

**Owner:** Person B  
**Support:** Person A  
**Estimate:** 3 hours  
**Priority:** Critical  
**Dependencies:** T-104

### Page Sections

```text
Plan header
- Published Local Plan
- Region
- Version
- Owner
- Last reviewed
- Next review date

Before Flooding
- Household preparation steps

During Flooding
- Safety behavior

Local Meeting Point
- Name, description, accessibility note

Important Contacts
- Local contact details

Safety disclaimer
- Tandara does not replace official instructions

Offline section
- Save for offline
- Last saved time
```

### Definition of Done

- Plan can load from API.
- Plan can load from local offline cache.
- Offline plan displays cached timestamp.
- Plan has printable layout or browser print support.
- Disclaimer is visible.

---

## T-304 — Preparedness Checklist

**Owner:** Person B  
**Support:** Person A  
**Estimate:** 2 hours  
**Priority:** High  
**Dependencies:** T-301

### Requirements

- 8–10 checklist items.
- Checkbox interaction.
- Progress indicator.
- Local persistence using IndexedDB.
- Reset action.
- No server account required.

### Definition of Done

- Completion persists after refresh.
- Works offline.
- Accessible labels and keyboard interaction work.
- Does not expose personal completion data publicly.

---

## T-305 — Report Form

**Owner:** Person B  
**Support:** Person A, Person C  
**Estimate:** 4 hours  
**Priority:** Critical  
**Dependencies:** T-105

### Form Fields

| Field | Required |
|---|---:|
| Category | Yes |
| Description | Yes |
| Observation time | No; user can select Unknown |
| Landmark text | No |
| Optional map/GPS location | No |
| Follow-up request | No |
| Contact permission | No |
| Simulation notice | Yes in demo mode |

### UX Requirements

- Use plain language.
- Explain why each field is requested.
- Display “Location optional.”
- Clearly show “This report will be reviewed by a coordinator.”
- Show validation errors inline.
- Do not promise emergency response.

### Definition of Done

- Online submission works.
- Error states work.
- Confirmation page displays submitted status.
- An idempotency key is generated client-side.
- Form does not lose content after minor validation errors.

---

## T-306 — Offline Report Queue

**Owner:** Person B  
**Support:** Person C  
**Estimate:** 3–4 hours  
**Priority:** High  
**Dependencies:** T-305

### Requirements

- When offline or API request fails, store draft in IndexedDB.
- Show:
  > Saved Offline — Not Submitted Yet
- On connection return, retry submission.
- Allow manual retry.
- Use generated idempotency key.
- Allow user to delete a local draft.

### Definition of Done

- Works when browser network is disabled.
- Draft survives page reload.
- Retry does not create duplicate records.
- User sees clear state:
  - Draft
  - Queued
  - Syncing
  - Submitted
  - Sync Failed

---

## T-307 — Resident Status and Contacts Page

**Owner:** Person B  
**Support:** Person A  
**Estimate:** 1.5 hours  
**Priority:** Medium

### Includes

- Report status explanation.
- Local contact card.
- Official emergency disclaimer.
- Offline guide.
- “What Tandara can and cannot do” section.

### Definition of Done

- Content is readable and accessible.
- No misleading emergency claims.
- Can be accessed without account.

---

# EPIC 4 — Tandara Posko Frontend

## T-401 — Coordinator Login

**Owner:** Person D  
**Support:** Person C  
**Estimate:** 1.5 hours  
**Priority:** Critical  
**Dependencies:** T-103

### Definition of Done

- Login works with seeded account.
- Error message appears on invalid credentials.
- Protected routes redirect to login.
- Session remains available on refresh.
- Logout works.

---

## T-402 — Coordinator Dashboard Overview

**Owner:** Person D  
**Support:** Person A  
**Estimate:** 2 hours  
**Priority:** High  
**Dependencies:** T-106

### Dashboard Cards

```text
New Reports
Reports Awaiting Review
Potential Duplicates
Follow-Up Requests
Published Plan Status
No Recent Information Zones
```

### Definition of Done

- Card counts reflect seeded and submitted data.
- Clicking a card navigates to relevant list.
- Simulation label is clearly visible.
- Dashboard is desktop-first but tablet responsive.

---

## T-403 — Report Inbox

**Owner:** Person D  
**Support:** Person C  
**Estimate:** 3 hours  
**Priority:** Critical  
**Dependencies:** T-106

### Required Columns

```text
Status
Category
Short description
Landmark / Approximate location
Observation time
Submitted time
AI ambiguity indicator
Follow-up request indicator
```

### Required Filters

```text
All
Awaiting Review
Reviewed
Potential Duplicates
Follow-Up Requested
Simulation
```

### Definition of Done

- Data is loaded from API.
- Filters work.
- Clicking row opens report detail.
- Status chips are visually distinct and text-labeled.
- Empty states exist.

---

## T-404 — Report Detail and AI Review

**Owner:** Person D  
**Support:** Person C, Person A  
**Estimate:** 4 hours  
**Priority:** Critical  
**Dependencies:** T-107, T-201

### Layout

**Left column: Original resident report**

```text
Status
Category
Raw description
Observation time
Submitted time
Landmark
Map/location summary
Follow-up request
```

**Right column: AI assistance**

```text
Suggested category
Confidence band
Explicit facts
Missing information
Summary
Potential duplicate reports
AI safety label
```

**Bottom action panel**

```text
Mark Under Review
Accept/Edit Suggestion
Request Clarification
Mark Reviewed
Publish Community Information
Restrict
Close as Duplicate
```

### Definition of Done

- Raw report is visually separate from AI output.
- AI card says:
  > AI Suggestion — Requires Human Review
- Status actions call real API.
- Audit log event is generated.
- The page updates after action.
- Coordinator can see why duplicate was suggested.

---

## T-405 — Duplicate Candidate Page

**Owner:** Person D  
**Support:** Person C  
**Estimate:** 2 hours  
**Priority:** High  
**Dependencies:** T-204

### UI

Show candidate pairs:

```text
Report A                    Report B
────────────────────────────────────────
Same category: Road flooding
Time difference: 12 minutes
Distance: Approx. 95 meters
Shared landmark: Community hall

[Confirm Duplicate] [Keep Separate]
```

### Definition of Done

- At least Report A and B appear.
- Coordinator can mark candidate resolved.
- Confirming duplicate changes status only after explicit action.
- Decision is auditable.

---

## T-406 — Restricted Help Request Page

**Owner:** Person D  
**Support:** Person C  
**Estimate:** 2 hours  
**Priority:** Critical  
**Dependencies:** T-103, T-102

### Requirements

- Coordinator sees Report D / help request.
- Public resident cannot see it.
- Dashboard shows restricted badge.
- Coordinator can assign status:
  - Submitted
  - Assigned
  - Follow-up in progress
  - Closed
- Display disclaimer:
  > This system does not guarantee emergency response.

### Definition of Done

- API blocks unauthorized access.
- Sensitive details are not exposed in public report feed.
- Assigned coordinator action is saved.

---

# EPIC 5 — Offline, Safety, and Trust UI

## T-501 — Status Label System

**Owner:** Person A  
**Implementation:** Person B and D  
**Estimate:** 1.5 hours  
**Priority:** Critical

### Required Status Labels

```text
Published Local Plan
Community Report
Awaiting Review
Reviewed by Local Coordinator
AI Suggestion — Not Verified
Saved Offline
Simulation / Drill
No Recent Information Available
Restricted
```

### Definition of Done

- Identical terms are used in Warga and Posko.
- Status is not indicated by color alone.
- All status labels are included in design tokens.

---

## T-502 — Safety Disclaimer Components

**Owner:** Person A  
**Implementation:** Person B and D  
**Estimate:** 1 hour  
**Priority:** Critical

### Required Copy

**Resident disclaimer**

> Tandara supports community preparedness and does not issue official disaster warnings. Follow instructions from authorized authorities during an emergency.

**Help request disclaimer**

> Tandara does not guarantee emergency response or rescue. If you are in immediate danger, contact authorized emergency services and follow official local instructions.

**Offline disclaimer**

> You are viewing saved information. Last updated: [timestamp]. Conditions may have changed.

### Definition of Done

- Displayed in relevant pages.
- Not hidden in a footer only.
- Clearly visible in the demo.

---

# EPIC 6 — Deployment, QA, and Demo Readiness

## T-601 — Docker Compose Environment

**Owner:** Person C  
**Support:** Person D  
**Estimate:** 2 hours  
**Priority:** High

### Services

```text
postgres
redis
api
worker
resident-web
coordinator-web
caddy
```

MinIO is optional for hackathon if photo upload is deferred.

### Definition of Done

- `docker compose up -d` starts all required services.
- Resident site works.
- Coordinator site works.
- API works.
- Database is seeded.
- Environment variables are documented.

---

## T-602 — VPS Deployment

**Owner:** Person C  
**Estimate:** 2–3 hours  
**Priority:** High

### VPS Checklist

```text
Ubuntu LTS
SSH key access only
UFW enabled
Docker installed
Docker Compose installed
Domain/subdomain configured
Caddy configured
HTTPS works
Database not publicly exposed
Redis not publicly exposed
Environment file stored securely
```

### Definition of Done

- `https://tandara.<domain>` works.
- `https://posko.tandara.<domain>` works.
- `https://api.tandara.<domain>/health` works.
- HTTPS certificate is active.
- Demo account works on deployed system.

---

## T-603 — Functional QA Checklist

**Owner:** Person A  
**Support:** Everyone  
**Estimate:** 2 hours  
**Priority:** Critical

### Test Cases

#### Resident Flow

- [ ] Select region.
- [ ] View published plan.
- [ ] Save plan offline.
- [ ] Turn off internet and open saved plan.
- [ ] Complete checklist.
- [ ] Submit report online.
- [ ] Submit report offline.
- [ ] Restore connectivity.
- [ ] Verify report sync.
- [ ] Confirm report status is understandable.

#### Coordinator Flow

- [ ] Login.
- [ ] View incoming report.
- [ ] Open raw report.
- [ ] View AI suggestion.
- [ ] See ambiguous report.
- [ ] See duplicate candidate.
- [ ] Mark report reviewed.
- [ ] Publish reviewed community information.
- [ ] Access restricted help request.
- [ ] Verify public user cannot access restricted request.

#### Safety Flow

- [ ] Official information is not confused with community information.
- [ ] AI is labeled as a suggestion.
- [ ] Offline content has timestamp.
- [ ] No-recent-information zone is not labeled safe.
- [ ] Help request disclaimer is visible.

---

## T-604 — Demo Fallback Plan

**Owner:** Person A  
**Support:** Everyone  
**Estimate:** 1 hour  
**Priority:** Critical

### Rule

Never rely on live internet, live AI, or external government APIs during the final demo.

### Fallback Assets

| Risk | Fallback |
|---|---|
| Internet failure | Local network/hotspot + recorded walkthrough |
| VPS failure | Local Docker Compose deployment |
| AI API failure | Deterministic mock AI mode |
| Database failure | Seeded backup database or local environment |
| Browser offline demo failure | Pre-recorded offline screen capture |
| Map tile failure | Static screenshot / text list location view |
| Login failure | Fresh demo account and browser profile |
| Accidental data changes | Reset database seed script |

### Definition of Done

- One full demo rehearsal is completed without external AI.
- One full demo rehearsal is completed with browser offline mode.
- Seed reset script is tested.
- Screenshots/video fallback are stored locally.

---

# 8. Detailed 3-Day Schedule

# Day 0 — Before Development Starts

This preparation should happen before the official three-day coding period if possible.

| Task | Owner |
|---|---|
| Confirm scope and remove non-MVP items | All |
| Create GitHub repository | Person C |
| Create Figma design system | Person A |
| Create task board | Person A |
| Prepare seed data content | Person A |
| Buy/configure domain or subdomain | Person C |
| Create shared communication channel | All |
| Decide exact demo narrative | Person A |
| Confirm UI copy and labels | Person A |

---

# Day 1 — Foundation and First End-to-End Flow

## Day 1 Goal

> A resident can submit a report and a coordinator can see it in the dashboard.

This is the most important milestone.

---

## Day 1 Morning: 08:00–12:00

| Task | Owner | Target |
|---|---|---|
| T-001 Monorepo setup | C | Apps boot locally |
| T-101 Postgres/PostGIS setup | C | DB working |
| T-102 Initial schema | C | Core migrations ready |
| T-002 Design system | A | Tokens + core components |
| T-003 Seed data draft | A | Demo data finalized |
| Resident app shell | B | Basic routes + layout |
| Coordinator app shell | D | Login page + dashboard shell |

### Day 1 Morning Checkpoint

By noon, the team must be able to run:

```bash
pnpm dev
```

And see:

- Resident app shell.
- Coordinator app shell.
- API health check.
- Database connection.
- Initial seed data.

---

## Day 1 Afternoon: 13:00–18:00

| Task | Owner | Target |
|---|---|---|
| T-103 Auth/RBAC | C | Coordinator login API works |
| T-105 Report submission API | C | POST report works |
| T-305 Resident report form | B | User can submit report |
| T-106 Report inbox API | C | Reports retrievable |
| T-403 Coordinator inbox | D | Submitted reports visible |
| T-501 Status system | A + B + D | Unified labels |

### Day 1 Non-Negotiable Milestone

By the end of Day 1:

```text
Resident submits report
        ↓
Report stored in PostgreSQL
        ↓
Coordinator logs in
        ↓
Coordinator sees report in inbox
```

If this is not working, do not start advanced AI, maps, drill features, or photo upload.

---

## Day 1 Evening: 19:00–22:00

| Task | Owner | Target |
|---|---|---|
| Integrate form → API → inbox | B, C, D | Full slice tested |
| T-603 initial QA | A | Core bugs documented |
| Fix critical issues | All | Green path works |
| Create first demo walkthrough | A | 2-minute test narration |
| Commit stable state | All | Day 1 tag/branch |

---

# Day 2 — Trust, Preparedness, AI, and Offline Capability

## Day 2 Goal

> Tandara feels like a real preparedness product, not merely a report form.

---

## Day 2 Morning: 08:00–12:00

| Task | Owner | Target |
|---|---|---|
| T-104 Plan API | C | Published plan endpoint |
| T-302 Resident home | B | Home page operational |
| T-303 Preparedness plan | B | Plan viewer operational |
| T-304 Checklist | B | Checklist persists locally |
| T-201 AI contract | D | Zod schema + provider interface |
| T-202 Mock AI engine | D | Predictable AI output |
| T-107 Review API | C | Coordinator status action works |
| T-404 Report detail | D | Raw report + AI layout |

### Day 2 Morning Checkpoint

By noon:

```text
Resident sees published plan
        ↓
Coordinator opens report
        ↓
Coordinator sees raw report and AI suggestion separately
        ↓
Coordinator marks report reviewed
```

---

## Day 2 Afternoon: 13:00–18:00

| Task | Owner | Target |
|---|---|---|
| T-306 Offline report queue | B | Draft/queue functionality |
| Offline plan caching | B | Saved plan opens offline |
| T-204 Duplicate logic | D + C | A/B candidate shown |
| T-405 Duplicate page | D | Human decision works |
| T-406 Restricted help request | D + C | Protected view works |
| T-502 Safety disclaimers | A + B + D | Safety copy visible |
| QA trust labels | A | Labels checked |

### Day 2 Non-Negotiable Milestone

By the end of Day 2:

```text
Offline plan works
        ↓
Offline report can be queued
        ↓
AI triage appears
        ↓
Duplicate candidate appears
        ↓
Coordinator completes human review
        ↓
Restricted help request is protected
```

---

## Day 2 Evening: 19:00–22:00

| Task | Owner | Target |
|---|---|---|
| T-601 Docker Compose | C | All services containerized |
| Integration fixes | All | No broken flow |
| Accessibility quick pass | A + B + D | Labels, contrast, keyboard |
| Demo data reset script | C | Database reset works |
| Pitch slide draft | A | Product + flow draft |
| Test offline mode | B + A | Screenshots/video fallback |

---

# Day 3 — Deployment, Polish, QA, and Presentation

## Day 3 Goal

> The deployed demo is stable, polished, understandable, and rehearsed.

No major feature additions after midday.

---

## Day 3 Morning: 08:00–12:00

| Task | Owner | Target |
|---|---|---|
| T-602 VPS deployment | C | Public URLs work |
| Deployment validation | All | End-to-end on VPS |
| UI polish | B + D | Consistent spacing, empty states |
| Dashboard overview | D | Summary cards |
| Demo copy refinements | A | Clear story and safety language |
| Final seed setup | A + C | Demo scenario ready |

### Feature Freeze Rule

At **12:00 on Day 3**, stop adding features.

After that point, only allow:

- Bug fixes.
- UI polish.
- Performance improvements.
- Demo data fixes.
- Copy fixes.
- Deployment fixes.
- Accessibility improvements.

---

## Day 3 Afternoon: 13:00–17:00

| Task | Owner | Target |
|---|---|---|
| T-603 full QA checklist | A | All flows verified |
| Fix critical bugs | B/C/D | Stable app |
| Run offline demo | B | Confirm cached plan and queue |
| Run AI fallback demo | D | Confirm mock mode |
| Run deployment health checks | C | Stable containers |
| Pitch deck completion | A | Final deck |
| Architecture slide | C | Technical credibility |
| AI safety slide | D | Explain human-in-loop |
| Product story slide | A | Problem → solution → impact |

---

## Day 3 Evening: 18:00–Final

| Task | Owner | Target |
|---|---|---|
| Full demo rehearsal #1 | All | Identify issues |
| Fix only demo-blocking issues | All | Stable |
| Full demo rehearsal #2 | All | Smooth timing |
| Record fallback video | A + B | Backup |
| Prepare browser tabs | All | Demo environment ready |
| Reset seeded database | C | Clean data |
| Final task board review | A | No hidden blockers |
| Sleep / stop risky changes | All | Protect stability |

---

# 9. Demo Script and Feature Mapping

## 9.1 Recommended 5-Minute Demo

### Minute 0:00–0:30 — Problem

> During flooding, residents often receive fragmented information but do not know what to do next, which local plan to follow, or whether a report has been reviewed.

### Minute 0:30–1:15 — Tandara Warga

Show:

- Region selection.
- Published plan.
- Owner and review date.
- Preparedness checklist.
- Offline save button.

### Minute 1:15–2:00 — Offline Resilience

Show:

- Browser airplane/offline mode.
- Saved plan still available.
- Last updated timestamp.
- Submit report while offline.
- Status:
  > Saved Offline — Not Submitted Yet.

### Minute 2:00–2:45 — Synchronization

Restore connection.

Show:

- Report queue sync.
- Submission confirmation.
- Clear label:
  > Community Report — Awaiting Review.

### Minute 2:45–4:15 — Tandara Posko

Show:

- Coordinator inbox.
- New report.
- Raw report beside AI suggestion.
- AI’s missing-information flag.
- Possible duplicate report.
- Coordinator accepts/edits AI suggestion.
- Coordinator marks report reviewed.

### Minute 4:15–4:45 — Privacy

Show:

- Restricted help request.
- Only coordinator can access it.
- Public report feed does not reveal sensitive data.

### Minute 4:45–5:00 — Closing

> Tandara does not predict floods or issue evacuation orders. It closes the last-mile preparedness gap by helping communities turn fragmented local signals into trusted, actionable readiness.

---

# 10. Definition of Done for the Entire MVP

The MVP is complete only if all items below are true.

## Resident Flow

- [ ] Resident can select a region.
- [ ] Resident can view a published plan.
- [ ] Plan displays owner, version, review date, and disclaimer.
- [ ] Resident can use a checklist.
- [ ] Checklist persists after refresh.
- [ ] Resident can submit a report while online.
- [ ] Resident can create a report while offline.
- [ ] Offline report is queued.
- [ ] Queued report can synchronize.
- [ ] Resident sees clear report status.

## Coordinator Flow

- [ ] Coordinator can log in.
- [ ] Coordinator can view report inbox.
- [ ] Coordinator can open raw report details.
- [ ] Coordinator can see AI suggestion separately.
- [ ] Coordinator can see possible duplicate.
- [ ] Coordinator can mark a report reviewed.
- [ ] Coordinator can restrict a sensitive help request.
- [ ] Coordinator cannot accidentally auto-publish AI output.
- [ ] Coordinator actions are persisted.

## Trust and Safety

- [ ] AI is labeled as a suggestion.
- [ ] Simulation data is clearly labeled.
- [ ] Offline content shows last-updated timestamp.
- [ ] No-data areas are not called safe.
- [ ] Help request includes no-guarantee disclaimer.
- [ ] Community report is visibly different from local plan.
- [ ] Public user cannot access sensitive data.

## Technical

- [ ] API health endpoint works.
- [ ] Database migrations work.
- [ ] Seed script works.
- [ ] Docker Compose starts services.
- [ ] VPS deployment works.
- [ ] HTTPS works.
- [ ] Demo can run in mock AI mode.
- [ ] No API secrets are in frontend code.
- [ ] Core flows work on mobile dimensions.

---

# 11. Quality Gates

## Gate 1 — End of Day 1

Must be true:

- Resident report form works.
- API saves reports.
- Coordinator sees reports.
- Database is stable.
- No critical authentication issue.

If not true: remove all optional features.

---

## Gate 2 — End of Day 2

Must be true:

- Plan works.
- Offline draft works.
- Coordinator review works.
- AI mock works.
- Duplicate candidate works.
- Sensitive help request is protected.

If not true: reduce map scope and remove live AI integration.

---

## Gate 3 — Midday Day 3

Must be true:

- Deployed app works.
- Demo flow works without live external data.
- No major UI navigation issue.
- Seed reset works.
- Offline fallback works.

If not true: stop polishing and fix only flow-breaking issues.

---

# 12. Risk Management

| Risk | Likelihood | Impact | Mitigation |
|---|---:|---:|---|
| Team attempts too many features | High | High | Strict MVP list and Day 3 feature freeze |
| AI API fails | Medium | High | Deterministic mock AI provider |
| VPS deployment fails | Medium | High | Local Docker fallback and deploy early |
| Offline mode is unreliable | Medium | High | Test early on Day 2; use simple IndexedDB queue |
| Map consumes too much time | High | Medium | Use text location list; map is optional |
| Auth takes too long | Medium | Medium | Use one seeded coordinator login |
| Database migrations conflict | Medium | High | Person C owns migrations; no parallel schema changes without review |
| UI inconsistency | Medium | Medium | Person A owns design tokens and copy |
| Git merge conflicts | High | Medium | Clear code ownership and small commits |
| Demo data gets modified | Medium | High | Seed reset script and backup database |
| External APIs are unstable | High | Medium | Use simulation data only |
| Unclear team communication | Medium | High | 10-minute stand-ups and task board |

---

# 13. Git Workflow

## Branch Rules

```text
main                  Stable, deployable
feature/resident-pwa  Person B
feature/backend-api   Person C
feature/posko-ai      Person D
feature/design-assets Person A
```

## Rules

1. Never push untested experimental code directly to `main`.
2. Commit small, logical changes.
3. Use descriptive commits:
   ```text
   feat(report): add offline report queue
   fix(auth): protect coordinator routes
   feat(ai): add deterministic triage provider
   style(plan): improve offline status card
   ```
4. Person C approves database migration changes.
5. Person A approves user-facing copy and core UX changes.
6. Before merge, run:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   ```

---

# 14. Suggested Task Board Structure

Use GitHub Projects, Notion, Linear, or Trello.

## Columns

```text
Backlog
Ready
In Progress
Code Review
Testing
Done
Blocked
```

## Labels

```text
P0 — Critical
P1 — High
P2 — Nice to Have
frontend
backend
dashboard
ai
offline
infra
design
qa
demo
```

## Rule

No one should have more than **two tasks in progress** simultaneously.

---

# 15. If Only Three People Total Are Available

If the actual active team is:

- 2 technical people
- 1 non-technical/product person

then reduce scope further.

## Team Structure

| Person | Scope |
|---|---|
| Person A | Product, UI/UX, QA, pitch, seed data |
| Person B | Frontend for Warga + Posko |
| Person C | Backend + database + AI mock + deployment |

## Features to Remove First

1. Full interactive map.
2. Plan editor.
3. Live AI provider.
4. Photo upload.
5. Drill module.
6. Detailed analytics.
7. Separate duplicate page; show duplicate on report detail only.
8. Complex authorization; one coordinator role is enough.

## Three-Person MVP

```text
Resident plan
Resident checklist
Resident report form
Offline report draft
Coordinator login
Coordinator inbox
AI mock triage
Coordinator review action
Duplicate suggestion in report detail
Restricted help-request card
```

This is still strong enough for a hackathon.

---

# 16. Final Recommended MVP Cut

For the highest chance of finishing with quality, build exactly this:

## Tandara Warga

1. Region selection.
2. Home.
3. Preparedness plan.
4. Offline save plan.
5. Checklist.
6. Report form.
7. Offline queue.
8. Submission status.

## Tandara Posko

1. Coordinator login.
2. Dashboard.
3. Inbox.
4. Report detail.
5. AI suggestion.
6. Duplicate candidate.
7. Human review action.
8. Restricted help request.

## System

1. PostgreSQL/PostGIS.
2. NestJS API.
3. Seed data.
4. Deterministic AI fallback.
5. Docker Compose.
6. VPS deployment.
7. QA checklist.
8. Backup demo video.

---

# 17. Final Team Rule

> **A polished, reliable, safe prototype with six completed features is far stronger than a broken prototype with twenty unfinished features.**

For Tandara, prioritize:

1. **Trust**
2. **Clarity**
3. **Offline resilience**
4. **Human verification**
5. **A smooth end-to-end demo**

Do not sacrifice those principles for unnecessary complexity.
