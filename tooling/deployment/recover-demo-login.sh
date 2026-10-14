#!/usr/bin/env bash
# Recover only existing seeded demo accounts; never prints credentials.
[[ $EUID -eq 0 ]] || { echo 'Run this script with sudo.' >&2; exit 1; }
umask 077
set -Eeuo pipefail
exec 9>/opt/tandara/deploy.lock
flock -n 9 || { echo 'Tunggu deployment selesai.'; exit 1; }
bash /opt/tandara/current/backup.sh
IFS= read -r -p 'Email login Posko (Enter = admin@demo.tandara.test): ' email </dev/tty
email=${email:-admin@demo.tandara.test}
dc=(docker compose --project-name tandara-demo --env-file /opt/tandara/.env --env-file /opt/tandara/current/release.env -f /opt/tandara/current/backend.compose.yml)
"${dc[@]}" run --rm --no-deps -T --workdir /app/api/node_modules/@tandara/backend -e RESET_EMAIL="$email" seed node --input-type=module <<'JS'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.resolve('@tandara/database'));
const { Client } = require('pg');
const email = process.env.RESET_EMAIL.trim().toLowerCase();
const ids = {
  'ciliwung@demo.tandara.test': '30000000-0000-4000-8000-000000000001',
  'semarang@demo.tandara.test': '30000000-0000-4000-8000-000000000002',
  'admin@demo.tandara.test': '30000000-0000-4000-8000-000000000003',
};
const password = process.env.DEMO_PASSWORD;
if (process.env.APP_MODE !== 'simulation') throw new Error('Pemulihan ini khusus akun demo simulation.');
if (!ids[email]) throw new Error('Pilih salah satu dari tiga email akun seed.');
if (!password || password.length < 12 || password.length > 200) throw new Error('DEMO_PASSWORD harus 12–200 karakter.');
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query('BEGIN');
  const result = await db.query('SELECT id,password_hash,suspended FROM users WHERE id=$1::uuid AND email=$2 FOR UPDATE', [ids[email], email]);
  const row = result.rows[0];
  if (!row) throw new Error('Akun seed tidak ditemukan; reset tidak dilakukan.');
  if (row.suspended) throw new Error('Akun dinonaktifkan; reset tidak dilakukan.');
  const [oldSalt, oldHash] = row.password_hash.split(':');
  const expected = Buffer.from(oldHash ?? '', 'hex');
  const actual = scryptSync(password, oldSalt || 'missing', 64);
  const matches = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!matches) {
    const salt = randomBytes(16).toString('hex');
    const encoded = salt + ':' + scryptSync(password, salt, 64).toString('hex');
    await db.query('UPDATE users SET password_hash=$1 WHERE id=$2::uuid', [encoded, row.id]);
    await db.query('DELETE FROM sessions WHERE user_id=$1::uuid', [row.id]);
    await db.query("INSERT INTO audit_events(actor_id,action,entity_id) VALUES(NULL,'demo.password_rotated',$1)", [row.id]);
  }
  await db.query('COMMIT');
  console.log(matches ? 'Password env SUDAH cocok dengan akun database; tidak diubah.' : 'Password akun disamakan dengan DEMO_PASSWORD; sesi akun dicabut.');
} catch (error) {
  await db.query('ROLLBACK');
  if (['Akun seed tidak ditemukan; reset tidak dilakukan.', 'Akun dinonaktifkan; reset tidak dilakukan.'].includes(error.message)) console.error(error.message);
  else console.error('Reset gagal; perubahan dibatalkan. Periksa koneksi/schema database.');
  process.exitCode = 1;
} finally {
  await db.end();
}
JS
