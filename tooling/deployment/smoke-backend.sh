#!/usr/bin/env bash
set -Eeuo pipefail
image=${1:?Pass the already built deployment image}
[[ "$image" =~ ^tandara-backend:[a-zA-Z0-9._-]+$ ]] || { echo 'Unexpected smoke image.' >&2; exit 1; }
postgres_image="tandara-postgres:${image#tandara-backend:}"
mkdir -p .local
temp=$(mktemp -d "$PWD/.local/deploy-smoke.XXXXXX")
project="tandara-smoke-$$"
printf 'APP_IMAGE=%s\nPOSTGRES_IMAGE=%s\nPOSTGRES_PASSWORD=0123456789abcdef0123456789abcdef\nDEMO_PASSWORD=synthetic-smoke-only\nAPI_DOMAIN=smoke.invalid\nWEB_ORIGINS=https://tandara.my.id,https://posko.tandara.my.id\n' "$image" "$postgres_image" > "$temp/smoke.env"
dc=(docker compose --project-name "$project" --env-file "$temp/smoke.env" -f infrastructure/deployment/backend.compose.yml)
cleanup() {
  [[ "$project" =~ ^tandara-smoke-[0-9]+$ ]] || return 1
  "${dc[@]}" down --volumes --remove-orphans
}
trap cleanup EXIT
"${dc[@]}" up -d --wait --wait-timeout 180 postgres
"${dc[@]}" run --rm --no-deps migrate
"${dc[@]}" run --rm --no-deps seed
"${dc[@]}" up -d --wait --wait-timeout 180 api worker
"${dc[@]}" exec -T api node --input-type=module < tooling/deployment/smoke-http.mjs
"${dc[@]}" exec -T worker node worker/node_modules/@tandara/backend/worker-health.mjs
"${dc[@]}" exec -T postgres pg_dump -U tandara -d tandara -Fc > "$temp/backup.dump"
"${dc[@]}" exec -T postgres pg_restore --list < "$temp/backup.dump" >/dev/null
"${dc[@]}" exec -T postgres createdb -U tandara tandara_restore_smoke
"${dc[@]}" exec -T postgres pg_restore -U tandara -d tandara_restore_smoke --exit-on-error < "$temp/backup.dump"
regions=$("${dc[@]}" exec -T postgres psql -U tandara -d tandara_restore_smoke -At -c 'SELECT count(*) FROM regions')
[[ "$regions" == 2 ]] || { echo 'Restored seed regions do not match.' >&2; exit 1; }
echo 'Production image: migration, seed, API cookie/CSRF, SQL worker and backup restore passed.'
