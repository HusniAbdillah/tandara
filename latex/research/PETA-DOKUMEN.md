# Inventaris dokumentasi repository

Peta isi untuk audit; bukan pernyataan semua baris kode telah direview.

HEAD: `1c427abb16f5836a4097a9c9d899a71ebacdad22`; 325 berkas tracked; 43 Markdown.

## README.md

135 baris; SHA-256 `43d831104b57712cb26648054d5bcb796c34cbf301ce26f016959b8b9d9b3e56`

- Tandara / ArahSiaga
- Run the complete local product
- Edit .env: choose POSTGRES_PASSWORD and DEMO_PASSWORD (at least 12 characters).
- Demo and verification
- Connect a real AI provider
- Development and tests
- Deployment boundary

## docs/ARCHITECTURE.md

119 baris; SHA-256 `31ee30758308de78b2fe18e11d9149e9c9d51f2c7c74291492eeabf6c439aec6`

- Implemented architecture
- Boundaries
- Persistence and concurrency
- Geospatial behavior
- AI and source separation
- Offline and media

## docs/DELIVERY.md

167 baris; SHA-256 `fdbd4e0968762391f33861077c2bda1e7f84f6ec69efee7869768592f355866e`

- Tandara / ArahSiaga delivery
- Executive summary
- Repository information
- Implemented capabilities
- Architecture
- UI/UX
- Testing
- How to run
- Choose POSTGRES_PASSWORD and DEMO_PASSWORD (>=12 chars) in .env.
- Demonstration
- External dependencies
- Security and operational readiness
- Known limitations
- Completion matrix
- Recommended next steps

## docs/Implementation-Plan.md

157 baris; SHA-256 `49c2c1d1d6d35fbf747af4b84f25bc9891a726c5978654d0befed935bed26b7c`

- Tandara — Three-Day Implementation Plan
- 1. Scope and source of truth
- 2. Ownership
- 3. Required MVP slices
- 4. Foundation handoff checklist
- 5. Before writing business tables
- 6. Day 1 — Complete the online report path
- 7. Day 2 — Review, offline, and async reliability
- 8. Day 3 — Verification and demo
- 9. Git and collaboration
- 10. Required evidence

## docs/PLAN.md

2109 baris; SHA-256 `4e9474cc90c33c9d939a947864836b354e421aebe511826a846abcb99b08a682`

