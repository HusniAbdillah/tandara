param([Parameter(Mandatory=$true)][string]$BackupPath)
$ErrorActionPreference = 'Stop'
$resolvedBackup = (Resolve-Path -LiteralPath $BackupPath).Path
if (-not (Test-Path -LiteralPath $resolvedBackup -PathType Leaf)) { throw 'Backup file missing' }
# Fixed, separate verification database; never drops or modifies the primary database.
$existing = docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT count(*) FROM pg_database WHERE datname=''tandara_restore_verification''"'
if ($LASTEXITCODE -ne 0 -or $existing.Trim() -ne '0') { throw 'Verification database already exists or inventory failed; choose a clean verification container.' }
docker compose cp $resolvedBackup postgres:/tmp/tandara-restore.dump
if ($LASTEXITCODE -ne 0) { throw 'Restore copy failed' }
docker compose exec -T postgres sh -c 'createdb -U "$POSTGRES_USER" tandara_restore_verification && pg_restore -U "$POSTGRES_USER" --exit-on-error -d tandara_restore_verification /tmp/tandara-restore.dump'
if ($LASTEXITCODE -ne 0) { throw 'Restore failed; verification database is preserved for diagnosis.' }
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d tandara_restore_verification -c "SELECT (SELECT count(*) FROM regions) regions,(SELECT count(*) FROM reports) reports,(SELECT count(*) FROM plan_versions) plans,(SELECT count(*) FROM audit_events) audit; SELECT extname FROM pg_extension;"'
if ($LASTEXITCODE -ne 0) { throw 'Verification query failed' }
