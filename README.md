# Tandara / ArahSiaga

Community flood preparedness: **Tandara Warga** (resident PWA) and **Tandara Posko**
(coordinator/admin workspace), connected to one API, PostGIS database and durable worker.
Indonesian interface. Seeded organizations, people, plans, reports and source material are
explicitly **simulation**, not real incidents or operational emergency instructions.

## Run the complete local product

Prerequisite: Docker Desktop with Linux containers. Ports 8080 and 8081 must be free.

```powershell
Copy-Item .env.example .env # only if .env does not already exist
# Edit .env: choose POSTGRES_PASSWORD and DEMO_PASSWORD (at least 12 characters).
docker compose up --build -d --wait
```

Do not commit `.env`. The sample passwords are for local synthetic data only. Compose
applies migrations, performs an idempotent simulation seed, then checks API, worker,
database and web health. Database storage persists across restarts; no database port
is exposed by the complete stack. `docker compose down` stops it without deleting data.

| Service   | Local address                                                    |
| --------- | ---------------------------------------------------------------- |
| Warga     | [127.0.0.1:8080](http://127.0.0.1:8080)                          |
| Posko     | [127.0.0.1:8081](http://127.0.0.1:8081)                          |
| Readiness | [8080/ready](http://127.0.0.1:8080/ready)                        |
| OpenAPI   | [OpenAPI JSON](http://127.0.0.1:8080/api/v1/system/openapi.json) |

Login to Posko with the password you set in `DEMO_PASSWORD`:

| Account                      | Access                                   |
| ---------------------------- | ---------------------------------------- |
| `ciliwung@demo.tandara.test` | Kampung Ciliwung coordinator             |
| `semarang@demo.tandara.test` | Pesisir Semarang coordinator             |
| `admin@demo.tandara.test`    | Administrator, independent plan reviewer |

Warga needs no account. Receipt secrets remain on the device; retain them before
clearing local data. Password changes after initial seed use Admin → Akses pengguna;
rerunning seed does not overwrite existing passwords or reviewed data.

## Demo and verification

[Demo walkthrough](docs/product/demo.md), [delivery report](docs/DELIVERY.md),
[completion matrix](docs/product/requirements-matrix.md),
[screenshots](docs/qa/screenshots), [architecture](docs/ARCHITECTURE.md),
[operating runbook](docs/operations/runbook.md), [security](docs/security/model.md).

The implemented flows cover source provenance, uncertain reports, private assistance,
processed private photos, provisional triage, reversible duplicate linking, human
review, versioned plans with independent approval, explainable coverage gaps,
offline plans/checklists/text drafts, simulation training and scoped administration.
Posko displays local layers over an attributed OpenStreetMap street basemap;
[map configuration and outage behavior](docs/features/map.md) explain its provider settings.
BMKG/PetaBencana adapters are disabled until configured and authorized. InaRISK is
reference-only. The default triage is labelled **deterministic**, not live inference.

## Development and tests

Routine CI checks code, builds, real database/API integration and deployment
configuration. Full Docker/browser tests are available through **Actions → CI →
Run workflow → full_e2e**; run them before the jury rehearsal. See the
[CI coverage policy](docs/operations/ci-policy.md).

Use Node 22.22.0–24.x and pnpm 10.26.2. Docker uses Node 24; CI and local
validation use Node 24.20.0 from `.node-version`.

```powershell
npx --yes pnpm@10.26.2 install --frozen-lockfile
npx --yes pnpm@10.26.2 infra:up
npx --yes pnpm@10.26.2 db:migrate
npx --yes pnpm@10.26.2 db:seed
npx --yes pnpm@10.26.2 dev
```

Development addresses are 5173 (Warga), 5174 (Posko), and 3000 (API). Vite proxies
`/api`; secrets never use a `VITE_` prefix. Full-stack Docker and development use
separate databases. Development PostgreSQL uses 55432; adjust Redis port if Windows
reserves 56379. Redis remains foundation infrastructure and is not needed by the
implemented PostgreSQL outbox worker.

```powershell
npx --yes pnpm@10.26.2 format:check
npx --yes pnpm@10.26.2 check
npx --yes pnpm@10.26.2 test:integration # seeded development DB; synthetic mutations
npx --yes pnpm@10.26.2 exec playwright install chromium
npx --yes pnpm@10.26.2 test:e2e # running full Docker stack at 8080/8081
npx --yes pnpm@10.26.2 api:openapi
node --env-file=.env tooling/measure-performance.mjs
pwsh -NoProfile -File tooling/backup.ps1
```

Tests are intended for simulation data, never a real operational database. Browser
tests add clearly labelled synthetic reports and training outcomes. Integration
tests also publish/erase test records and add fictional scoped accounts.

## Deployment boundary

For the three-week jury demo on Vercel + Tencent, follow the
[automatic deployment guide](docs/operations/deploy-demo.md). It includes the
one-time Ubuntu setup, DNS, repository secrets, CI-gated release and backup flow.

This delivery runs locally as a simulation. Public deployment requires a configured
domain/TLS, `SESSION_SECURE=true`, exact `WEB_ORIGINS`, restricted proxy trust, unique
secrets, encrypted backups, approved source/model providers and genuine plan/contact
ownership. Never expose these demo accounts publicly. See the runbook for concrete
configuration, restoration, monitoring and incident procedures.