- Tandara — 3-Day Implementation Plan
- Hackathon MVP Execution Plan for 3 Technical Members + 1 Non-Technical Member
- 1. Critical Scope Decision
- 2. MVP Definition
- 2.1 The One Core Story
- 2.2 MVP Must-Have Features
- 2.3 Nice-to-Have Features
- 2.4 Explicitly Deferred Features
- 3. Product Scope for the 3-Day Demo
- 3.1 Tandara Warga Pages
- 3.2 Tandara Posko Pages
- 4. Team Structure and Ownership
- 4.1 Recommended Team Roles
- 4.2 Responsibility Matrix
- 4.3 Daily Rituals
- Mandatory schedule
- Stand-up format
- 5. Delivery Strategy
- 5.1 Development Principle
- 5.2 Priority Order
- 6. Technical MVP Architecture
- 7. Detailed Task Breakdown
- EPIC 0 — Project Setup and Working Agreement
- T-001 — Create Monorepo
- Brief
- Deliverables
- Definition of Done
- T-002 — Create Shared Design Tokens
- Deliverables
- Recommended Tandara Palette
- Status Visual Rules
- T-003 — Create Demo Seed Data
- Seed Region
- Seed Plan
- Seed Reports
- Definition of Done
- EPIC 1 — Backend Foundation
- T-101 — PostgreSQL/PostGIS Setup
- Deliverables
- Definition of Done
- T-102 — Core Database Schema
- MVP Tables
- Simplification for MVP
- Definition of Done
- T-103 — Auth and Role Guard
- MVP Approach
- Definition of Done
- T-104 — Preparedness Plan API
- Endpoints
- Required Response Data
- Definition of Done
- T-105 — Resident Report Submission API
- Endpoint
- Required Input
- Requirements
- Definition of Done
- T-106 — Coordinator Report Inbox API
- Endpoints
- Filters
- Definition of Done
- T-107 — Coordinator Review API
- Endpoint
- Supported Actions
- Definition of Done
- EPIC 2 — AI Triage and Duplicate Suggestions
- T-201 — AI Triage Contract
- Build
- Required Output
- Definition of Done
- T-202 — Deterministic Mock AI Engine
- Why It Is Important
- Rule Examples
- Definition of Done
- T-203 — Optional Live AI Adapter
- Rule
- Requirements
- Definition of Done
- T-204 — Duplicate Candidate Logic
- MVP Logic
- For Demo
- Definition of Done
- EPIC 3 — Tandara Warga Frontend
- T-301 — Resident App Shell and Region Selection
- Screens
- Definition of Done
- T-302 — Resident Home Screen
- Required Sections
- Definition of Done
- T-303 — Preparedness Plan Page
- Page Sections
- Definition of Done
- T-304 — Preparedness Checklist
- Requirements
- Definition of Done
- T-305 — Report Form
- Form Fields
- UX Requirements
- Definition of Done
- T-306 — Offline Report Queue
- Requirements
- Definition of Done
- T-307 — Resident Status and Contacts Page
- Includes
- Definition of Done
- EPIC 4 — Tandara Posko Frontend
- T-401 — Coordinator Login
- Definition of Done
- T-402 — Coordinator Dashboard Overview
- Dashboard Cards
- Definition of Done
- T-403 — Report Inbox
- Required Columns
- Required Filters
- Definition of Done
- T-404 — Report Detail and AI Review
- Layout
- Definition of Done
- T-405 — Duplicate Candidate Page
- UI
- Definition of Done
- T-406 — Restricted Help Request Page
- Requirements
- Definition of Done
- EPIC 5 — Offline, Safety, and Trust UI
- T-501 — Status Label System
- Required Status Labels
- Definition of Done
- T-502 — Safety Disclaimer Components
- Required Copy
- Definition of Done
- EPIC 6 — Deployment, QA, and Demo Readiness
- T-601 — Docker Compose Environment
- Services
- Definition of Done
- T-602 — VPS Deployment
- VPS Checklist
- Definition of Done
- T-603 — Functional QA Checklist
- Test Cases
- Resident Flow
- Coordinator Flow
- Safety Flow
- T-604 — Demo Fallback Plan
- Rule
- Fallback Assets
- Definition of Done
- 8. Detailed 3-Day Schedule
- Day 0 — Before Development Starts
- Day 1 — Foundation and First End-to-End Flow
- Day 1 Goal
- Day 1 Morning: 08:00–12:00
- Day 1 Morning Checkpoint
- Day 1 Afternoon: 13:00–18:00
- Day 1 Non-Negotiable Milestone
- Day 1 Evening: 19:00–22:00
- Day 2 — Trust, Preparedness, AI, and Offline Capability
- Day 2 Goal
- Day 2 Morning: 08:00–12:00
- Day 2 Morning Checkpoint
- Day 2 Afternoon: 13:00–18:00
- Day 2 Non-Negotiable Milestone
- Day 2 Evening: 19:00–22:00
- Day 3 — Deployment, Polish, QA, and Presentation
- Day 3 Goal
- Day 3 Morning: 08:00–12:00
- Feature Freeze Rule
- Day 3 Afternoon: 13:00–17:00
- Day 3 Evening: 18:00–Final
- 9. Demo Script and Feature Mapping
- 9.1 Recommended 5-Minute Demo
- Minute 0:00–0:30 — Problem
- Minute 0:30–1:15 — Tandara Warga
- Minute 1:15–2:00 — Offline Resilience
- Minute 2:00–2:45 — Synchronization
- Minute 2:45–4:15 — Tandara Posko
- Minute 4:15–4:45 — Privacy
- Minute 4:45–5:00 — Closing
- 10. Definition of Done for the Entire MVP
- Resident Flow
- Coordinator Flow
- Trust and Safety
- Technical
- 11. Quality Gates
- Gate 1 — End of Day 1
- Gate 2 — End of Day 2
- Gate 3 — Midday Day 3
- 12. Risk Management
- 13. Git Workflow
- Branch Rules
- Rules
- 14. Suggested Task Board Structure
- Columns
- Labels
- Rule
- 15. If Only Three People Total Are Available
- Team Structure
- Features to Remove First
- Three-Person MVP
- 16. Final Recommended MVP Cut
- Tandara Warga
- Tandara Posko
- System
- 17. Final Team Rule

## docs/PRD.md

2088 baris; SHA-256 `2090853eeb52f438b3fa8f2b50b592b6eac98b6a4b129e0223e31943492b23ef`

