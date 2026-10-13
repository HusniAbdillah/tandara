# Security and privacy model

This is a local simulation deployment. Controls are implemented and exercised by
the test suites; a real community launch still needs governance and independent
review with real users.

## Access and writes

- Salted scrypt passwords and constant-length timing-safe comparison. Unknown
  accounts incur equivalent hashing cost. Error text does not disclose existence.
- Random opaque eight-hour sessions stored as hashes, HttpOnly host cookies,
  SameSite Strict, explicit logout and immediate suspended-user/membership checks.
  Password/permission changes revoke existing sessions.
- Every authenticated mutation checks a hashed CSRF token. All public and private
  mutations require a non-simple client header and allowed Origin where provided.
  There is no permissive CORS policy. Cross-region and admin access fail server-side.
- Persisted IP/email rate controls restrict login/report/training abuse. General
  HTTP throttling is independent; reads remain bounded with pagination/limits.
- Zod validation, parameterized queries, revision locks, scoped foreign keys and
  independent plan review protect integrity. Append-only audit triggers reject
  updates/deletion of audit events.

## Exposure limits

Public feed excludes report originals, private contacts, help requests, photos and
AI output. Coordinators can publish a separate reviewed summary with a reason.
Help reports cannot be published through that operation. Private reads and photo
access are audited. Receipt secrets allow only simplified status and deletion
requests; secrets are sent in headers rather than URLs.

Images are bounded and decoded/re-encoded to strip metadata. Active SVG/HTML and
disguised files are rejected. Raw photo bytes never appear in public responses or
worker/model requests. CSP restricts scripts/workers to the local deployment;
Posko permits only the configured default OpenStreetMap tile host for its basemap.
Tile requests carry an origin-only referrer and no application session/receipt
headers; Warga retains no-referrer. Providers can see the viewed tile coordinates
and network metadata. Map popups use text nodes and React escapes user content.

AI input is untrusted data, isolated from system instructions. Valid output needs
quoted facts, exact source IDs and explicit human review. Invalid JSON, fabricated
evidence, provider outages and attempted autonomous verification are tested.
Accept/edit/reject does not change report truth or issue emergency instructions.

Contact data expires at its retention deadline. Daily maintenance erases report
text, locations, photos, suggestions, duplicate relations and private notes after
the configured region retention period, in batches of 200. Explicit resident
deletion requests use the same erasure operation. Minimal IDs and audit metadata
remain for accountability, without raw report text. Backups retain historical bytes
until their own protected retention schedule expires; restoring a backup requires
reapplying subsequent erasures before serving users.

## Deployment responsibilities

Use unique secrets, TLS and Secure cookies; restrict origins and proxy trust to a
controlled reverse proxy. Keep PostgreSQL private. Approve model data handling
before enabling inference. Encrypt volumes/backups and limit operator access;
the local Compose example does not provision encryption or key rotation. Do not
log credentials, receipt tokens, raw reports or contacts. Review audit access and
retention with the owning community and applicable Indonesian requirements.

MFA/SSO, independent penetration testing, capacity validation, availability SLOs,
real emergency response agreements and legal conclusions are not claimed by this
local simulation. Emergency contact numbers are deliberately not invented.
