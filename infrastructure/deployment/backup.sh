#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
root=/opt/tandara
release=$(readlink -f "$root/current")
[[ "$release" == "$root/releases/"* ]] || { echo 'No valid active release.' >&2; exit 1; }
dc=(docker compose --project-name tandara-demo --env-file "$root/.env" --env-file "$release/release.env" -f "$release/backend.compose.yml")
backup="$root/backups/tandara-$(date -u +%Y%m%dT%H%M%SZ)-$$.dump"
"${dc[@]}" exec -T postgres pg_dump -U tandara -d tandara -Fc > "$backup.partial"
"${dc[@]}" exec -T postgres pg_restore --list < "$backup.partial" >/dev/null
mv "$backup.partial" "$backup"
sha256sum "$backup"