- PRD — Product Requirements Document
- **TANDARA**
- _From Local Signals to Shared Readiness._
- 1. Document Control
- 2. Executive Summary
- 2.1 Product Overview
- 2.2 Product Statement
- 2.3 Primary Problem
- 2.4 Core Product Insight
- 3. Product Vision, Mission, and Principles
- 3.1 Vision
- 3.2 Mission
- 3.3 Product Principles
- Principle 1 — Trust must be visible
- Principle 2 — Unknown is safer than invented
- Principle 3 — AI assists; humans decide
- Principle 4 — No reports does not mean safe
- Principle 5 — Offline does not mean current
- Principle 6 — Local plans require local ownership
- Principle 7 — Privacy is part of safety
- Principle 8 — Accessibility is a core requirement
- 4. Sustainability Positioning
- Relevant Sustainable Development Goals
- 5. Goals and Non-Goals
- 5.1 Product Goals
- 5.2 Non-Goals
- 6. Scope and Release Strategy
- 6.1 Release Phases
- 6.2 Hackathon MVP Scope
- Included
- Excluded
- 7. Personas
- 7.1 Persona A — Resident
- Goals
- Pain Points
- 7.2 Persona B — Community Coordinator
- Goals
- Pain Points
- 7.3 Persona C — Community Organization Administrator
- Goals
- 7.4 Persona D — Resident With Accessibility Needs
- Needs
- 8. Jobs To Be Done
- 9. Product Architecture Overview
- 10. User Roles and Access Model
- 10.1 Roles
- 10.2 Permission Matrix
- 11. Functional Requirements
- 11.1 Tandara Warga — Resident PWA
- FR-R01 — Region Selection
- Requirements
- Acceptance Criteria
- FR-R02 — Home Situation Screen
- Required Information Labels
- FR-R03 — Local Preparedness Plan
- Required Plan Statuses
- Plan Safety Disclaimer
- FR-R04 — Household Preparedness Checklist
- Default Checklist Items
- Requirements
- FR-R05 — Community Condition Reporting
- Required Fields
- Initial Report Categories
- Requirements
- FR-R06 — Help / Follow-Up Request
- Requirements
- Mandatory Disclaimer
- FR-R07 — Offline Mode
- Offline Content
- Offline Requirements
- 11.2 Tandara Posko — Coordinator Dashboard
- FR-C01 — Secure Authentication
- FR-C02 — Report Inbox
- Required Views
- FR-C03 — Report Detail View
- FR-C04 — Human Review Workflow
- Requirements
- FR-C05 — Duplicate Report Management
- Requirements
- Example Explanation
- FR-C06 — Local Plan Management
- Plan Workflow
- Publishing Rules
- FR-C07 — Coverage Gap View
- Restrictions
- FR-C08 — Drill Management
- Drill Data Separation
- 11.3 Platform Administration
- FR-A01 — Organization Management
- FR-A02 — Region Configuration
- FR-A03 — Audit Logs
- 12. AI Triage Specification
- 12.1 AI Purpose
- 12.2 Allowed AI Features
- 12.3 Prohibited AI Behavior
- 12.4 Structured AI Output
- 12.5 AI Processing Flow
- 12.6 AI Failure Handling
- 13. Data Model
- 13.1 Main Entities
- 13.2 Core Report Schema
- 13.3 PostGIS Data Types
- Required Geospatial Indexes
- 13.4 Data Privacy Levels
- 14. API Design
- 14.1 API Style
- 14.2 Core API Endpoints
- Authentication
- Regions
- Preparedness Plans
- Community Reports
- Help Requests
- Drills
- Media
- System
- 15. Technical Stack
- 15.1 Frontend Stack
- 15.2 Backend Stack
- 15.3 Database Stack
- 15.4 Infrastructure Stack
- 16. VPS Deployment Architecture
- 16.1 MVP Infrastructure
- 16.2 Docker Services
- 16.3 Network Segmentation
- Security Rules
- 16.4 VPS Sizing
- Hackathon / Demo Environment
- Closed Pilot
- 17. Offline-First Design
- 17.1 Offline Strategy
- 17.2 Synchronization Strategy
- 17.3 Conflict Handling
- 18. Map and Geospatial Design
- 18.1 Map Principles
- 18.2 Map Layers
- 19. Security Requirements
- 19.1 Authentication Security
- 19.2 Authorization Security
- 19.3 API Security
- 19.4 File Security
- 20. Privacy Requirements
- 20.1 Data Minimization
- 20.2 Suggested Data Retention Policy
- 20.3 Resident Privacy Controls
- 21. Non-Functional Requirements
- 21.1 Performance Targets
- 21.2 Reliability Targets
- 21.3 Accessibility Targets
- 22. Observability and Monitoring
- 22.1 Required Monitoring
- 22.2 Health Endpoints
- Health Endpoint Expectations
- 23. Logging and Audit Requirements
- 23.1 Structured Logs
- 23.2 Audit Log Events
- 24. Testing Strategy
- 24.1 Testing Layers
- 24.2 Critical End-to-End Test Cases
- 25. Product Analytics
- 25.1 North-Star Metric
- 25.2 Key Metrics
- 25.3 Events to Track
- 26. Risk Register
- 27. Hackathon Demo Requirements
- 27.1 Simulated Scenario
- Seed Reports
- 27.2 Demo Sequence
- 28. Team Allocation — Three Developers
- 29. Implementation Roadmap
- Sprint 1 — Foundation
- Sprint 2 — Resident Experience
- Sprint 3 — Coordinator Experience
- Sprint 4 — AI and Background Jobs
- Sprint 5 — Security, Testing, and Demo
- 30. Final Product Positioning
- Product Name
- Tagline
- Short Description
- Honest Product Claim
- Final Differentiator
- 31. Current implementation boundary

