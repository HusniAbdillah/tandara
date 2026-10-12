# Offline boundary

Dexie owns saved plan snapshots, drafts, and the future submission queue.
Workbox owns the public app shell only. Do not create a second report queue in Workbox.

Before implementing sync: add multi-tab leases, request fingerprinting, receipt recovery,
retry classification, storage quota errors, and an explicit policy for contact/help-request data.
Private coordinator responses, help-request details, and media must never enter app-shell cache.
