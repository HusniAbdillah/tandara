#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
root=/opt/tandara
release=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
sha=${1:?Release commit SHA required}
expected_image_id=${2:?Expected Docker config digest required}
[[ "$sha" =~ ^[a-f0-9]{40}$ && "$release" == "$root/releases/$sha" ]] || { echo 'Invalid release path/SHA.' >&2; exit 1; }
[[ "$expected_image_id" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo 'Invalid config digest.' >&2; exit 1; }
[[ -f "$root/.env" ]] || { echo 'Install /opt/tandara/.env first.' >&2; exit 1; }
[[ "$(stat -c %a "$root/.env")" == 600 ]] || { echo '.env must have mode 600.' >&2; exit 1; }
exec 9>"$root/deploy.lock"
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
# This is a trusted operator-owned shell-compatible environment, never uploaded by CI.
set -a
# shellcheck source=/dev/null
source "$root/.env"
set +a
[[ ${POSTGRES_PASSWORD:-} =~ ^[a-fA-F0-9]{32,}$ ]] || { echo 'Set a random hexadecimal database password.' >&2; exit 1; }
demo_password=${DEMO_PASSWORD:-}
[[ ${#demo_password} -ge 12 && "$demo_password" != REPLACE_* ]] || { echo 'Set a unique demo password.' >&2; exit 1; }
[[ ${API_DOMAIN:-} =~ ^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$ ]] || { echo 'Set API_DOMAIN.' >&2; exit 1; }
[[ ${WEB_ORIGINS:-} == https://* && "$WEB_ORIGINS" != *'*'* ]] || { echo 'Set exact HTTPS WEB_ORIGINS.' >&2; exit 1; }
image="tandara-backend:$sha"
# Docker's classic and containerd stores expose different .Id meanings.
# Re-export the loaded tag and compare its config (including layer diff IDs).
actual_image_id=$(docker image save "$image" | python3 "$release/image_config_id.py" - "$image")
printf 'Loaded release config digest: %s\n' "$actual_image_id"
[[ "$actual_image_id" == "$expected_image_id" ]] || {
  printf 'Loaded image config mismatch: expected %s, got %s.\n' "$expected_image_id" "$actual_image_id" >&2
  exit 1
}
printf 'APP_IMAGE=%s\nPOSTGRES_IMAGE=tandara-postgres:%s\n' "$image" "$sha" > "$release/release.env"
dc=(docker compose --project-name tandara-demo --env-file "$root/.env" --env-file "$release/release.env" -f "$release/backend.compose.yml")
"${dc[@]}" config --quiet
previous=''
if [[ -L "$root/current" ]]; then
  previous=$(readlink -f "$root/current")
  [[ "$previous" == "$root/releases/"* ]] || { echo 'Invalid current release.' >&2; exit 1; }
  bash "$previous/backup.sh"
elif [[ ${SEED_DEMO_ON_FIRST_DEPLOY:-false} != true ]]; then
  echo 'First deployment requires explicit SEED_DEMO_ON_FIRST_DEPLOY=true.' >&2
  exit 1
fi
recover() {
  code=$?
  trap - ERR
  echo 'Deployment failed; no database restore or destructive rollback will run.' >&2
  if [[ -n "$previous" ]]; then
    docker compose --project-name tandara-demo --env-file "$root/.env" --env-file "$previous/release.env" \
      -f "$previous/backend.compose.yml" up -d --wait --wait-timeout 180 api worker caddy || \
      echo 'Previous app could not be restarted. Inspect migration compatibility and restore separately.' >&2
  fi
  exit "$code"
}
trap recover ERR
"${dc[@]}" up -d --wait --wait-timeout 180 postgres
"${dc[@]}" run --rm --no-deps migrate
if [[ -z "$previous" ]]; then "${dc[@]}" run --rm --no-deps seed; fi
"${dc[@]}" up -d --wait --wait-timeout 180 api worker caddy
curl --fail --silent --show-error --retry 12 --retry-delay 5 --retry-all-errors "https://$API_DOMAIN/ready" >/dev/null
ln -sfn "$release" "$root/current.new"
mv -Tf "$root/current.new" "$root/current"
echo "Backend healthy at release $sha"