## docs/TDD.md

2410 baris; SHA-256 `6c41a8ac10280c2c6c2f13ce2cb4e090b5869ccd9c4118dbcac8d8ef2c71a133`

- TDD — Technical Design Document
- **TANDARA**
- _From Local Signals to Shared Readiness._
- 1. Purpose
- 2. Technical Goals
- 3. Technical Non-Goals
- 4. Architecture Decisions
- 4.1 Decision Summary
- 4.2 Self-hosting Trade-off
- 4.3 Why a Modular Monolith Instead of Microservices
- Reasoning
- 5. High-Level System Architecture
- 6. Repository and Monorepo Structure
- 7. Frontend Technical Design
- 7.1 Applications
- 7.2 Frontend Stack
- 7.3 State Management Strategy
- 7.4 Resident PWA Routes
- 7.5 Coordinator Dashboard Routes
- 7.6 PWA Caching Strategy
- 7.7 Offline Data Schema
- 7.8 Offline Submission Strategy
- Required synchronization triggers
- Offline report state machine
- Idempotency
- 7.9 Accessibility Implementation
- 8. Backend Technical Design
- 8.1 Backend Stack
- 8.2 NestJS Module Structure
- 8.3 Request Lifecycle
- 8.4 Error Response Standard
- Rules
- 9. Authentication and Authorization
- 9.1 Authentication Model
- Public Visitors
- Residents
- Coordinators and Administrators
- 9.2 Session Model
- 9.3 Guest Report Receipt Token
- 9.4 Authorization Model
- Example permission check
- 10. Database Design
- 10.1 Database Principles
- 10.2 PostgreSQL Extensions
- 10.3 Core Tables
- `users`
- `organizations`
- `organization_memberships`
- `regions`
- `preparedness_plans`
- `preparedness_plan_versions`
- `plan_locations`
- `reports`
- `report_private_details`
- `report_media`
- `report_reviews`
- `ai_triage_results`
- `duplicate_candidates`
- `help_requests`
- `audit_logs`
- 11. Report State Machine
- Allowed Transitions
- 12. Geospatial Design
- 12.1 Coordinate Policy
- 12.2 Public Location Generalization
- 12.3 Coverage Gap Calculation
- 13. API Design
- 13.1 API Standards
- 13.2 Core Endpoint Summary
- Authentication
- Regions
- Plans
- Reports
- Guest Report Status
- Help Requests
- Drills
- System
- 13.3 Report Creation API Example
- 13.4 Pagination Standard
- 14. Background Jobs and Reliable Event Processing
- 14.1 Required Queues
- 14.2 Transactional Outbox Pattern
- `outbox_events`
- 14.3 Retry Policy
- 15. AI Triage Technical Design
- 15.1 AI Provider Adapter
- 15.2 AI Input Rules
- 15.3 AI Prompt Safety
- 15.4 AI Output Validation
- 15.5 Duplicate Detection Design
- Candidate pre-filter
- Duplicate suggestion output
- 16. Media Upload and Processing
- 16.1 MVP Upload Approach
- 16.2 Pilot Upload Improvement
- 16.3 Media Security Controls
- 17. Infrastructure and VPS Deployment
- 17.1 VPS Operating System
- 17.2 Network Security
- 17.3 Docker Compose Services
- 17.4 Environment Separation
- 17.5 Caddy Routing
- 17.6 Docker Compose Production Principles
- 18. Backup and Disaster Recovery
- 18.1 Backup Policy
- 18.2 Restore Test Requirement
- 19. CI/CD Design
- 19.1 Pull Request Pipeline
- 19.2 Deployment Pipeline
- 19.3 Migration Rules
- 20. Security Design
- 20.1 Security Baseline
- 20.2 Rate Limiting
- 20.3 Data Access Rules
- 20.4 Secret Management
- 21. Observability
- 21.1 Logging
- 21.2 Monitoring Stack
- MVP
- Pilot
- 21.3 Required Alerts
- 22. Testing Strategy
- 22.1 Test Layers
- 22.2 Mandatory Test Cases
- Resident PWA
- Coordinator Dashboard
- AI
- Infrastructure
- 23. Performance and Capacity Assumptions
- 23.1 MVP Assumptions
- 23.2 Performance Targets
- 24. Operational Runbooks
- 24.1 API Is Down
- 24.2 AI Provider Is Down
- 24.3 Redis Is Down
- 24.4 Database Is Down
- 24.5 Suspected Sensitive Data Leak
- 25. Development Standards
- 25.1 TypeScript Standards
- 25.2 Code Review Requirements
- 25.3 Branch Strategy
- 26. Development Roadmap
- Sprint 1 — Foundation
- Sprint 2 — Resident PWA
- Sprint 3 — Coordinator Dashboard
- Sprint 4 — Worker and AI
- Sprint 5 — Quality and Demo
- 27. Definition of Done
- 28. Final Technical Recommendation
- Product name
- Product architecture
- Frontend
- Backend
- Database
- Background processing
- Media storage
- Mapping
- Deployment
- Observability
- AI design
- 29. Final Engineering Principle
- 30. Current implementation and historical design gates

