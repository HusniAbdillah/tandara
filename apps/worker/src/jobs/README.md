# Job adapters

Add BullMQ consumers here when their business use cases are implemented.
The foundation has no consumers and rejects WORKER_ENABLED=true.

Consumers call public operations from @tandara/backend; do not import apps/api.
Validate internal job payloads, enforce service permissions, and make effects idempotent.
Use PostgreSQL outbox records to bridge committed transactions to the Redis queue.
Do not acknowledge an outbox event as processed merely because enqueue succeeded.
Do not label deterministic fixtures as live model output.
