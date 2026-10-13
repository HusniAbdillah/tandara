import 'reflect-metadata';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { passwordHash } from '../packages/backend/dist/index.js';
import { encryptMfa, newMfa } from '../packages/backend/dist/modules/mfa.js';
const require = createRequire(new URL('../packages/database/package.json', import.meta.url));
const { Client } = require('pg');
if (process.env.APP_MODE !== 'production' || process.env.DEMO_PASSWORD)
  throw new Error('Requires isolated production mode with no demo credentials.');
try {
  const url = new URL(process.env.DATABASE_URL);
  if (url.searchParams.get('sslmode') !== 'verify-full' || !url.searchParams.get('sslrootcert'))
    throw new Error();
} catch {
  throw new Error('Production maintenance requires verified database TLS and a reviewed CA.');
}
const inputPath = process.argv[2];
const outputPath = process.argv[3];
if (!inputPath || !outputPath)
  throw new Error('Provide private onboarding JSON and private enrollment output paths.');
const input = JSON.parse(await readFile(inputPath, 'utf8'));
if (!Array.isArray(input.accounts) || input.accounts.length < 3)
  throw new Error('Provide an operator and at least two independent approvers.');
if (
  !input.accounts.some((a) => a.aiRole === 'operator') ||
  input.accounts.filter((a) => a.aiRole === 'approver').length < 2 ||
  new Set(input.accounts.map((a) => a.email)).size !== input.accounts.length
)
  throw new Error('Independent operator and approvers required.');
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const enrollments = [];
try {
  await db.query('BEGIN');
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended('production-onboarding',0))");
  if ((await db.query('SELECT id FROM users LIMIT 1')).rows.length)
    throw new Error(
      'Fresh production database required; use authorized account administration for existing systems.',
    );
  for (const account of input.accounts) {
    if (
      typeof account.password !== 'string' ||
      account.password.length < 16 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email) ||
      typeof account.name !== 'string' ||
      account.name.length < 3 ||
      !['operator', 'approver'].includes(account.aiRole)
    )
      throw new Error('Invalid account configuration.');
    const mfa = newMfa(account.email);
    const row = (
      await db.query(
        "INSERT INTO users(email,name,password_hash,role,totp_secret) VALUES($1,$2,$3,'admin',$4) RETURNING id",
        [account.email, account.name, await passwordHash(account.password), encryptMfa(mfa.secret)],
      )
    ).rows[0];
    await db.query('INSERT INTO ai_admin_roles(user_id,role) VALUES($1,$2)', [
      row.id,
      account.aiRole,
    ]);
    await db.query(
      "INSERT INTO audit_events(actor_id,action,entity_id) VALUES($1,'production.onboarded',$1)",
      [row.id],
    );
    enrollments.push({ email: account.email, ...mfa });
  }
  // Write exclusively before commit; failures leave no half-onboarded production database.
  await writeFile(outputPath, JSON.stringify(enrollments, null, 2), { mode: 0o600, flag: 'wx' });
  await db.query('COMMIT');
  console.info(
    'Accounts provisioned; distribute private enrollment records through the approved secure channel.',
  );
} catch {
  await db.query('ROLLBACK');
  console.error('Onboarding failed; no credentials are printed.');
  process.exitCode = 1;
} finally {
  await db.end();
}