## docs/VALIDATION.md

56 baris; SHA-256 `0544aba654c5baaeb8a612b2e116cb06efe053d2ced1765e5affb27eaacdb18a`

- Foundation validation
- Corrections found during verification
- Reproduce

## docs/adr/0001-foundation.md

49 baris; SHA-256 `6cb226657af3b97bfec93102247a0e658302100a9fd9abd1fea93ac75b06d6e3`

- ADR-0001: Shared server modules in a small TypeScript monorepo
- Context
- Decision
- Consequences and limits
- References

## docs/ai/evaluation.md

113 baris; SHA-256 `7f24b94e107ca5805ec5526e367e750002111c4125a98c0205fa3e0ec40a654d`

- Protected AI evaluation
- Prepare the held-out corpus
- Run both candidates
- Independent scoring
- Activate and monitor

## docs/ai/operations.md

171 baris; SHA-256 `a9e21533b2c024d41a2b684d0b6b5a1dffea9342ab03266a6432510ff6a450f8`

- Production AI operations
- Configure inference
- Migrate and onboard
- Knowledge and human decisions
- Evaluate, approve and roll back
- Observe and respond
- Load, faults and recovery

## docs/ai/production-delivery-plan.md

280 baris; SHA-256 `dfb14a2e004777d058792166e56f9f214acfe352cad191d1d452b9f81e399024`

- Tandara AI: production delivery plan
- 1. Architecture decision
- 2. Complete product scope
- 3. Workflows and output contracts
- 4. Knowledge and retrieval
- 5. Domain persistence and migrations
- 6. Execution reliability and cost control
- 7. Security, privacy, and governance
- 8. Production deployment and operations
- 9. Model and release management
- Temporary Vikey integration and planned DeepSeek migration
- Evaluated model releases
- 10. Proposed capacity and acceptance targets
- 11. Validation and release evidence
- 12. Implementation work packages
- 13. Repository gaps to address
- 14. Definition of delivery-ready
- 15. Full software implementation update

## docs/ai/provider-setup.md

169 baris; SHA-256 `cac1c5b3fc13c20becb52599dd1ecae990d5789bbfa3c577b2fd9b93bf2d0630`

- Real model inference: Vikey and DeepSeek
- Environment configuration
- Apply and verify
- Failure behavior and limits
- Switch to DeepSeek later
- Embeddings and operational settings

## docs/ai/readiness.md

