# PRD — Product Requirements Document

This requirements document includes historical foundation-stage planning from
main. Refer to the [completion matrix](product/requirements-matrix.md) and
[delivery report](DELIVERY.md) for the implemented product and its verified limits.

# **TANDARA**

## _From Local Signals to Shared Readiness._

**Document status:** Comprehensive Product Requirements Document  
**Version:** 1.1  
**Product stage:** Hackathon prototype → Closed community pilot → Multi-region platform  
**Primary language:** Bahasa Indonesia  
**Document language:** English  
**Initial hazard scope:** Flooding and flood-related access disruption  
**Platforms:** Resident Progressive Web App (PWA), Coordinator Web Dashboard, Platform Administration Console  
**Deployment approach:** Self-hosted VPS infrastructure using Docker Compose  
**Core stack:** React + Vite, NestJS + Fastify, PostgreSQL + PostGIS, Redis + BullMQ, S3-compatible storage, Caddy  
**Safety boundary:** Tandara is **not** an official warning authority, flood prediction system, evacuation command system, emergency dispatch service, or replacement for BMKG, BNPB, BPBD, emergency services, radio, sirens, or local government instructions.

---

# 1. Document Control

| Field                    | Value                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| Product name             | Tandara                                                                                              |
| Internal codename        | Tandara Community Readiness Platform                                                                 |
| Product owner            | To be assigned                                                                                       |
| Technical owner          | To be assigned                                                                                       |
| Security owner           | To be assigned before pilot                                                                          |
| Pilot organization owner | To be assigned before real-world deployment                                                          |
| Target users             | Residents, community coordinators, volunteers, local organizations                                   |
| Primary use case         | Community flood preparedness and local information coordination                                      |
| Initial market           | Indonesian flood-prone communities                                                                   |
| Release strategy         | Prototype → closed pilot → limited public pilot → multi-region                                       |
| Last updated             | 2026                                                                                                 |
| Name availability        | Must be checked through trademark, domain, app-store, and social-media searches before public launch |

---

# 2. Executive Summary

## 2.1 Product Overview

Tandara is a community preparedness platform designed to help residents and local coordinators make sense of fragmented disaster-related information before and during flooding.

In flood-prone communities, critical information is often scattered across:

- Official warning channels.
- Neighborhood messaging groups.
- Social media.
- Community leaders.
- Resident observations.
- Local evacuation plans.
- Static maps.
- Volunteer coordination channels.

The challenge is not only a lack of information. It is the lack of a **trusted, locally relevant, clearly structured path from information to preparedness action**.

Tandara provides:

1. A resident-facing Progressive Web App for preparedness plans, offline checklists, local contacts, and community reporting.
2. A coordinator dashboard for reviewing reports, managing local preparedness plans, handling follow-up requests, and coordinating drills.
3. AI-assisted triage that structures reports and flags uncertainty but does not make safety-critical decisions.
4. An offline-first experience for saved plans and queued reports.
5. A local-plan governance workflow with plan owners, review dates, versions, and audit logs.

---

## 2.2 Product Statement

> **Tandara transforms fragmented local signals, preparedness plans, and community reports into clearer shared readiness—without replacing official disaster authorities.**

---

## 2.3 Primary Problem

Residents in flood-prone communities may receive information too late, receive conflicting information, or not understand what action to take after a warning or local danger signal appears.

They may ask:

- Is this message official or only a rumor?
- Is there flooding near my neighborhood?
- What should my family prepare now?
- Where is the locally agreed meeting point?
- Is the plan still valid?
- Which contact should I call?
- Can I access the plan without internet?
- Has anyone reviewed this community report?
- Which neighborhoods have not reported any information yet?
- Who may need extra assistance?

Community coordinators face a parallel problem:

- Too many unstructured reports in chat groups.
- Difficulty identifying duplicate reports.
- Limited time to verify information.
- No consistent report status system.
- Outdated local preparedness plans.
- Lack of audit trails and ownership.
- Risk of accidentally publishing misleading information.

---

## 2.4 Core Product Insight

The product should not attempt to replace official early-warning infrastructure.

Instead, Tandara addresses the **last-mile preparedness and coordination gap**:

> The critical period between receiving a warning or observing a local problem and knowing what the household or community should do next.

---

# 3. Product Vision, Mission, and Principles

## 3.1 Vision

Communities in disaster-prone areas can access understandable, locally relevant, source-labeled preparedness information and coordinate safely before a hazard becomes an emergency.

---

## 3.2 Mission

Help residents and community coordinators turn local signals into practical preparedness action through trusted plans, transparent status labels, accessible reporting, human review, and offline-ready information.

---

## 3.3 Product Principles

### Principle 1 — Trust must be visible

Every important information card must show:

- Source.
- Status.
- Timestamp.
- Geographic scope.
- Review state.
- Whether it is official, community-generated, AI-generated, or simulation data.

---

### Principle 2 — Unknown is safer than invented

The product must never guess missing information.

If a report does not contain an exact location, it must say:

> “Location unknown”  
> or  
> “Location requires clarification.”

It must not infer a location from ambiguous wording.

---

### Principle 3 — AI assists; humans decide

AI may help classify, summarize, identify duplicates, and flag ambiguity.

AI must never:

- Issue official alerts.
- Declare a location safe.
- Decide evacuation instructions.
- Decide aid eligibility.
- Verify a report automatically.
- Publish a report without human approval.

---

### Principle 4 — No reports does not mean safe

An area with no recent reports must display:

> **No recent information available**

It must never display:

> Safe  
> No flood  
> No danger

unless supported by an explicitly authorized and validated data source.

---

### Principle 5 — Offline does not mean current

Saved offline plans must visibly display:

- Last updated timestamp.
- Plan version.
- Offline status.
- Notice that conditions may have changed.

---

### Principle 6 — Local plans require local ownership

Every published local preparedness plan must have:

- A named plan owner.
- An organization owner.
- An effective date.
- A mandatory review date.
- A version number.
- A publication status.
- A change history.

---

### Principle 7 — Privacy is part of safety

The application must collect only the minimum data required to support preparedness and reporting.

Sensitive data, especially help requests and exact locations, must not be visible publicly.

---

### Principle 8 — Accessibility is a core requirement

Tandara must not assume that all residents:

- Can read maps.
- Have high-end smartphones.
- Have stable internet.
- Can distinguish colors.
- Can use GPS.
- Can hear audio alerts.
- Can read complex technical language.

---

# 4. Sustainability Positioning

Tandara supports sustainability through community resilience, inclusive access to preparedness information, and long-term local capacity building.

| Sustainability dimension     | Tandara contribution                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Social sustainability        | Helps residents, including vulnerable groups, access local preparedness information and participate in community readiness. |
| Climate resilience           | Supports adaptation to climate-related flooding through planning, drills, local reporting, and preparedness knowledge.      |
| Institutional sustainability | Preserves local plans, ownership, review schedules, and community knowledge beyond individual volunteers.                   |
| Digital sustainability       | Uses a lightweight web-first architecture, self-hosted deployment, modular services, and offline-friendly design.           |
| Operational sustainability   | Supports phased rollout, local configuration, local ownership, and reusable regional templates.                             |

### Relevant Sustainable Development Goals

| SDG                                         | Contribution                                                                            |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| SDG 11 — Sustainable Cities and Communities | Supports disaster resilience and inclusive local preparedness.                          |
| SDG 13 — Climate Action                     | Supports adaptation and community capacity for climate-related flood risk.              |
| SDG 3 — Good Health and Well-being          | Improves access to preparedness guidance and safer coordination.                        |
| SDG 10 — Reduced Inequalities               | Includes accessibility, low-bandwidth, and low-literacy design considerations.          |
| SDG 17 — Partnerships for the Goals         | Requires collaboration among communities, local organizations, and public institutions. |

