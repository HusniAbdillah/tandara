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

## Live observation API

`GET /api/v1/regions/:regionId/observations` returns the shared `observationsSchema` contract. Water readings include location, height in centimetres, source status, update time and location-specific threshold labels. Earthquakes include coordinates, occurrence time, magnitude, depth, region and felt intensity/areas. Timestamps are ISO instants; the UI displays observation time in Asia/Jakarta.

`ObservationProvider.read(region)` is the upstream integration boundary, injected with `OBSERVATION_PROVIDER`. `LiveObservationProvider` fetches public water levels from [Dinas SDA DKI Jakarta](https://poskobanjir.dsdadki.web.id/) and the [15 recent felt earthquakes from BMKG](https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json). No upstream API key is needed. Both feeds cover their source's full geographical scope, independent of the selected RW. The map's radius switches can narrow visible pins; the lists remain searchable across the supplied feed.

`OBSERVATIONS_MODE=live` is the default in local and production deployments, independently of `APP_MODE` and the administration's separately configured `ALLOW_LIVE_SOURCES` integrations. These two fixed public feeds send no resident content upstream. `simulation` explicitly selects the example provider for simulation regions only; production startup rejects that setting. `disabled` returns `mode: unconfigured`. Network errors never substitute sample readings.

Each API process caches each upstream for 60 seconds and shares in-flight work between all callers/regions. The sources refresh independently with a ten-second timeout, two-megabyte streamed response limit, and redirects disabled. Successful snapshots survive fetch/parse failures for up to 24 hours in memory. `sources[]` identifies each source, its URL, `checkedAt`, `lastSuccessAt`, `skippedRecords`, and `ready`, `stale` or `unavailable` status. A cold failure returns an empty array for that source; after 24 hours without success its retained records are also omitted. Restarting an API process resets its cache. With two API replicas this normally produces two requests per source per minute, below BMKG's documented 60/minute/IP limit. Further scaling should move the cache to shared storage or a single refresh worker.

The DSDA adapter parses HTML without executing scripts. It reads station IDs and coordinates from literal popup data, measurements and timestamps from the table, and the published status icon. Threshold arguments are converted from millimetres to centimetres. Signed water levels are preserved: they are station readings, not flood depth. Statuses are `normal`, `waspada` (Siaga III), `siaga` (Siaga II), and `bahaya` (Siaga I). For strictly ordered thresholds, ranges follow the source's `>` comparisons; equality stays in the lower level. Repeated or reversed thresholds remain in `rawThresholdsCm` with empty display ranges, rather than invented boundaries. Bad rows are counted and skipped; an empty or mostly invalid feed is treated as a source failure so the previous snapshot is retained.

Water locations without usable display ranges use grey map pins and a grey `Belum diketahui` status in the detail and list, regardless of the status published by the source. The original status remains in the API for provenance; the UI does not imply a danger level without location-specific thresholds.

BMKG's latitude/longitude order, magnitude, depth in kilometres, felt areas/MMI, and original event time are normalized, validated, deduplicated and sorted newest first. ISO timestamps accept UTC or explicit offsets and normalize to UTC. The UI displays times in Asia/Jakarta, source attribution links, all four water statuses, and concise source-unavailable/stale states. It polls the canonical endpoint every minute while connected. Public reports without coordinates appear in search as text; the UI does not invent map positions for them. The BMKG feed contains recent felt events, not an earthquake archive or a tsunami forecast.

The basemap uses MapLibre and runtime `public/basemap.json` with OpenStreetMap raster tiles and attribution. Caddy and Vercel policies allow the tile host for Warga, preserve private API requests on the app origin and use an origin-only referrer. A different basemap provider also requires updating those allowlists. Tile availability still depends on the external provider and network; retries are available.

## Accounts and existing report storage

Migration `010_residents` creates a separate resident account/session realm. Phone numbers normalize to `+62`; passwords use the existing salted scrypt implementation. Sessions use HttpOnly cookies, server expiry, CSRF validation on logout and independent rate limits. Resident sessions cannot authorize Posko endpoints. No credentials or bearer sessions are stored in localStorage.

Migration `011_resident_integration` links signed-in submissions to their resident account. `GET /resident/reports` returns paginated account history across devices, while `/resident/reports/:id` and its `/tracking` and `/deletion-request` routes enforce ownership using the resident session. Account history is fetched into memory, not persisted into IndexedDB. The public receipt-token routes continue to work for existing guest reports. A signed-in user can choose **Hubungkan laporan di perangkat ini ke akun** to claim older reports by proving possession of their existing receipt secrets; reports already owned by another account cannot be transferred.

Resident writes require the resident CSRF cookie/header. The server derives ownership from the authenticated session, never from report input. Local receipts/drafts carry their account ID; the UI hides other accounts' records and queued drafts are not sent under a different account. Replays retain their original account expectation. Consented text drafts still use idempotency keys; GPS, contact details and photos are not persisted in offline drafts. Consent is a short control in the final submission step. Source status comes from the server; submission does not invent later review/dispatch states.

Personal in-app notifications are stored when Posko changes report or assistance status. A database trigger writes the event code in the same transaction as report history, without copying private notes, contacts or AI output. `/resident/notifications` provides unread counts; the read endpoint checks ownership and CSRF, and read state is shared across devices. Warga polls notifications every 15 seconds while online, displays a bell badge and opens the associated report. Public **Kabar sekitar** remains separate below personal notifications. These are in-app notifications, not OS/browser push delivery. Erasure also clears the account/report association and its personal notifications, including when privacy erasures are replayed after a restore.

Posko's existing situation map now consumes the same observation endpoint as Warga, with independent water/earthquake switches, source attribution, selectable lists/details and map markers. Existing report, plan and coverage layers are preserved. Missing/ambiguous water thresholds use grey markers and **Belum diketahui** in both apps.

Local IndexedDB/checklist queries run while offline. Queue mutations invalidate cached lists before navigation; reconnect synchronizes the same idempotent payload. Fonts and UI assets are precached; private API responses and map tiles are not added to service-worker caches.

## Validation

- Full workspace build and TypeScript checks; lint and architecture boundaries.
- Contract, backend and HTTP tests, including production observation isolation.
- PostgreSQL integration tests covering resident sign-up/login/logout, wrong-password rejection, CSRF and Posko isolation; existing report, AI, source and privacy workflows.
- Browser tests cover desktop/mobile layouts, map list/detail navigation, contact sharing, report submission, deletion request, checklist persistence, downloads, quiz results, centered auth, local assets, accessibility, offline reload, exactly-once reconnect synchronization, fresh-device account history and private notifications, and Posko's shared observation layers.
- Real API browser smoke through the production Caddy configuration: registration, login, report receipt, logout, map tiles and water details. No uncaught browser errors.

Test services use isolated synthetic PostgreSQL/Redis data. The operator's `.env` files and pending `.env.production.example` change are excluded from this implementation.
