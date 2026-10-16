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
  local status=$?
  if ((status != 0)); then
    "${dc[@]}" logs --tail 60 api worker >&2 || true
  fi
  [[ "$project" =~ ^tandara-smoke-[0-9]+$ ]] || return 1
  "${dc[@]}" down --volumes --remove-orphans
}
trap cleanup EXIT
"${dc[@]}" up -d --wait --wait-timeout 180 postgres
"${dc[@]}" run --rm --no-deps migrate
"${dc[@]}" run --rm --no-deps seed
# Exercise the incremental VPS seeder twice against the isolated smoke database.
"${dc[@]}" run --rm --no-deps seed-resident
"${dc[@]}" run --rm --no-deps seed-resident
# Reports must land only in the existing Ciliwung and Semarang regions.
resident_reports=$("${dc[@]}" exec -T postgres psql -U tandara -d tandara -At -c "SELECT count(*) FROM reports WHERE id::text LIKE '42000000-%'")
resident_ciliwung=$("${dc[@]}" exec -T postgres psql -U tandara -d tandara -At -c "SELECT count(*) FROM reports r JOIN regions g ON g.id=r.region_id WHERE r.id::text LIKE '42000000-%' AND g.name='Kampung Ciliwung'")
resident_semarang=$("${dc[@]}" exec -T postgres psql -U tandara -d tandara -At -c "SELECT count(*) FROM reports r JOIN regions g ON g.id=r.region_id WHERE r.id::text LIKE '42000000-%' AND g.name='Pesisir Semarang'")
[[ "$resident_reports" == 25 && "$resident_ciliwung" == 13 && "$resident_semarang" == 12 ]] || { echo "Expected 25 resident workflow reports (13 Ciliwung, 12 Semarang) after repeated incremental seed; got $resident_reports ($resident_ciliwung, $resident_semarang)." >&2; exit 1; }
fixture_regions=$("${dc[@]}" exec -T postgres psql -U tandara -d tandara -At -c "SELECT count(*) FROM regions WHERE name IN ('Kampung Ciliwung','Pesisir Semarang')")
all_regions=$("${dc[@]}" exec -T postgres psql -U tandara -d tandara -At -c 'SELECT count(*) FROM regions')
[[ "$fixture_regions" == 2 && "$all_regions" == 2 ]] || { echo 'Resident seeder must use the two existing regions and create no regions.' >&2; exit 1; }
"${dc[@]}" up -d --wait --wait-timeout 180 api worker
"${dc[@]}" exec -T api node --input-type=module < tooling/deployment/smoke-http.mjs
"${dc[@]}" exec -T worker node worker/node_modules/@tandara/backend/worker-health.mjs
"${dc[@]}" exec -T postgres pg_dump -U tandara -d tandara -Fc > "$temp/backup.dump"
"${dc[@]}" exec -T postgres pg_restore --list < "$temp/backup.dump" >/dev/null
"${dc[@]}" exec -T postgres createdb -U tandara tandara_restore_smoke
"${dc[@]}" exec -T postgres pg_restore -U tandara -d tandara_restore_smoke --exit-on-error < "$temp/backup.dump"
regions=$("${dc[@]}" exec -T postgres psql -U tandara -d tandara_restore_smoke -At -c 'SELECT count(*) FROM regions')
[[ "$regions" == 2 ]] || { echo 'Restored seed regions do not match.' >&2; exit 1; }
echo 'Production image: migration, seed, incremental resident seed, API cookie/CSRF, SQL worker and backup restore passed.'