---

# 5. Goals and Non-Goals

## 5.1 Product Goals

| ID   | Goal                                                                               |
| ---- | ---------------------------------------------------------------------------------- |
| G-01 | Help residents access and understand local preparedness plans.                     |
| G-02 | Allow residents to save essential preparedness information for offline use.        |
| G-03 | Enable structured, source-labeled community condition reporting.                   |
| G-04 | Help coordinators review, categorize, and manage reports efficiently.              |
| G-05 | Make uncertainty visible instead of hiding it behind automated conclusions.        |
| G-06 | Maintain local plan ownership, versioning, and review dates.                       |
| G-07 | Support community drills and preparedness learning.                                |
| G-08 | Protect sensitive data through role-based access and privacy-by-design practices.  |
| G-09 | Provide an architecture that can be self-hosted on a VPS and expanded gradually.   |
| G-10 | Deliver a polished, credible hackathon prototype with realistic safety boundaries. |

---

## 5.2 Non-Goals

| ID    | Non-goal                                                                                                    |
| ----- | ----------------------------------------------------------------------------------------------------------- |
| NG-01 | Tandara will not predict floods using its own AI model.                                                     |
| NG-02 | Tandara will not replace BMKG, BNPB, BPBD, emergency services, sirens, radio, or official warning channels. |
| NG-03 | Tandara will not issue evacuation orders.                                                                   |
| NG-04 | Tandara will not label routes as universally safe.                                                          |
| NG-05 | Tandara will not provide real-time emergency dispatch guarantees.                                           |
| NG-06 | Tandara will not track residents continuously.                                                              |
| NG-07 | Tandara will not make automated aid-priority decisions.                                                     |
| NG-08 | Tandara will not support every disaster type in the initial release.                                        |
| NG-09 | Tandara will not claim nationwide emergency readiness after a hackathon prototype.                          |
| NG-10 | Tandara will not use AI output as verified fact without human review.                                       |

---

# 6. Scope and Release Strategy

## 6.1 Release Phases

| Phase   | Name                 | Scope                                                                               | Success Gate                                               |
| ------- | -------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Phase 0 | Discovery            | User interviews, workflow mapping, data source review, pilot partner identification | A real community need and operating partner are identified |
| Phase 1 | Hackathon Prototype  | Simulated neighborhood, end-to-end report flow, AI triage, offline plan             | Demo works reliably using simulation data                  |
| Phase 2 | Closed Pilot         | One community, selected coordinators, real plan validation, limited users           | Governance, privacy, and moderation workflows work         |
| Phase 3 | Limited Public Pilot | Community drills, controlled resident access, usage evaluation                      | Measurable preparedness and usability improvement          |
| Phase 4 | Multi-Region Pilot   | Multiple local configurations and partner organizations                             | Multi-tenant governance and support model validated        |
| Phase 5 | Scale Readiness      | Operational model, backups, monitoring, support, legal review                       | Sustainable ownership and infrastructure exist             |

---

## 6.2 Hackathon MVP Scope

The hackathon MVP must prioritize depth over breadth.

### Included

- One simulated neighborhood or flood-prone area.
- Resident PWA.
- Coordinator dashboard.
- Local preparedness plan.
- Offline saved plan.
- Household checklist.
- Community report form.
- AI-assisted report triage.
- Duplicate-report suggestion.
- Coordinator review workflow.
- Basic map view.
- Report status labels.
- Help-request visibility restrictions.
- Audit log for critical coordinator actions.
- Simulation mode.

### Excluded

- Live official alert integrations.
- Production emergency dispatch.
- National map coverage.
- Full native mobile application.
- Dynamic route planning.
- Full offline map downloads.
- Payment systems.
- Complex multi-agency command center.
- Machine-learning flood prediction.
- Automatic bulk notifications.
- Public launch without a local partner.

---

# 7. Personas

## 7.1 Persona A — Resident

**Name:** Sari  
**Age:** 34  
**Profile:** Resident in a flood-prone neighborhood. Uses an Android device with inconsistent mobile data. Participates in local community groups but is not a formal volunteer.

### Goals

- Know what to prepare before floods.
- Access a local plan quickly.
- Understand whether information is trustworthy.
- Save instructions for offline access.
- Report a local condition.
- Request follow-up without exposing private contact information publicly.

### Pain Points

- Chat groups contain too many conflicting messages.
- Unsure whether local information is official.
- Does not always have internet access.
- Finds maps difficult to understand.
- Does not know if her family plan is current.

---

## 7.2 Persona B — Community Coordinator

**Name:** Budi  
**Age:** 42  
**Profile:** Local RT/RW coordinator, volunteer, or community organization member responsible for receiving reports and coordinating preparedness activities.

### Goals

- Review reports efficiently.
- Identify duplicate reports.
- Understand which areas lack information.
- Manage local preparedness plans.
- Protect personal data.
- Organize drills and identify common preparedness gaps.

### Pain Points

- Reports arrive in unstructured chat messages.
- Difficult to separate rumors from observations.
- Volunteers have limited availability.
- Existing plans may be outdated.
- There is no audit history for decisions.

---

## 7.3 Persona C — Community Organization Administrator

**Name:** Maya  
**Profile:** NGO, village organization, local resilience team, or community-based disaster preparedness group.

### Goals

- Maintain organization members and roles.
- Manage supported regions.
- Review plan governance.
- View aggregate drill outcomes.
- Export non-sensitive insights.

---

## 7.4 Persona D — Resident With Accessibility Needs

**Name:** Pak Rahmat  
**Profile:** Older adult with reduced vision and limited mobility.

### Needs

- Large text.
- High contrast.
- Simple instructions.
- Clear non-map alternative.
- Accessible local contact information.
- Information about assistance procedures.
- Minimal cognitive load.

---

# 8. Jobs To Be Done

| User                       | Job to be done                                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Resident                   | When flooding risk increases, help me understand what I should prepare and where to find the latest local plan.       |
| Resident                   | When I see a local problem, help me report it without requiring complex forms or constant connectivity.               |
| Resident                   | When internet access is unavailable, help me still access essential local preparedness information.                   |
| Coordinator                | When reports arrive, help me quickly understand what is being reported, what is uncertain, and what requires review.  |
| Coordinator                | When local plans change, help me update them with ownership, version history, and review dates.                       |
| Organization administrator | When managing several coordinators, help me control access to sensitive information and maintain accountability.      |
| Drill facilitator          | When running a preparedness simulation, help me measure whether participants understand plans and information labels. |

---

# 9. Product Architecture Overview

```text
Tandara Warga (resident PWA) ----┐
                               ├── HTTPS /api ── API ── PostgreSQL/PostGIS
Tandara Posko (dashboard) ------┘                  │
                                                 └── durable outbox
                                                      ↓
                                               Redis + worker
                                                      ↓
                                          Human-reviewed AI suggestions
```

Source structure and dependency boundaries are defined in ARCHITECTURE.md.
API and worker share server modules. Media and production deployment are deferred
in the three-day simulation MVP; storage will use a maintained S3-compatible adapter.

---

# 10. User Roles and Access Model

## 10.1 Roles

| Role                       | Description                                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Public Visitor             | Can view published public preparedness information.                                                                   |
| Resident                   | Can save plans, manage local checklist, submit reports, and view own submission status.                               |
| Reviewer                   | Can view assigned reports and add review decisions.                                                                   |
| Coordinator                | Can review reports, manage local plans, see restricted help requests for assigned regions, and manage drills.         |
| Organization Administrator | Can manage organization members, roles, region configuration, and plan publication workflows.                         |
| Platform Administrator     | Can manage all organizations, regions, infrastructure configuration, data retention, and platform-level audit access. |
| System Worker              | Non-human service account for background jobs; has minimum required permissions.                                      |

