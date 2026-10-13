# Offline saving and delivery

Warga installs a public shell and offers explicit plan saving. Reopening a saved
plan offline shows its version, owner, review/expiry and device-saved timestamps.
Cached or expired information carries a warning. Live source feeds are not cached
as current conditions. Uncached plans and training fail visibly while offline.

The checklist stays on the device. A text draft requires consent, region/category,
description and optional landmark/time. Offline GPS, contact details and photos
are excluded. Drafts remain labelled pending until an API receipt is validated;
an online event, thirty-second timer or manual action attempts synchronization.

Each draft has a stable UUID idempotency key and random receipt secret. A timeout
replays the same payload/key. PostgreSQL serializes identical keys and refuses
changed payloads; the browser atomically saves receipt and removes draft after
acknowledgement. Navigator locks serialize tabs, and a restarted `syncing` draft
can be replayed safely. Five failed attempts pause automatic delivery; manual
retry remains available. Seven-day-old drafts are deleted on queue maintenance.

API responses, session information, private contacts, GPS and photos are not
service-worker cached. Sensitive online submissions retry the same in-memory
payload, with no persistent private draft. Closing the page before acknowledgement
can lose receipt recovery; the UI discloses this limitation. Photos are uploaded
after report acceptance and their failure is separate from report status.

Shared-device users can clear saved plans/drafts/receipts in Bantuan & privasi.
Receipt secrets grant status/deletion-request access: do not share them. Browser
storage eviction or a full device can prevent saving, and an explicit error is
shown. New app-shell versions prompt the user before reload; a form in progress
is never forcibly discarded.

`tests/e2e/product.spec.ts` actually disconnects Chromium networking, reloads the
saved plan, checks persistent checklist state, creates a pending draft, reconnects
and verifies a single acknowledged receipt. API integration tests also submit
identical keys concurrently and reject conflicting retries.
