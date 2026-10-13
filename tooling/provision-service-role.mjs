import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire(new URL('../packages/database/package.json', import.meta.url));
const { Client } = require('pg');
if (process.env.APP_MODE !== 'production' || !process.env.SERVICE_DATABASE_URL)
  throw new Error('Separate production migration and service credentials required.');
const owner = new URL(process.env.DATABASE_URL);
const service = new URL(process.env.SERVICE_DATABASE_URL);
if (
  service.username !== 'tandara_app' ||
  service.host !== owner.host ||
  service.pathname !== owner.pathname ||
  owner.searchParams.get('sslmode') !== 'verify-full' ||
  !owner.searchParams.get('sslrootcert') ||
  service.searchParams.get('sslmode') !== 'verify-full' ||
  !service.searchParams.get('sslrootcert') ||
  decodeURIComponent(service.password).length < 24
)
  throw new Error('Invalid production service role profile.');
const db = new Client({ connectionString: owner.href });
await db.connect();
try {
  await db.query('BEGIN');
  const exists = (await db.query("SELECT 1 FROM pg_roles WHERE rolname='tandara_app'")).rows.length;
  const grants = await readFile(
    new URL('../infrastructure/postgres/service-role.sql', import.meta.url),
    'utf8',
  );
  await db.query(exists ? grants.replace(/^CREATE ROLE tandara_app.*;$/m, '') : grants);
  const statement = (
    await db.query("SELECT format('ALTER ROLE tandara_app PASSWORD %L', $1::text) statement", [
      decodeURIComponent(service.password),
    ])
  ).rows[0].statement;
  await db.query(statement);
  await db.query('COMMIT');
  console.info('Production service privileges provisioned.');
} catch {
  await db.query('ROLLBACK');
  console.error('Service role provisioning failed; credentials are not printed.');
  process.exitCode = 1;
} finally {
  await db.end();
}