---

## 10.2 Permission Matrix

| Capability                  |                        Public |            Resident |      Reviewer |   Coordinator | Org Admin | Platform Admin |
| --------------------------- | ----------------------------: | ------------------: | ------------: | ------------: | --------: | -------------: |
| View published plans        |                           Yes |                 Yes |           Yes |           Yes |       Yes |            Yes |
| Save offline plan           |                           Yes |                 Yes |           Yes |           Yes |       Yes |            Yes |
| Submit report               | Guest submission with receipt |                 Yes |           Yes |           Yes |       Yes |            Yes |
| View own report             |                            No |                 Yes |           Yes |           Yes |       Yes |            Yes |
| View all reports in region  |           Limited public only | Limited public only | Assigned only |           Yes |       Yes |            Yes |
| Review report               |                            No |                  No |           Yes |           Yes |       Yes |            Yes |
| View help-request details   |                            No |            Own only | Assigned only | Assigned only |       Yes |            Yes |
| Manage plans                |                            No |                  No |            No |           Yes |       Yes |            Yes |
| Publish plan                |                            No |                  No |            No |       Limited |       Yes |            Yes |
| Manage roles                |                            No |                  No |            No |            No |       Yes |            Yes |
| View audit logs             |                            No |                  No |       Limited |       Limited |       Yes |            Yes |
| Manage system configuration |                            No |                  No |            No |            No |        No |            Yes |

---

# 11. Functional Requirements

# 11.1 Tandara Warga — Resident PWA

## FR-R01 — Region Selection

Residents must be able to select a supported region manually.

### Requirements

- Users can search and select a configured region.
- Users may optionally use device location after permission is granted.
- GPS location must not be mandatory.
- Users can change region manually.
- The application must explain why location permission is requested.
- Region-specific preparedness content must update after selection.

### Acceptance Criteria

- A user can access preparedness content without enabling GPS.
- A user can switch between supported regions.
- The selected region persists locally.
- Region selection works on low-bandwidth connections.

---

## FR-R02 — Home Situation Screen

The resident home screen must display:

- Current selected region.
- Network connection status.
- Last synchronization time.
- Link to local preparedness plan.
- Household preparedness checklist.
- Community reports, clearly labeled by status.
- Local contacts.
- Drill or simulation content, clearly marked.
- “Submit Report” action.
- “Ask for Follow-up” action.
- Safety disclaimer.

### Required Information Labels

| Type                       | Required label                  |
| -------------------------- | ------------------------------- |
| Official-source content    | Official Information            |
| Local approved plan        | Published Local Plan            |
| Community submission       | Community Report                |
| Unreviewed content         | Awaiting Review                 |
| Reviewed community content | Reviewed by Local Coordinator   |
| AI output                  | AI Suggestion — Not Verified    |
| Drill content              | Simulation / Drill              |
| Cached content             | Saved Offline                   |
| Stale content              | Last Updated: [timestamp]       |
| Missing information        | No Recent Information Available |

---

## FR-R03 — Local Preparedness Plan

Each plan must include:

- Plan title.
- Supported region.
- Hazard type.
- Plan owner.
- Organization owner.
- Plan status.
- Effective date.
- Next review date.
- Version number.
- Preparation checklist.
- Meeting-point information where validated.
- Local contacts.
- Accessibility notes.
- Emergency disclaimer.
- Printable version.
- Offline save option.

### Required Plan Statuses

```text
Draft
Under Review
Published
Expired
Archived
```

### Plan Safety Disclaimer

> This plan reflects locally managed information as of the displayed review date. Actual conditions may change. Follow instructions from authorized officials and avoid entering dangerous areas.

---

## FR-R04 — Household Preparedness Checklist

The checklist must support region-configurable tasks.

### Default Checklist Items

- Save important documents in a waterproof container.
- Prepare drinking water.
- Prepare essential medication.
- Prepare flashlight and power bank.
- Identify family communication arrangements.
- Save emergency contacts.
- Identify household members requiring assistance.
- Prepare mobility aids, baby supplies, or accessibility needs.
- Download the latest local plan.
- Confirm the meeting arrangement.

### Requirements

- Completion state is stored locally.
- Completion state is private by default.
- Users can reset the checklist.
- Coordinators can view only aggregate drill metrics, not public individual scores.
- Tasks must be understandable in plain language.

---

## FR-R05 — Community Condition Reporting

Residents must be able to submit structured reports.

### Required Fields

| Field                         | Required | Description                         |
| ----------------------------- | -------: | ----------------------------------- |
| Report category               |      Yes | Selected from configured categories |
| Short description             |      Yes | Free text with character limit      |
| Observation time              | Optional | “Unknown” allowed                   |
| Location                      | Optional | GPS, map pin, landmark, or text     |
| Photo                         | Optional | Image attachment                    |
| Follow-up request             | Optional | Can request coordinator follow-up   |
| Contact permission            | Optional | Separate consent for follow-up      |
| Accessibility/assistance flag | Optional | Generic support category only       |

### Initial Report Categories

```text
Road flooding
Water entering homes
Blocked road or access
Debris or fallen tree
Damaged facility
Potentially vulnerable resident needs follow-up
Other local condition
```

### Requirements

- Residents can save a report draft locally.
- Residents can submit a report when online.
- Offline reports must be stored in a local queue.
- Residents must see whether the report is:
  - Draft
  - Saved Offline
  - Queued for Submission
  - Submitted
  - Under Review
  - Clarification Requested
  - Reviewed
  - Closed
- Public reports must not expose contact details.
- Exact resident coordinates must be generalized before public display.

---

## FR-R06 — Help / Follow-Up Request

This feature is not an emergency dispatch system.

### Requirements

- Residents can request follow-up from configured local coordinators.
- The application must clearly state that response is not guaranteed.
- Help requests must be visible only to authorized users.
- Residents may enter:
  - Request category.
  - Approximate location.
  - Optional callback contact.
  - Optional urgency indicator selected from non-medical categories.
- The application must show alternative official emergency contact guidance.

### Mandatory Disclaimer

> Tandara does not guarantee emergency response or rescue. If you are in immediate danger, contact authorized emergency services and follow official local instructions.

---

## FR-R07 — Offline Mode

The PWA must support offline access to selected critical information.

### Offline Content

| Content                     | Offline availability |
| --------------------------- | -------------------- |
| Application shell           | Yes                  |
| Saved preparedness plan     | Yes                  |
| Household checklist         | Yes                  |
| Local contact list          | Yes                  |
| Report drafts               | Yes                  |
| Queued reports              | Yes                  |
| Latest live reports         | No guarantee         |
| Full interactive map        | Not required for MVP |
| Sensitive help-request data | No                   |

### Offline Requirements

- Offline status is visible.
- Cached content displays last synchronization time.
- Users can create report drafts offline.
- Queued reports automatically retry when connectivity returns.
- Sync failure is visible and actionable.
- No cached content may appear to be live.

---

# 11.2 Tandara Posko — Coordinator Dashboard

## FR-C01 — Secure Authentication

The coordinator dashboard must support:

- Email and password authentication.
- Secure password hashing.
- Email verification.
- Password reset flow.
- Session expiration.
- Refresh-token rotation or secure session cookies.
- Role-based access control.
- Audit logs for role changes.

---

## FR-C02 — Report Inbox

The coordinator report inbox must include:

- Report list.
- Status filter.
- Category filter.
- Region filter.
- Time range filter.
- Source filter.
- Follow-up request filter.
- AI ambiguity filter.
- Search by text or landmark.
- Report age indicator.
- Reviewer assignment.
- Report status labels.
- Ability to view original report content.

