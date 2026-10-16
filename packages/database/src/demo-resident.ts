import { randomBytes, scryptSync } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import type { Database } from './client.js';

/** Public judging account; credentials match the Warga login form defaults. */
export async function seedDemoResident(db: Kysely<Database>) {
  if (process.env['APP_MODE'] !== 'simulation')
    throw new Error('Demo resident allowed only in explicit simulation mode.');
  const salt = randomBytes(16).toString('hex');
  const hash = `${salt}:${scryptSync('TandaraDemo2026!', salt, 64).toString('hex')}`;
  await sql`INSERT INTO residents(id,phone,name,password_hash)
    VALUES('60000000-0000-4000-8000-000000000099'::uuid,'+6281234560001','Warga Demo',${hash})
    ON CONFLICT DO NOTHING`.execute(db);
}