52 baris; SHA-256 `e442e595b54a4cc3d01f76952e84b3c6bc539fd424dc192c336116724142f449`

- AI delivery and launch readiness

## docs/ai/threat-model.md

41 baris; SHA-256 `37cefdc459402e81a69f46bbb2af3d4cf5b09590e3dc1cfd4a8d0eedc6896357`

- AI trust boundaries and review scope

## docs/design/system.md

38 baris; SHA-256 `190194e78cc22089a090db606e42323b81f65e3474609d18afdd5ef052af5115`

- Design decisions and visual checks

## docs/engineering/initial-audit.md

28 baris; SHA-256 `7e55c2092712dfeb954e54a697cb13a9e32e3ab2c70773c970011415a58d832f`

- Initial implementation audit — 13 October 2026

## docs/engineering/markdown-audit-2026-10-13.md

58 baris; SHA-256 `d889910516a16e72d77f28c84ddf92d25d823f2030e0a260bc7d3412af05410c`

- Indeks audit seluruh Markdown Tandara

## docs/features/map.md

36 baris; SHA-256 `126f7c25c3923749fa582a0cae1d1fcd7af6c0a2c10845832aa7ae7a8cec48ed`

- Street map and local situation layers

## docs/features/offline-sync.md

35 baris; SHA-256 `124bcf6dcea2edf98ba7c1e5e463e6c909438873b356c91b1bfe51f00d099c91`

- Offline saving and delivery

## docs/integrations/adapters.md

59 baris; SHA-256 `aea2278b5311a961ee512f844eb433910e4959d2b59afc4e81dcac7937134acc`

- Integration status and configuration

## docs/operations/ci-policy.md

56 baris; SHA-256 `0d817998666c968dcc879e7519a14fba14a8a5bb5d988804c89f3c48b7929dde`

- CI for the three-week demo
- Routine gate
- Full browser validation
- Deployment
- Baseline and measurement

## docs/operations/deploy-demo.md

481 baris; SHA-256 `b9cb494577ff31e5d2dbdf69c73b8e493b55bb69e9cf2828f635a713fe1e12c0`

- Deployment otomatis demo Tandara: Vercel + Tencent
- Hasil akhir
- Jalur utama: persiapan dari console Tencent, tanpa SSH/SCP laptop
- 1. Persiapan laptop dan SSH key
- 2. Masuk Tencent sekali
- 3. SSH host key dan firewall
- 4. Dua project Vercel Hobby
- Menggunakan custom domain dan domain vercel.app bersamaan
- 5. DNS milik teman
- 6. GitHub Secrets dan Variables
- 7. Aktivasi otomatis
- 8. Pemeriksaan pertama dan demo juri
- Status verifikasi

## docs/operations/deployment-analysis-2026-10-13.md

451 baris; SHA-256 `1fa0bcd144926976c8b8aeb6964cd98cc2964be8a6ed60edbb2708a66a5ae9fd`

- Analisis deployment Tandara: Vercel, Heroku, dan Tencent
- 1. Keputusan yang disarankan
- 2. Dasar dan batas verifikasi
- 3. Kebutuhan nyata aplikasi sekarang
- 4. Kapasitas Tencent yang dimiliki
- 5. Perbandingan opsi dan biaya
- Koreksi setelah konfirmasi kredit student $13/bulan
- 6. Latency dan pemisahan layanan
- 7. Deployment Vercel yang sesuai kode
- 8. Perubahan sebelum Tencent dapat melayani domain publik
- 9. Perubahan khusus alternatif Heroku
- 10. Rencana bertahap dan kriteria keputusan

## docs/operations/frontend-hosting-decision-2026-10-13.md

204 baris; SHA-256 `ffd7fd17a8e2ddb41291c9496a3fc37e7c8d9b84ba5ac1e505b1f3db39b490bb`

- Frontend Tandara: Vercel atau Tencent?
- Keputusan
- Perbandingan yang relevan untuk demo
- Temuan kode dan pengujian baru
- Domain dan DNS
- Detail terpenting: API proxy dan cookie
- Headers, PWA, dan map
- Anggaran nol dan kerja tim
- Mengapa bukan seluruh produk di Vercel?
- Kriteria sebelum link dikirim ke juri

## docs/operations/public-sources.md

138 baris; SHA-256 `a34936a19a5bcd2f4e9a88235a498581c5ecd69e4496a010ec4212fb11f3377b`