### Required Views

```text
All Reports
Unreviewed
Under Review
Clarification Requested
Help Requests
Reviewed
Closed
Potential Duplicates
Simulation Reports
```

---

## FR-C03 — Report Detail View

Each report detail page must show:

- Original report text.
- Original observation time.
- Submission timestamp.
- Report category.
- Location data with privacy controls.
- Uploaded media.
- Resident contact information only when permission exists.
- AI triage result.
- Potential duplicate reports.
- Review history.
- Internal coordinator notes.
- Audit history.
- Public visibility state.

---

## FR-C04 — Human Review Workflow

A coordinator must be able to perform the following actions:

```text
Mark as Under Review
Accept AI Suggestion
Edit AI Suggestion
Reject AI Suggestion
Request Clarification
Assign Reviewer
Mark as Reviewed
Publish as Community Information
Restrict Public Visibility
Close as Duplicate
Close as Outdated
Close as Inappropriate / Suspicious
Add Internal Note
Assign Follow-Up Owner
```

### Requirements

- Human review must be required before status becomes “Reviewed.”
- AI must not change public status automatically.
- Reviewers must provide a reason for closing or restricting reports.
- Every status change must be stored in an audit log.
- The original report must remain visible to authorized reviewers.

---

## FR-C05 — Duplicate Report Management

The system may suggest possible duplicate reports based on:

- Similar text.
- Similar category.
- Time proximity.
- Approximate location proximity.
- Similar landmarks.
- Similar media hash, if applicable.

### Requirements

- Duplicate detection must only produce suggestions.
- A coordinator must confirm before merging or closing a report.
- Merged reports must preserve links to original records.
- False duplicate decisions must be reversible.
- The UI must explain why reports are considered potentially similar.

### Example Explanation

> These reports may describe the same event because they were submitted within 12 minutes, are both near the community hall, and mention road flooding.

---

## FR-C06 — Local Plan Management

Coordinators must be able to:

- Create plans.
- Edit plans.
- Create plan versions.
- Add or remove local contacts.
- Add meeting points.
- Add plan notes.
- Add accessibility notes.
- Assign plan owner.
- Set effective and review dates.
- Submit for review.
- Publish plans.
- Archive expired plans.
- View version history.
- Export printable plan versions.

### Plan Workflow

```text
Draft
   ↓
Under Review
   ↓
Approved for Publication
   ↓
Published
   ↓
Expired or Archived
```

### Publishing Rules

A plan cannot be published without:

- Region assignment.
- Hazard type.
- Named plan owner.
- Organization owner.
- Effective date.
- Review date.
- Version number.
- Required disclaimer.
- At least one review record.

---

## FR-C07 — Coverage Gap View

The coordinator dashboard may display a zone or grid map showing:

- Areas with recent reports.
- Areas with reviewed reports.
- Areas with no recent reports.
- Last report timestamp by zone.
- Number of reports by category.

### Restrictions

The system must not:

- Label an area “safe” because it lacks reports.
- Generate a safety score without an approved methodology.
- Present report density as a direct measure of hazard level.
- Infer flood depth or severity from report volume alone.

---

## FR-C08 — Drill Management

Coordinators must be able to:

- Create drill scenarios.
- Assign a region.
- Set drill start and end times.
- Configure drill instructions.
- Add learning questions.
- Mark content as simulation.
- Track aggregate participation.
- Review aggregate comprehension results.
- Export anonymous drill insights.

### Drill Data Separation

All drill reports and drill interactions must include:

```text
is_simulation = true
```

Simulation data must never appear in real incident maps or real report queues unless explicitly filtered.

---

# 11.3 Platform Administration

## FR-A01 — Organization Management

Platform administrators must be able to:

- Create organizations.
- Suspend organizations.
- Assign organization administrators.
- Configure organization regions.
- Configure retention policy.
- View organization audit history.
- Configure supported report categories.

---

## FR-A02 — Region Configuration

Each region must support configuration of:

- Name.
- Geographic boundary.
- Hazard types.
- Supported language.
- Local terminology.
- Local contacts.
- Preparedness-plan templates.
- Meeting-point policy.
- Reporting categories.
- Public visibility settings.
- Local operating organization.
- Plan review frequency.
- Data source configuration.

---

## FR-A03 — Audit Logs

The platform must create immutable audit events for:

- Authentication events.
- Role changes.
- Plan publication.
- Plan archive.
- Report status changes.
- Help-request access.
- Media download access.
- Data export.
- Integration configuration changes.
- System configuration changes.
- AI suggestion acceptance, edit, or rejection.

---

# 12. AI Triage Specification

## 12.1 AI Purpose

AI exists to reduce coordinator workload and make uncertainty visible.

It does not exist to make autonomous emergency decisions.

---

## 12.2 Allowed AI Features

| Feature                   | Input                            | Output                                                  | Required human review |
| ------------------------- | -------------------------------- | ------------------------------------------------------- | --------------------- |
| Category suggestion       | Report text                      | Suggested category                                      | Yes                   |
| Fact extraction           | Report text                      | Explicitly mentioned location, time, condition, request | Yes                   |
| Ambiguity detection       | Report text                      | Missing or unclear details                              | Yes                   |
| Duplicate suggestion      | Text, time, approximate location | Possible similar reports                                | Yes                   |
| Report summarization      | One or more reports              | Short traceable summary                                 | Yes                   |
| Translation suggestion    | Report text                      | Suggested translation                                   | Yes                   |
| Drill feedback clustering | Participant feedback             | Common themes                                           | Yes                   |

---

## 12.3 Prohibited AI Behavior

AI must not:

- Issue official disaster warnings.
- Verify whether a report is true.
- Declare routes safe.
- Instruct residents to evacuate.
- Rank who deserves aid.
- Infer sensitive attributes.
- Infer exact location from vague descriptions.
- Treat uploaded photos as proof of authenticity.
- Auto-publish community reports.
- Send emergency notifications automatically.
- Generate unsupported facts.

---

## 12.4 Structured AI Output

All model output must conform to a strict schema.

```json
{
  "suggested_category": "road_flooding",
  "confidence_band": "low",
  "explicit_facts": {
    "location_text": "near the community hall",
    "observation_time": "unknown",
    "water_condition": "road is flooded",
    "access_disruption": true,
    "assistance_request": false
  },
  "missing_information": ["exact location", "observation time"],
  "possible_duplicate_report_ids": [],
  "summary": "A resident reports road flooding near the community hall. The exact location and observation time are unclear.",
  "safety_note": "This is an AI suggestion and requires coordinator review."
}
```

---

## 12.5 AI Processing Flow

```text
Resident submits report
        ↓
Backend validates report
        ↓
Report stored as Submitted
        ↓
Background job added to Redis queue
        ↓
AI worker processes report
        ↓
AI output validated with schema
        ↓
AI result stored separately
        ↓
Coordinator receives report + AI suggestion
        ↓
Coordinator accepts, edits, or rejects suggestion
        ↓
Audit log captures human action
```

---

## 12.6 AI Failure Handling

If AI is unavailable:

- The report must still be saved.
- The report must still appear in the coordinator inbox.
- The coordinator can review manually.
- The system must display:
  > AI suggestion unavailable. Manual review required.
- No report may be blocked because an AI request failed.

---

# 13. Data Model

## 13.1 Main Entities

