# Infrastructure scope

`deployment/` contains the separate Vercel + Tencent demo deployment: pruned
backend Dockerfile, private PostGIS/worker/API Compose, HTTPS Caddy, first-host
bootstrap and release/backup scripts. Follow
[deploy-demo.md](../docs/operations/deploy-demo.md); the development files below
remain local-only. Deployments are gated by `DEPLOY_ENABLED=true` and successful
CI on the exact current main revision.

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
