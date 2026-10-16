# Warga and Posko integration verification

Verified locally on 16 October 2026 with isolated synthetic accounts and databases.

## Delivered

- Signed-in reports belong to the resident account and appear on another device. Existing guest receipts can be linked explicitly using their receipt secrets.
- Warga pages require login except registration and login themselves. All resident writes require a valid resident session and CSRF; receipt mutations also enforce account ownership. Expired sessions redirect to login while account-owned queued reports remain intact. Public API reads are separate from the protected app pages.
- Posko report and assistance status changes create durable personal in-app notifications. Read state follows the account. Browser/OS push delivery is outside this change.
- Posko displays the shared DSDA water and BMKG earthquake feeds, alongside its existing report, plan and coverage layers. Water readings without usable thresholds remain grey with **Belum diketahui**.
- Migration `011_resident_integration` adds ownership and notifications. Privacy erasure clears both, including erasure replay after backup restoration.
- Migration `013_resident_report_phone` captures the registered phone for scoped Posko report details, separately from optional extra contacts, within the existing contact retention lifecycle. Existing owned reports still within retention are populated during upgrade.

## Checks

- Workspace lint, architecture boundaries, TypeScript checks and production builds passed.
- 113 backend unit tests, seven contract tests and five HTTP tests passed.
- 64 database/API integration tests passed, including missing/forged/expired session rejection on every resident submission route, cross-account isolation, CSRF, receipt claims, idempotency, report reviews, assistance updates, private registered phone access, contact expiry, migration backfill, privacy erasure and backup restoration.
- All 17 standard Warga/Posko browser tests passed. These include signed-out route redirects, preserved login destinations, external redirect rejection, expired submissions, offline authentication and exactly-once queue synchronization after reconnect. The expanded Posko regression also passed with 35 station rows, checking that rows do not shrink or overlap and that unknown-threshold markers are grey.
- A browser run against the real API submitted a report, opened it in a second resident session, reviewed it through Posko, received the personal notification, and opened the updated tracking page. Mobile tracking had no horizontal overflow. No uncaught browser errors occurred.
- The same run loaded 35 water locations and 15 earthquakes from the live observation adapter. Source availability and record counts reflect that run, rather than a permanent guarantee.
- A further browser run registered through the Warga form, submitted a signed-in report, and opened its registered phone as a callable link in Posko. The number was displayed at desktop and mobile widths without overflow; passwords were absent from the staff API response. This run used an isolated synthetic database with AI disabled.

The existing local environment files were not committed. No production deployment is implied by these local results.