| Entity                       | Description                                                   |
| ---------------------------- | ------------------------------------------------------------- |
| `users`                      | Registered accounts.                                          |
| `organizations`              | Community organizations or operational partners.              |
| `organization_memberships`   | Role assignments within an organization.                      |
| `regions`                    | Configurable service regions.                                 |
| `preparedness_plans`         | Main local plan records.                                      |
| `preparedness_plan_versions` | Version history for plans.                                    |
| `plan_locations`             | Meeting points, facilities, landmarks, and local plan places. |
| `reports`                    | Resident-submitted condition reports.                         |
| `report_media`               | Attached images or files.                                     |
| `report_reviews`             | Human review records.                                         |
| `ai_triage_results`          | AI output and metadata.                                       |
| `duplicate_candidates`       | AI or rule-generated duplicate suggestions.                   |
| `help_requests`              | Restricted follow-up requests.                                |
| `drills`                     | Preparedness simulation records.                              |
| `drill_responses`            | Drill participation and comprehension data.                   |
| `external_source_items`      | Authorized imported data.                                     |
| `notifications`              | Notification events and delivery records.                     |
| `audit_logs`                 | Immutable activity records.                                   |
| `data_retention_rules`       | Configurable lifecycle rules.                                 |

---

## 13.2 Core Report Schema

```text
reports
├── id
├── region_id
├── submitted_by_user_id
├── category
├── description
├── observation_time
├── submitted_at
├── location
├── location_accuracy_meters
├── landmark_text
├── privacy_level
├── status
├── public_visibility
├── is_simulation
├── follow_up_requested
├── contact_permission
├── created_at
├── updated_at
└── deleted_at
```

---

## 13.3 PostGIS Data Types

```sql
regions.boundary              GEOMETRY(MULTIPOLYGON, 4326)
reports.location              GEOMETRY(POINT, 4326)
plan_locations.location       GEOMETRY(POINT, 4326)
coverage_cells.geometry       GEOMETRY(POLYGON, 4326)
```

### Required Geospatial Indexes

```sql
CREATE INDEX regions_boundary_gix
ON regions
USING GIST (boundary);

CREATE INDEX reports_location_gix
ON reports
USING GIST (location);

CREATE INDEX plan_locations_gix
ON plan_locations
USING GIST (location);
```

---

## 13.4 Data Privacy Levels

| Privacy level | Visibility                                                   |
| ------------- | ------------------------------------------------------------ |
| Public        | May be displayed to all users after review.                  |
| Community     | Visible to authenticated residents in the same region.       |
| Restricted    | Visible only to assigned coordinators.                       |
| Private       | Visible only to specific user and authorized administrators. |
| Internal      | Visible only to coordinators and administrators.             |

---

# 14. API Design

## 14.1 API Style

- REST API.
- JSON request and response format.
- OpenAPI documentation.
- Versioned endpoints.
- Server-side validation using Zod.
- Authentication through secure HTTP-only cookies or short-lived access tokens with refresh-token rotation.
- Rate limiting for sensitive endpoints.
- Request IDs for tracing.

---

## 14.2 Core API Endpoints

### Authentication

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
GET    /api/v1/auth/me
```

### Regions

```text
GET    /api/v1/regions
GET    /api/v1/regions/:regionId
GET    /api/v1/regions/:regionId/contacts
GET    /api/v1/regions/:regionId/plans
```

### Preparedness Plans

```text
GET    /api/v1/plans/:planId
POST   /api/v1/plans
PATCH  /api/v1/plans/:planId
POST   /api/v1/plans/:planId/submit-review
POST   /api/v1/plans/:planId/publish
POST   /api/v1/plans/:planId/archive
GET    /api/v1/plans/:planId/versions
```

### Community Reports

```text
POST   /api/v1/reports
GET    /api/v1/reports
GET    /api/v1/reports/:reportId
PATCH  /api/v1/reports/:reportId
POST   /api/v1/reports/:reportId/review
POST   /api/v1/reports/:reportId/request-clarification
POST   /api/v1/reports/:reportId/close
POST   /api/v1/reports/:reportId/assign
GET    /api/v1/reports/:reportId/ai-triage
```

### Help Requests

```text
POST   /api/v1/help-requests
GET    /api/v1/help-requests
GET    /api/v1/help-requests/:id
PATCH  /api/v1/help-requests/:id
POST   /api/v1/help-requests/:id/assign
POST   /api/v1/help-requests/:id/close
```

### Drills

```text
POST   /api/v1/drills
GET    /api/v1/drills
GET    /api/v1/drills/:drillId
POST   /api/v1/drills/:drillId/start
POST   /api/v1/drills/:drillId/complete
GET    /api/v1/drills/:drillId/analytics
```

### Media

```text
POST   /api/v1/media/upload-url
POST   /api/v1/media/complete-upload
GET    /api/v1/media/:mediaId/download-url
DELETE /api/v1/media/:mediaId
```

### System

```text
GET    /health
GET    /ready
GET    /metrics
```

---

# 15. Technical Stack

# 15.1 Frontend Stack

| Category         | Technology                          | Purpose                                            |
| ---------------- | ----------------------------------- | -------------------------------------------------- |
| Language         | TypeScript                          | Type safety across frontend and backend            |
| Framework        | React                               | Component-based user interface                     |
| Build tool       | Vite                                | Fast local development and optimized static builds |
| Routing          | React Router                        | Resident and coordinator route management          |
| State management | Zustand                             | Lightweight local client state                     |
| Data fetching    | TanStack Query                      | Caching, retries, request state, mutation handling |
| Form handling    | React Hook Form                     | Accessible, performant forms                       |
| Validation       | Zod                                 | Shared frontend/backend schemas                    |
| Styling          | Tailwind CSS                        | Consistent responsive UI development               |
| UI primitives    | Radix UI or shadcn/ui               | Accessible UI components                           |
| Maps             | MapLibre GL JS                      | Open-source map rendering                          |
| PWA              | vite-plugin-pwa + Workbox           | Service worker and cache management                |
| Offline data     | IndexedDB + Dexie.js                | Local plans, drafts, and offline queues            |
| Testing          | Vitest, Testing Library, Playwright | Unit, component, and end-to-end tests              |

---

# 15.2 Backend Stack

| Category              | Technology          | Purpose                                  |
| --------------------- | ------------------- | ---------------------------------------- |
| Language              | TypeScript          | Shared language with frontend            |
| Backend framework     | NestJS              | Structured modular backend               |
| HTTP adapter          | Fastify             | Efficient API handling                   |
| API style             | REST + OpenAPI      | Clear documented integration             |
| Validation            | Zod                 | Schema validation for API payloads       |
| Password hashing      | Argon2id            | Strong password security                 |
| Authentication        | JWT/session cookies | Secure user authentication               |
| Query builder         | Kysely              | Typed SQL with flexibility for PostGIS   |
| Database driver       | `pg`                | PostgreSQL connectivity                  |
| Background jobs       | BullMQ              | AI processing, notifications, sync tasks |
| Cache / queue backend | Redis               | Queue, rate limit, temporary cache       |
| Logging               | Pino                | Structured JSON logs                     |
| API documentation     | Swagger/OpenAPI     | Developer and QA documentation           |

---

# 15.3 Database Stack

| Component          | Technology                      | Purpose                                              |
| ------------------ | ------------------------------- | ---------------------------------------------------- |
| Database           | PostgreSQL 16+                  | Primary relational database                          |
| Spatial extension  | PostGIS                         | Geographic regions, report locations, spatial search |
| Text search        | `pg_trgm`                       | Similarity search and duplicate candidates           |
| Cryptography       | `pgcrypto`                      | UUIDs and cryptographic utility                      |
| Migration approach | SQL migrations                  | Transparent and auditable schema changes             |
| Backup             | `pg_dump` / WAL backup strategy | Database recovery                                    |

---

# 15.4 Infrastructure Stack

| Category           | Technology                  | Purpose                                             |
| ------------------ | --------------------------- | --------------------------------------------------- |
| Operating system   | Ubuntu LTS                  | Stable VPS operating system                         |
| Container runtime  | Docker Engine               | Containerized deployment                            |
| Orchestration      | Docker Compose              | MVP and pilot multi-service deployment              |
| Reverse proxy      | Caddy                       | HTTPS, reverse proxy, automatic certificate renewal |
| Object storage     | S3-compatible storage       | Private S3-compatible media storage                 |
| Container registry | GitHub Container Registry   | Store versioned deployment images                   |
| CI/CD              | GitHub Actions              | Testing, image build, deployment automation         |
| DNS/WAF            | Cloudflare optional         | DNS, DDoS protection, caching, firewall controls    |
| Error tracking     | Sentry                      | Frontend/backend exception monitoring               |
| Uptime monitoring  | Uptime Kuma                 | Health endpoint monitoring                          |
| Metrics later      | Prometheus + Grafana + Loki | Infrastructure and application observability        |

---

# 16. VPS Deployment Architecture

## 16.1 MVP Infrastructure

```text
Internet
   │
   ▼