- Aktivasi sumber publik asli untuk demo Tandara
- 1. Deploy source dan migration terlebih dahulu
- 2. Opt-in di Tencent
- 3. Konfigurasi sumber di Posko sebagai admin
- 4. Periksa ketepatan data
- 5. Ganti konten lokal secara sah
- 6. Rehearsal akhir

## docs/operations/runbook.md

106 baris; SHA-256 `7918c9c84f176b81687093f706b0e7a230af8a52007e73a4ee0fe5e63de7206e`

- Operating the simulation
- Startup and health
- Environment reference
- Backup and restoration
- Failure and incident response
- Release and rollback

## docs/operations/tencent-env-siap-pakai.md

596 baris; SHA-256 `a2ee628da67a6aacec0c2653f01cb84b3aba45261cc4f7d4bedf5db9c21fcc95`

- Tencent Tandara â€” env lengkap dan password berbentuk kalimat
- 1. File yang digunakan
- Install as /opt/tandara/.env, chmod 600. Never commit the filled file.
- Read by both Bash and Compose: quote passphrases with single quotes.
- Do not use apostrophes or backslashes inside the passphrase in this shared format.
- Generate the DB password only for a fresh database: openssl rand -hex 24
- Preserve the original DB password when the Postgres volume already exists.
- Unique password, >=12 characters. Seed does not reset existing passwords.
- Explicitly enable the synthetic seed for the FIRST release only.
- Opt in to reviewed public-data connectors; reports and seed plans remain demo data.
- Runtime is NODE_ENV=production / APP_MODE=simulation in backend.compose.yml.
- Database URL, SQL worker, proxy and secure cookies are configured by Compose.
- Keep an existing MFA key unchanged. For a new key: openssl rand -hex 32
- Selected deployment profile: real Vikey chat and Gemini embeddings.
- Replace key placeholders privately or apply the prepared .local/tencent-ai.env overlay.
- Estimates below are illustrative, not current provider price quotes.
- Small demo application caps: USD 1/day, USD 3/month, USD 1/run. Not provider balances.
- Optional private telemetry collector; no external model-content tracing.
- Konfigurasi AI lokal yang ditemukan
- 2. Salin sekali: buat atau perbaiki env secara aman
- 3. Terapkan setelah Compose baru terdeploy, tanpa build ulang untuk perubahan env
- 4. Ganti password akun yang sudah terbentuk
- 5. Mengapa password kalimat dapat menyebabkan gagal?
- Salah: kata setelah spasi dibaca sebagai perintah Bash.
- Benar secara format; ini hanya ilustrasi, jangan dipakai sebagai password.
- 6. Pemeriksaan akhir tanpa mencetak secrets
- 7. Profil Vikey + Gemini yang dipilih tim — 14 Oktober 2026
- Kirim profil sekali dari PowerShell laptop
- Gabungkan dan terapkan di terminal Tencent

## docs/product/alur-aplikasi-dan-naskah-video.md

645 baris; SHA-256 `4bb0547aa8656cde0687c0191daf0424bd5bf2466f5b94841ed41774569aa225`

- Tandara — alur aplikasi dan panduan video demonstrasi
- 0. Mengapa sesuai tema sustainability dan subtema lomba?
- 0.1. Fokus masalah dan posisi produk
- 0.2. Hubungan dengan sustainability yang dapat dipertanggungjawabkan
- 0.3. Perubahan penekanan dalam video
- 0.4. Apa yang diukur sebelum penjurian?
- 0.5. Prioritas tiga hari dan kaitan penilaian
- 1. Alur kerja lengkap dalam satu gambar
- 2. Siapa melakukan apa?
- 3. Tentukan konteks data sebelum merekam
- 4. Persiapan perekaman
- 5. Susunan video utama — target lima menit
- Adegan 1 — masalah dan pengenalan
- Adegan 2 — memilih wilayah dan membaca sumber
- Adegan 3 — rencana dan checklist
- Adegan 4 — membuktikan offline dan membuat laporan uji
- Adegan 5 — sinkronisasi dan tanda terima
- Adegan 6 — peninjauan oleh koordinator
- Adegan 7 — hasil kembali kepada warga
- Adegan 8 — manfaat dan penutup
- 6. Segmen tambahan — pilih sesuai durasi
- A. Peta situasi — 20–30 detik
- B. Rencana yang ditinjau dua orang — 30–45 detik
- C. Asisten Posko berbasis sumber — 45–60 detik
- D. Tindak lanjut komunitas — 20–30 detik
- 7. Kalimat yang akurat untuk dipakai
- 8. Checklist hasil rekaman
- 9. Dasar verifikasi dan referensi

