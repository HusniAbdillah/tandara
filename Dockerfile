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
USER node
EXPOSE 3000
CMD ["node","apps/api/dist/main.js"]

FROM caddy:2-alpine AS web
COPY --from=build /app/apps/resident-web/dist /srv/warga
COPY --from=build /app/apps/coordinator-web/dist /srv/posko
COPY infrastructure/caddy/Caddyfile.local /etc/caddy/Caddyfile
EXPOSE 8080 8081