Cloudflare DNS / Optional WAF
   │
   ▼
Caddy Reverse Proxy
   │
   ├── tandara.id              → Resident PWA
   ├── posko.tandara.id        → Coordinator Dashboard
   ├── api.tandara.id          → NestJS API
   └── minio-console.internal  → Restricted administration
                                     │
                                     ▼
                                Docker Compose
                                     │
        ┌──────────────────────┼───────────────────────┐
        │                      │                       │
        ▼                      ▼                       ▼
  PostgreSQL + PostGIS       Redis                  S3-compatible storage
        │                      │                       │
        └─────────────┬────────┘                       │
                      ▼                                │
                NestJS API                         Worker Service
                                                   AI / Sync / Jobs
```

---

## 16.2 Docker Services

```text
caddy
resident-web
coordinator-web
api
worker
postgres
redis
minio
backup
uptime-kuma
```

---

## 16.3 Network Segmentation

```text
public-network
├── caddy
├── resident-web
├── coordinator-web
└── api

application-network
├── api
├── worker
└── redis

data-network
├── api
├── worker
├── postgres
├── redis
└── minio
```

### Security Rules

- Only Caddy exposes ports `80` and `443`.
- PostgreSQL must not be exposed publicly.
- Redis must not be exposed publicly.
- S3-compatible storage must not expose buckets publicly by default.
- Worker must not accept public traffic.
- API should only be accessible through the reverse proxy.
- SSH access must use key-based authentication.
- Root login must be disabled.
- Firewall should allow only required ports.

---

## 16.4 VPS Sizing

### Hackathon / Demo Environment

| Resource         |           Minimum |       Recommended |
| ---------------- | ----------------: | ----------------: |
| CPU              |            2 vCPU |            4 vCPU |
| RAM              |              4 GB |              8 GB |
| Storage          |        80 GB NVMe |       160 GB NVMe |
| Operating system |        Ubuntu LTS |        Ubuntu LTS |
| Region           | Singapore/Jakarta | Singapore/Jakarta |

### Closed Pilot

| Service         | Recommendation                                |
| --------------- | --------------------------------------------- |
| Application VPS | 4 vCPU, 8 GB RAM                              |
| Database VPS    | 4 vCPU, 16 GB RAM                             |
| Object storage  | Separate storage or managed object storage    |
| Backup storage  | Separate provider or separate region          |
| Monitoring      | External uptime monitoring and error tracking |

---

# 17. Offline-First Design

## 17.1 Offline Strategy

| Data type                 | Storage method               | Offline support |
| ------------------------- | ---------------------------- | --------------- |
| App shell                 | Service worker cache         | Yes             |
| Published local plan      | IndexedDB                    | Yes             |
| Local contacts            | IndexedDB                    | Yes             |
| Household checklist       | IndexedDB                    | Yes             |
| Report drafts             | IndexedDB                    | Yes             |
| Report queue              | IndexedDB                    | Yes             |
| Recent map tiles          | Cache only if policy permits | Limited         |
| Sensitive request details | Not cached publicly          | No              |
| Live reports              | Not guaranteed               | No              |

---

## 17.2 Synchronization Strategy

```text
User creates report offline
        ↓
Report saved in IndexedDB
        ↓
Status: Saved Offline
        ↓
Connectivity returns
        ↓
Background sync or manual retry
        ↓
API validates report
        ↓
Server stores report
        ↓
Status: Submitted
        ↓
