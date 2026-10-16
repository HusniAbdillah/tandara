# Warga Chalk implementation

The approved [Chalk designs](https://www.figma.com/design/64n9YH2tieTKiDBHbYJoXZ) are implemented in `apps/resident-web`. The resident presentation is scoped in `warga.css`; Posko keeps its existing UI. Native Figma icon/logo/avatar exports are served locally from `public/design`. The app uses the existing Plus Jakarta Sans fonts and shared Button component.

## Flows

| Route                                                  | Behavior                                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `/`                                                    | Aligned desktop dashboard; mobile map preview, reporting/help actions and checklist         |
| `/login`, `/register`                                  | Centered phone/password forms, password visibility and server sessions                      |
| `/area`, `/profile`                                    | Region selection, profile, downloads, report status and logout                              |
| `/map`                                                 | Full map beside the desktop navigation; mobile map above the bottom navigation              |
| `/map?panel=filters`                                   | Independent layer switches and entry points to water and earthquake lists                   |
| `/map?panel=water`, `/map?panel=earthquakes`           | Secondary desktop sidebar; mobile list screen                                               |
| `/map?panel=water&id=…`, `/map?panel=earthquakes&id=…` | Observation details in the same sidebar, with a back action to the list                     |
| `/report`                                              | One-page desktop form; mobile category, details, location and review flow                   |
| `/support`                                             | Private help request and optional contact-sharing switch                                    |
| `/tracking`                                            | Shared report/help list and timeline; distinct queued and received states; deletion request |
| `/guide`, `/plan`, `/checklist`, `/downloads`          | Published plan, persistent family checklist and offline downloads                           |
| `/training`                                            | Per-question answers and feedback, server-scored completion and answer review               |
| `/notifications`, `/contacts`, `/help`                 | Local updates with source times, contact information and data controls                      |

Mobile uses a fixed four-item navigation and form action footer. Desktop uses a 232 px navigation sidebar, 384 px map detail panel and aligned responsive grids. Browser/system chrome from the Figma mockups is left to the browser/OS. Content comes from the existing APIs rather than hardcoded prototype claims. Settings and chat are absent from the active design.

## Observation API backbone

`GET /api/v1/regions/:regionId/observations` returns the shared `observationsSchema` contract. Water readings include location, height in centimetres, source status, update time and location-specific threshold labels. Earthquakes include coordinates, occurrence time, magnitude, depth, region and felt intensity/areas. Timestamps are ISO instants; the UI displays observation time in Asia/Jakarta.

`ObservationProvider.read(region)` is the upstream integration boundary, injected with `OBSERVATION_PROVIDER`. Replace `PendingObservationProvider` in `ProductModule` when the actual APIs arrive. The implementation must normalize and validate upstream payloads against `observationsSchema`, preserve source observation times and per-location thresholds, and keep upstream credentials on the server. No upstream URL or key is invented here.

The pending provider returns the three approved mock water locations and one representative earthquake **only for simulation regions**. Production regions return `mode: unconfigured` and empty arrays. Network errors never substitute mock readings. The map polls the canonical endpoint every minute while connected. Public reports without coordinates appear in search as text; the UI does not invent map positions for them.

The basemap uses MapLibre and runtime `public/basemap.json` with OpenStreetMap raster tiles and attribution. Caddy and Vercel policies allow the tile host for Warga, preserve private API requests on the app origin and use an origin-only referrer. A different basemap provider also requires updating those allowlists. Tile availability still depends on the external provider and network; retries are available.

## Accounts and existing report storage

Migration `010_residents` creates a separate resident account/session realm. Phone numbers normalize to `+62`; passwords use the existing salted scrypt implementation. Sessions use HttpOnly cookies, server expiry, CSRF validation on logout and independent rate limits. Resident sessions cannot authorize Posko endpoints. No credentials or bearer sessions are stored in localStorage.

The existing report capability model is preserved: private tracking uses per-device receipt tokens, and sign-in does not create a cross-device report history. Previously saved receipts remain readable. Consented text drafts are queued offline with idempotency keys; GPS, contact details and photos are not persisted in offline drafts. Consent is a short control in the final submission step. Source status comes from the server; submission does not invent later review/dispatch states.

Local IndexedDB/checklist queries run while offline. Queue mutations invalidate cached lists before navigation; reconnect synchronizes the same idempotent payload. Fonts and UI assets are precached; private API responses and map tiles are not added to service-worker caches.

## Validation

- Full workspace build and TypeScript checks; lint and architecture boundaries.
- Contract, backend and HTTP tests, including production observation isolation.
- PostgreSQL integration tests covering resident sign-up/login/logout, wrong-password rejection, CSRF and Posko isolation; existing report, AI, source and privacy workflows.
- Eight Chalk browser tests cover desktop/mobile layouts, map list/detail navigation, contact sharing, report submission, deletion request, checklist persistence, downloads, quiz results, centered auth, local assets, accessibility, offline reload and exactly-once reconnect synchronization.
- Real API browser smoke through the production Caddy configuration: registration, login, report receipt, logout, map tiles and water details. No uncaught browser errors.

Test services use isolated synthetic PostgreSQL/Redis data. The operator's `.env` files and pending `.env.production.example` change are excluded from this implementation.
