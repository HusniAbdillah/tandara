$ErrorActionPreference = 'Stop'
$backupDir = Join-Path (Get-Location) '.local/backups'
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$backupPath = Join-Path $backupDir ('tandara-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.dump')
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/tandara-backup.dump'
if ($LASTEXITCODE -ne 0) { throw 'Database dump failed' }
docker compose cp postgres:/tmp/tandara-backup.dump $backupPath
if ($LASTEXITCODE -ne 0) { throw 'Backup copy failed' }
Get-FileHash -Algorithm SHA256 -LiteralPath $backupPath | Format-List
Write-Output $backupPath