## docs/product/demo-flow.md

188 baris; SHA-256 `25529805bea5820e75adb2ac27fd1f421853928b737a4be95e40702a5d4e9c32`

- Tandara demo flow — 10–12 minutes
- Prepare before presenting
- 1. Introduce the two workspaces — 0:00–0:45
- 2. Show resident preparedness — 0:45–2:00
- 3. Submit a resident observation — 2:00–3:15
- 4. Review it in Posko — 3:15–5:00
- 5. Explain the real map — 5:00–6:15
- 6. Demonstrate cited AI assistance — 6:15–8:45
- 7. Prove offline access — 8:45–10:00
- 8. Close with accountability — 10:00–11:00
- Optional extensions

## docs/product/demo.md

57 baris; SHA-256 `c46ca2dfc2a8294dd0351fa5bec324250072d219dc42d8a3fb783c6ecfee4c0d`

- Complete simulation walkthrough

## docs/product/hackathon-audit-2026-10-13.md

260 baris; SHA-256 `44af3458d70528b6f986644d0c3ec596b8371621cdf365dfd44ec7228e5ea663`

- Audit Tandara dan keputusan tiga hari menuju penjurian
- Keputusan utama
- Yang sudah dan belum tersedia
- Membaca PLAN, PRD, dan TDD dengan benar
- Strategi data asli
- Inovasi yang paling masuk akal untuk lomba
- Implementasi yang diterapkan
- Dampak yang layak diukur dalam tiga hari
- Jadwal tiga hari dan pembagian kerja
- Demo yang disarankan
- Gate yang belum tertutup

## docs/product/requirements-matrix.md

62 baris; SHA-256 `db0ecebff6c462902ae336119633c8d88d6fc0effc13be6d2706c5b9cbbffa2f`

- Completion and verification matrix
- External gates, not activated in the simulation

## docs/qa/ai-delivery.md

47 baris; SHA-256 `398a9fb20528d90f6cbd6ad88bebd8da5720017090fe5b3b170a4eff0f0279af`

- Full AI software verification — 13 October 2026

## docs/qa/ai-main-rebase-verification.md

71 baris; SHA-256 `9a488c9e3dbf09a38645eaaea6442cf9c22e8b9c7928382dcfce60742687c69f`

- AI branch rebase onto main — 13 October 2026
- History and preservation
- Integration corrections
- Executed checks

## docs/qa/ai-provider-validation.md

48 baris; SHA-256 `fec41b0b27b3d1357efb5b86fb82f1cdffab251ee2141bfe5768488dff1be607`

- AI provider integration validation
- Verified results
- Configuration and limits

## docs/qa/gemini-provider-verification.md

62 baris; SHA-256 `986c019e42d459ac985aba800f3d8eff0320fa9de8938a5715782bbb21fd30ba`

- Vikey chat and Gemini embedding verification — 13 October 2026

## docs/qa/public-sources-2026-10-13.md

107 baris; SHA-256 `d7c57fc78933a05d1d9ec162e7f63b3a5ad4e4e4ff8a9f681e27174eb15b03c3`

- Verifikasi audit hackathon dan sumber publik
- Bukti yang sudah dieksekusi
- Koreksi yang ditemukan saat verifikasi
- Source-test acceptance
- Batas verifikasi
- Final verification

## docs/qa/rebase-validation.md

68 baris; SHA-256 `ab76591639cf9532520769f1950a16b7ccb1bf63b44f7469df73cbb1d484592b`

- Rebase and final regression verification
- History and preservation
- Executed checks
- Integration corrections

## docs/qa/validation.md

87 baris; SHA-256 `d87b461071f4d90eff87ee826525df72b1f4fb0db21074ea6fdb9b6d715cd3c9`

- Executed validation

## docs/security/model.md

64 baris; SHA-256 `d149f1ec90587b5c592156051485cc3e96914960f564a6e7eb4d6deac0fa67f0`

- Security and privacy model
- Access and writes
- Exposure limits
- Deployment responsibilities

## infrastructure/README.md

21 baris; SHA-256 `3745264b09415c9dd0f645ff94278292ec81d60500e1bcb760328104c5e08e7b`

- Infrastructure scope

## packages/backend/src/modules/README.md

11 baris; SHA-256 `25b457b405e63d429180443c5ca4a20f4d295be3300737b7dff794183125b952`

- Business modules