User sees confirmation
```

---

## 17.3 Conflict Handling

| Scenario                                     | Handling                                                                            |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| Plan changed on server while user is offline | Display newer version when sync returns; retain local saved copy until user updates |
| Report uploaded twice after retry            | Use idempotency key to prevent duplicate creation                                   |
| Draft edited on two devices                  | Treat drafts as device-local unless user account sync is enabled                    |
| Cached plan expired                          | Show expired/stale label and recommend sync                                         |
| Upload fails repeatedly                      | Keep local draft and show retry action                                              |

---

# 18. Map and Geospatial Design

## 18.1 Map Principles

- Map is a supporting interface, not the only interface.
- Every map item must have a text equivalent.
- Maps must not imply route safety.
- Public location precision must be reduced where necessary.
- No report density should be presented as a direct hazard score.
- Map markers must distinguish:
  - Published local plans.
  - Community reports.
  - Reviewed reports.
  - Unreviewed reports.
  - Simulation data.
  - No-recent-information zones.

---

## 18.2 Map Layers

| Layer                    | Description                           | Visibility                            |
| ------------------------ | ------------------------------------- | ------------------------------------- |
| Region boundary          | Supported service area                | Public                                |
| Preparedness locations   | Meeting points, facilities, landmarks | Public only if approved               |
| Community reports        | Generalized location reports          | Public after review                   |
| Restricted help requests | Exact or sensitive locations          | Authorized coordinators only          |
| Coverage gap zones       | Areas without recent information      | Coordinators, optional public summary |
| Risk context layer       | Static contextual risk information    | Only with valid source and metadata   |
| Simulation layer         | Drill content                         | Clearly marked                        |

---

# 19. Security Requirements

## 19.1 Authentication Security

- Use Argon2id password hashing.
- Use HTTP-only, Secure, SameSite cookies where possible.
- Use short-lived access tokens.
- Use refresh-token rotation.
- Enforce email verification for coordinator roles.
- Rate limit login attempts.
- Lock or delay repeated failed authentication attempts.
- Require stronger passwords for administrative roles.
- Consider multi-factor authentication before public pilot.

---

## 19.2 Authorization Security

- Enforce role checks on every sensitive API endpoint.
- Do not trust role information sent by the client.
- Restrict organization data by organization membership.
- Restrict region data by assignment.
- Restrict help-request access to authorized staff.
- Restrict media downloads through signed URLs.
- Prevent IDOR vulnerabilities by checking ownership and role permissions.

---

## 19.3 API Security

- Validate every payload on the server.
- Use strict Zod schemas.
- Rate limit report submission.
- Limit upload size and allowed MIME types.
- Use CSRF protection for cookie-based sessions.
- Configure CORS only for Tandara domains.
- Sanitize user-generated content before rendering.
- Prevent SQL injection using parameterized queries.
- Use request IDs for traceability.
- Do not expose stack traces in production responses.

---

## 19.4 File Security

- Limit file size, for example 5 MB in MVP.
- Allow only JPG, PNG, and WebP in MVP.
- Validate MIME type and file signature.
- Store files privately.
- Strip EXIF metadata where feasible.
- Generate thumbnails separately.
- Use signed URLs with short expiration.
- Log sensitive media access.
- Add malware scanning before pilot deployment.

---

# 20. Privacy Requirements

## 20.1 Data Minimization

Tandara should collect only:

- Report category.
- Report text.
- Observation time.
- Optional location.
- Optional image.
- Optional contact information.
- Optional follow-up request.
- Minimal account data for coordinators.
- Drill participation data in aggregate where possible.

Tandara should not collect:

- Continuous GPS tracking.
- Government ID numbers.
- Detailed health diagnoses.
- Sensitive demographic profiling.
- Contacts without consent.
- Precise personal locations for public display.

---

## 20.2 Suggested Data Retention Policy

This policy must be validated with pilot partners and legal review.

| Data type                          | Suggested retention                                            |
| ---------------------------------- | -------------------------------------------------------------- |
| Public reviewed community reports  | 12–24 months, then archive/anonymize                           |
| Unreviewed reports                 | 90–180 days unless operationally required                      |
| Help requests with contact details | Delete or anonymize after closure + defined retention window   |
| Uploaded media                     | Delete after report retention period unless required for audit |
| Audit logs                         | 24–36 months                                                   |
| Drill responses                    | Aggregate long-term; delete identifiable data sooner           |
| Authentication logs                | 6–12 months                                                    |
| Backups                            | Rolling encrypted retention schedule                           |

---

## 20.3 Resident Privacy Controls

Residents should be able to:

- Submit reports anonymously where operationally supported.
- Decline location permission.
- Decline contact follow-up.
- Request deletion of eligible personal data.
- View their submitted reports when authenticated.
- Understand what information may be visible publicly.

---

# 21. Non-Functional Requirements

## 21.1 Performance Targets

| Area                            | Initial target                                               |
| ------------------------------- | ------------------------------------------------------------ |
| Resident home-page first load   | Under 3 seconds on standard mobile connection where possible |
| Core API response               | p95 under 500 ms for non-AI endpoints                        |
| Plan loading from offline cache | Under 1 second on average device                             |
| Report submission response      | Under 2 seconds excluding media upload                       |
| AI triage                       | Async; should not block report submission                    |
| Coordinator report list         | p95 under 1 second for paginated queries                     |
| Map initial render              | Under 3 seconds for pilot-scale data                         |

---

## 21.2 Reliability Targets

| Metric                         |     Prototype target |                          Pilot target |
| ------------------------------ | -------------------: | ------------------------------------: |
| Application availability       |          Best effort |                  99.5% monthly target |
| API availability               |          Best effort |                  99.5% monthly target |
| Successful offline report sync | Demonstrated in test | >95% under normal recovery conditions |
| Backup success                 |  Manual verification |          Daily automated verification |
| Restore test                   |          Manual once |            Scheduled periodic testing |
| AI availability                |         Non-blocking |            Non-blocking with fallback |

---

## 21.3 Accessibility Targets

- WCAG 2.2 AA-oriented implementation.
- Keyboard navigation for web dashboard.
- Visible focus indicators.
- Sufficient contrast.
- No color-only status distinctions.
- Screen-reader labels for critical controls.
- Text alternative for maps.
- Large-text support.
- Plain-language resident content.
- Error messages that explain corrective actions.
- Form fields with visible labels.
- Accessible modal and dialog behavior.

---

# 22. Observability and Monitoring

## 22.1 Required Monitoring

| Layer                 | Monitoring requirement                                        |
| --------------------- | ------------------------------------------------------------- |
| Frontend              | JavaScript errors, page-load performance, failed API requests |
| API                   | Request rate, error rate, latency, authentication failures    |
| Database              | Connections, slow queries, disk usage, backup status          |
| Redis                 | Queue depth, failed jobs, memory usage                        |
| Worker                | AI failures, retry count, job processing time                 |
| S3-compatible storage | Storage usage, failed upload/download, signed URL errors      |
| VPS                   | CPU, RAM, disk, network, container health                     |
| External APIs         | Availability, latency, parse failures, authorization failures |

---

## 22.2 Health Endpoints

```text
GET /health
GET /ready
GET /metrics
```

### Health Endpoint Expectations

| Endpoint   | Purpose                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------- |
| `/health`  | Confirms the application process is running                                                   |
| `/ready`   | Confirms PostgreSQL is available for API operations; async Redis health is checked separately |
| `/metrics` | Exposes Prometheus-compatible metrics in pilot or production environments                     |

---

# 23. Logging and Audit Requirements

## 23.1 Structured Logs

All backend logs should include:

```text
timestamp
environment
service_name
request_id
user_id_if_available
organization_id_if_available
region_id_if_available
event_name
severity
status_code
duration_ms
error_code_if_any
```

Sensitive content such as resident report text, phone numbers, or full addresses must not be logged unnecessarily.

---

## 23.2 Audit Log Events

```text
USER_LOGIN
USER_LOGOUT
ROLE_GRANTED
ROLE_REVOKED
REPORT_CREATED
REPORT_REVIEWED
REPORT_STATUS_CHANGED
REPORT_PUBLISHED
REPORT_CLOSED
HELP_REQUEST_ACCESSED
PLAN_CREATED
PLAN_UPDATED
PLAN_PUBLISHED
PLAN_ARCHIVED
AI_SUGGESTION_ACCEPTED
AI_SUGGESTION_EDITED
AI_SUGGESTION_REJECTED
MEDIA_VIEWED
DATA_EXPORTED
INTEGRATION_UPDATED
RETENTION_RULE_UPDATED
```

---

# 24. Testing Strategy

## 24.1 Testing Layers

| Layer                 | Tools                                          | Scope                                             |
| --------------------- | ---------------------------------------------- | ------------------------------------------------- |
| Unit tests            | Vitest                                         | Utilities, validation schemas, status transitions |
| Component tests       | React Testing Library                          | Forms, labels, accessibility states               |
| API integration tests | Vitest + test database                         | Authentication, permissions, report workflow      |
| End-to-end tests      | Playwright                                     | Resident and coordinator critical journeys        |
| Accessibility tests   | axe-core + manual testing                      | Keyboard, screen reader, contrast                 |
| Security tests        | Dependency scan, secret scan, permission tests | Common vulnerabilities                            |
| Load tests            | k6 or Artillery                                | API and report submission capacity                |
| Backup restore test   | Manual then automated runbook                  | Recovery confidence                               |
| AI evaluation tests   | Labeled test set                               | Hallucination, extraction, category quality       |

---

## 24.2 Critical End-to-End Test Cases

1. Resident opens a plan without creating an account.
2. Resident saves the plan for offline use.
3. Resident opens saved plan in airplane mode.
4. Resident submits a report offline.
5. Offline report synchronizes when connection returns.
6. Coordinator views raw report.
7. AI suggestion appears separately from original report.
8. Coordinator edits AI suggestion.
9. Coordinator publishes reviewed report.
10. Public user sees reviewed community report but not contact details.
11. Unauthorized user cannot access help-request details.
12. Coordinator cannot publish an incomplete local plan.
13. Expired plan displays expiration state.
14. Simulation report does not appear in real incident view.
15. Duplicate suggestion requires human confirmation.
16. Deleted or restricted media cannot be accessed through old URLs.

---

# 25. Product Analytics

## 25.1 North-Star Metric

> **Percentage of drill participants who can locate a verified local preparedness plan and identify the correct next preparedness action.**

---

## 25.2 Key Metrics

| Area                   | Metric                                                                         |
| ---------------------- | ------------------------------------------------------------------------------ |
| Preparedness           | Percentage of users saving local plans for offline use                         |
| Preparedness           | Checklist completion during drills                                             |
| Understanding          | Percentage of users distinguishing official information from community reports |
| Reporting              | Report submission completion rate                                              |
| Reliability            | Offline report synchronization success rate                                    |
| Coordinator operations | Median time to first report review                                             |
| AI utility             | Percentage of AI suggestions accepted or edited                                |
| AI safety              | Unsupported-fact rate in AI summaries                                          |
| Duplicate handling     | False-positive duplicate suggestion rate                                       |
| Governance             | Percentage of published plans with active owners and review dates              |
| Accessibility          | Accessibility issues identified and resolved                                   |
| Retention              | Percentage of data lifecycle tasks completed on time                           |

---

## 25.3 Events to Track

```text
region_selected
plan_viewed
plan_saved_offline
checklist_item_completed
checklist_reset
report_started
report_saved_offline
report_submitted
report_sync_success
report_sync_failed
help_request_started
help_request_submitted
ai_suggestion_viewed
ai_suggestion_accepted
ai_suggestion_edited
ai_suggestion_rejected
report_reviewed
plan_published
drill_started
drill_completed
accessibility_setting_changed
```

No analytics event should include raw report content, phone numbers, exact coordinates, or sensitive help-request details.

---

# 26. Risk Register

| Risk                                                  | Severity | Mitigation                                                             |
| ----------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| Users mistake community reports for official warnings | High     | Distinct labels, visual styles, disclaimers, source metadata           |
| AI invents details                                    | High     | Structured schema, `unknown` field, server validation, human review    |
| Report abuse or misinformation                        | High     | Rate limiting, moderation workflow, audit logs, abuse reporting        |
| Local plans become outdated                           | High     | Mandatory plan owner, review dates, expiration status                  |
| Offline information is mistaken for live data         | High     | Persistent timestamp and offline banner                                |
| Help-request data leaks                               | High     | Restricted access, encryption, audit logs, private media               |
| VPS is compromised                                    | High     | Firewall, SSH keys, patching, backups, monitoring, secret management   |
| One VPS failure causes outage                         | High     | Offsite backups, phased infrastructure separation for pilot            |
| External API changes                                  | Medium   | Adapter pattern, contract tests, independent connector shutdown        |
| Team over-engineers infrastructure                    | High     | Use Docker Compose, not Kubernetes, for MVP                            |
| Lack of operational owner after hackathon             | High     | Pilot only with named organization and SOP                             |
| Users rely entirely on Tandara                        | High     | Clear official-channel guidance and safety disclaimer                  |
| AI provider unavailable                               | Medium   | Async AI, manual workflow remains available                            |
| Map is interpreted as route safety proof              | High     | Avoid “safe route” claims; add plan disclaimers                        |
| Low digital literacy reduces adoption                 | Medium   | Plain language, visual guidance, drill facilitation, text alternatives |

---

# 27. Hackathon Demo Requirements

## 27.1 Simulated Scenario

**Scenario:** Heavy rainfall causes road flooding near a community hall in a simulated flood-prone neighborhood.

### Seed Reports

| Report | Content                                                                                | Expected behavior                                         |
| ------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| A      | “Water is knee-high near Jalan Melati, close to the community hall. Cars cannot pass.” | AI suggests road flooding; coordinator reviews            |
| B      | “The road near the hall is flooded and motorcycles are turning back.”                  | AI flags potential duplicate with Report A                |
| C      | “Flooding is happening nearby. Please check.”                                          | AI flags ambiguous location and unknown time              |
| D      | “An elderly resident may need follow-up near the health post.”                         | Restricted follow-up request; coordinator-only visibility |

---

## 27.2 Demo Sequence

1. Introduce Tandara and the last-mile preparedness problem.
2. Open Tandara Warga.
3. Show selected community region.
4. Open the published local preparedness plan.
5. Show source, plan owner, review date, and disclaimer.
6. Save the plan for offline use.
7. Turn on airplane mode or browser offline mode.
8. Show that the plan remains accessible.
9. Submit a community report while offline.
10. Show “Saved Offline — Not Submitted.”
11. Restore connectivity.
12. Demonstrate report synchronization.
13. Open Tandara Posko.
14. Show original report and AI suggestion side-by-side.
15. Show potential duplicate report.
16. Show ambiguity detection for Report C.
17. Correct or reject an AI suggestion.
18. Publish a reviewed report.
19. Show restricted access for Report D.
20. Show coverage gap wording:
    > No Recent Information Available
21. Close with sustainability and pilot-readiness message.

---

# 28. Team Allocation — Three Developers

| Developer   | Primary ownership                                                | Shared product responsibility              |
| ----------- | ---------------------------------------------------------------- | ------------------------------------------ |
| Developer 1 | Resident PWA, offline persistence/sync, shared UI                | UX, Bahasa Indonesia copy, resident demo   |
| Developer 2 | API, auth/policies, database/migrations, infrastructure          | Integration coordination, schema review    |
| Developer 3 | Coordinator dashboard, worker/AI adapters, duplicate suggestions | Test automation, AI provenance, pitch/demo |

All three own QA and scope decisions. Contracts changes are reviewed by their
consumers; database migrations have one owner (Developer 2). No separate fourth
product/design/QA member is assumed. Refer to Implementation-Plan.md for the
three-day MVP cut and daily gates. The roadmap below remains the longer-term backlog.

---

# 29. Implementation Roadmap

## Sprint 1 — Foundation

- Create monorepo.
- Configure TypeScript.
- Set up React/Vite applications.
- Set up NestJS/Fastify backend.
- Configure PostgreSQL/PostGIS.
- Create database migrations.
- Configure Docker Compose.
- Configure Caddy reverse proxy.
- Set up authentication skeleton.

## Sprint 2 — Resident Experience

- Build region selection.
- Build home screen.
- Build preparedness plan viewer.
- Build household checklist.
- Build report form.
- Implement offline storage with Dexie.
- Implement service worker and app shell cache.

## Sprint 3 — Coordinator Experience

- Build report inbox.
- Build report detail page.
- Build report review workflow.
- Build basic map.
- Build plan management workflow.
- Implement audit logs.

## Sprint 4 — AI and Background Jobs

- Set up Redis and BullMQ.
- Build report triage worker.
- Add structured AI output validation.
- Add duplicate suggestion logic.
- Add coordinator acceptance/edit/reject workflow.
- Add worker retries and failure handling.

## Sprint 5 — Security, Testing, and Demo

- Add access-control tests.
- Add offline flow tests.
- Add end-to-end tests.
- Add error tracking.
- Add health checks.
- Add demo seed data.
- Rehearse demo with no internet dependency.
- Prepare architecture and safety slides.

---

# 30. Final Product Positioning

## Product Name

> **TANDARA**

## Tagline

> **Tandara — From Local Signals to Shared Readiness.**

## Short Description

> Tandara is a community preparedness platform that helps residents and local coordinators turn fragmented local signals, preparedness plans, and community reports into clearer shared action.

## Honest Product Claim

> Tandara does not issue official disaster warnings, predict floods, certify evacuation routes, or replace emergency services. It helps residents access local preparedness plans and helps coordinators review and organize community reports through transparent source labels, human verification, and offline-ready information.

## Final Differentiator

> Tandara is not another flood-reporting map. It is a preparedness and trust layer that helps communities understand what they know, what they do not know, and what they can prepare for together.

# 31. Implemented Foundation Boundary

Updated 2026-10-13. Canonical source structure: ARCHITECTURE.md and ADR-0001.
The repository now has two web shells, API metadata/health, a disabled standalone
worker, shared contracts/client/UI/server/database packages, local Compose, and CI.
Business workflows described by this PRD are not implemented by the boilerplate.

For three developers in three days, media uploads, plan editor, full administration,
drill analytics, external sources, and automatic notifications are deferred.
Production/pilot requires separate operational and security gates.
