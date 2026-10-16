# Warga and Posko integration verification

Verified locally on 16 October 2026 with isolated synthetic accounts and databases.

## Delivered

- Signed-in reports belong to the resident account and appear on another device. Existing guest receipts can be linked explicitly using their receipt secrets.
- Posko report and assistance status changes create durable personal in-app notifications. Read state follows the account. Browser/OS push delivery is outside this change.
- Posko displays the shared DSDA water and BMKG earthquake feeds, alongside its existing report, plan and coverage layers. Water readings without usable thresholds remain grey with **Belum diketahui**.
- Migration `011_resident_integration` adds ownership and notifications. Privacy erasure clears both, including erasure replay after backup restoration.

## Checks

- Workspace lint, architecture boundaries, TypeScript checks and production builds passed.
- 113 backend unit tests, seven contract tests and five HTTP tests passed.
- 59 database/API integration tests passed, including cross-account isolation, CSRF, receipt claims, idempotency, report reviews, assistance updates, privacy erasure and backup restoration.
- All 13 Warga/Posko browser tests passed. The expanded Posko regression also passed with 35 station rows, checking that rows do not shrink or overlap and that unknown-threshold markers are grey.
- A browser run against the real API submitted a report, opened it in a second resident session, reviewed it through Posko, received the personal notification, and opened the updated tracking page. Mobile tracking had no horizontal overflow. No uncaught browser errors occurred.
- The same run loaded 35 water locations and 15 earthquakes from the live observation adapter. Source availability and record counts reflect that run, rather than a permanent guarantee.

The existing local environment files were not committed. No production deployment is implied by these local results.
