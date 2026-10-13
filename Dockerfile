FROM node:24-alpine AS build
WORKDIR /app
RUN npm install --global pnpm@10.26.2
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build

FROM node:24-alpine AS app
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages ./packages
COPY --from=build --chown=node:node /app/apps/api ./apps/api
COPY --from=build --chown=node:node /app/apps/worker ./apps/worker
COPY --from=build --chown=node:node /app/tooling/worker-health.mjs ./tooling/worker-health.mjs
COPY --from=build --chown=node:node /app/tooling/ai-checkpoints.mjs ./tooling/ai-checkpoints.mjs
COPY --from=build --chown=node:node /app/tooling/onboard-production.mjs ./tooling/onboard-production.mjs
COPY --from=build --chown=node:node /app/tooling/provision-service-role.mjs ./tooling/provision-service-role.mjs
COPY --from=build --chown=node:node /app/tooling/provision-production-user.mjs ./tooling/provision-production-user.mjs
COPY --from=build --chown=node:node /app/tooling/export-privacy-ledger.mjs ./tooling/export-privacy-ledger.mjs
COPY --from=build --chown=node:node /app/tooling/privacy-ledger-backup.mjs ./tooling/privacy-ledger-backup.mjs
COPY --from=build --chown=node:node /app/tooling/restore-privacy.mjs ./tooling/restore-privacy.mjs
COPY --from=build --chown=node:node /app/infrastructure/postgres/service-role.sql ./infrastructure/postgres/service-role.sql
COPY --from=build --chown=node:node /app/infrastructure/postgres/rds-ca-bundle.pem ./infrastructure/postgres/rds-ca-bundle.pem
USER node
EXPOSE 3000
CMD ["node","apps/api/dist/main.js"]

FROM caddy:2-alpine AS web-base
COPY --from=build /app/apps/resident-web/dist /srv/warga
COPY --from=build /app/apps/coordinator-web/dist /srv/posko
COPY infrastructure/caddy/Caddyfile.local /etc/caddy/Caddyfile
EXPOSE 8080 8081

FROM web-base AS web-production
COPY infrastructure/caddy/Caddyfile.production /etc/caddy/Caddyfile

FROM web-base AS web
