import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Database } from './client.js';

export const demoAccounts = {
  coordinators: [
    {
      id: '30000000-0000-4000-8000-000000000001',
      email: 'ciliwung@demo.tandara.test',
      name: 'Koordinator Ciliwung',
      role: 'coordinator',
    },
    {
      id: '30000000-0000-4000-8000-000000000002',
      email: 'semarang@demo.tandara.test',
      name: 'Koordinator Semarang',
      role: 'coordinator',
    },
    {
      id: '30000000-0000-4000-8000-000000000003',
      email: 'admin@demo.tandara.test',
      name: 'Administrator Demo',
      role: 'admin',
    },
  ],
  residents: [
    {
      id: '33000000-0000-4000-8000-000000000001',
      phone: '+6281200000001',
      name: 'Rani Ciliwung',
      regionId: '20000000-0000-4000-8000-000000000001',
    },
    {
      id: '33000000-0000-4000-8000-000000000002',
      phone: '+6281200000002',
      name: 'Budi Semarang',
      regionId: '20000000-0000-4000-8000-000000000002',
    },
  ],
};

/** Only reserved fixture IDs can be synchronized; other accounts are never changed. */
export async function seedDemoAccounts(
  db: Kysely<Database>,
  password: string,
  resetPasswords = false,
) {
  if (password.length < 12) throw new Error('Set DEMO_PASSWORD to at least 12 characters.');
  await db.transaction().execute(async (tx) => {
    for (const account of [...demoAccounts.coordinators, ...demoAccounts.residents]) {
      const staff = 'email' in account;
      const table = staff ? 'users' : 'residents';
      const key = staff ? 'email' : 'phone';
      const identifier = staff ? account.email : account.phone;
      const salt = randomBytes(16).toString('hex');
      const encoded = `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
      if (staff) {
        await sql`INSERT INTO users(id,email,name,role,password_hash) VALUES(${account.id}::uuid,${account.email},${account.name},${account.role},${encoded}) ON CONFLICT DO NOTHING`.execute(
          tx,
        );
      } else {
        await sql`INSERT INTO residents(id,phone,name,password_hash) VALUES(${account.id}::uuid,${account.phone},${account.name},${encoded}) ON CONFLICT DO NOTHING`.execute(
          tx,
        );
      }
      const row = (
        await sql<{
          password_hash: string;
        }>`SELECT password_hash FROM ${sql.table(table)} WHERE id=${account.id}::uuid AND ${sql.ref(key)}=${identifier}`.execute(
          tx,
        )
      ).rows[0];
      if (!row) throw new Error('Demo account identifier conflicts with an existing account.');
      if (!resetPasswords) continue;
      const [oldSalt, oldHash] = row.password_hash.split(':');
      const expected = Buffer.from(oldHash ?? '', 'hex');
      const matches =
        !!oldSalt &&
        expected.length === 64 &&
        timingSafeEqual(expected, scryptSync(password, oldSalt, 64));
      if (matches) continue;
      await sql`UPDATE ${sql.table(table)} SET password_hash=${encoded} WHERE id=${account.id}::uuid`.execute(
        tx,
      );
      if (staff) {
        await sql`DELETE FROM sessions WHERE user_id=${account.id}::uuid`.execute(tx);
      } else {
        await sql`DELETE FROM resident_sessions WHERE resident_id=${account.id}::uuid`.execute(tx);
      }
    }
  });
}
