# Infrastructure scope

`compose/compose.dev.yml` starts local PostgreSQL/PostGIS and Redis only.
Database ports bind to loopback. API/web/worker run through pnpm for fast reloads.
Redis uses AOF and noeviction; cache TTL/queue job retention must be set before enabling consumers.

`caddy/Caddyfile` is a routing template, not a deployment. It requires real domains,
an API container named api, and built assets mounted under /srv/resident and /srv/coordinator.
Production needs reviewed image digests, non-root application images, resource limits,
private networks, service health checks, secrets, migrations, and backup/restore procedures.
Do not publish the development Compose file or its local credentials as production configuration.

Storage/media are intentionally deferred. Select a maintained S3-compatible implementation
when the media slice is scheduled; MinIO Community is no longer the default.
