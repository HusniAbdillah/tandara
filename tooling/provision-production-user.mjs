import 'reflect-metadata';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { passwordHash } from '../packages/backend/dist/index.js';
import { encryptMfa, newMfa } from '../packages/backend/dist/modules/mfa.js';
const require = createRequire(new URL('../packages/backend/package.json', import.meta.url));
const { z } = require('zod');
const { Client } = createRequire(new URL('../packages/database/package.json', import.meta.url))(
  'pg',
);
if (process.env.APP_MODE !== 'production' || process.env.DEMO_PASSWORD || !process.argv[3])
  throw new Error(
    'Use isolated production maintenance credentials and private input/enrollment paths.',
  );
try {
  const url = new URL(process.env.DATABASE_URL);
  if (url.searchParams.get('sslmode') !== 'verify-full' || !url.searchParams.get('sslrootcert'))
    throw new Error();
} catch {
  throw new Error('Production maintenance requires verified database TLS and a reviewed CA.');
}
const input = z
  .strictObject({
    email: z.email(),
    name: z.string().min(3).max(100),
    password: z.string().min(16).max(200),
    role: z.enum(['admin', 'coordinator']),
    aiRole: z.enum(['operator', 'approver']).optional(),
    regionIds: z.array(z.uuid()).max(100),
    authorizedBy: z.uuid(),
    reason: z.string().min(10).max(1000),
    enrollExisting: z.boolean().default(false),
    translationQualifications: z
      .array(z.object({ language: z.enum(['id', 'jv', 'su']), note: z.string().min(20).max(1000) }))
      .max(3)
      .default([]),
  })
  .parse(JSON.parse(await readFile(process.argv[2], 'utf8')));
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query('BEGIN');
  if (
    !(
      await db.query("SELECT id FROM users WHERE id=$1 AND role='admin' AND NOT suspended", [
        input.authorizedBy,
      ])
    ).rows.length
  )
    throw new Error('Active administrator authorization required.');
  if (input.role === 'coordinator' && !input.regionIds.length)
    throw new Error('Coordinator region membership required.');
  if (input.aiRole && input.role !== 'admin')
    throw new Error('AI governance roles require an administrator account.');
  const mfa = newMfa(input.email);
  const existing = (
    await db.query('SELECT id,role,suspended,totp_secret FROM users WHERE email=$1 FOR UPDATE', [
      input.email,
    ])
  ).rows[0];
  if (Boolean(existing) !== input.enrollExisting || existing?.totp_secret)
    throw new Error('Existing enrollment cannot be reset by provisioning.');
  if (existing && (existing.role !== input.role || existing.suspended))
    throw new Error('Existing active account role must match provisioning.');
  const id = existing
    ? existing.id
    : (
        await db.query(
          'INSERT INTO users(email,name,password_hash,role,totp_secret) VALUES($1,$2,$3,$4,$5) RETURNING id',
          [
            input.email,
            input.name,
            await passwordHash(input.password),
            input.role,
            encryptMfa(mfa.secret),
          ],
        )
      ).rows[0].id;
  if (existing)
    await db.query('UPDATE users SET totp_secret=$1 WHERE id=$2', [encryptMfa(mfa.secret), id]);
  if (input.aiRole)
    await db.query('INSERT INTO ai_admin_roles(user_id,role) VALUES($1,$2)', [id, input.aiRole]);
  for (const region of input.regionIds) {
    if (
      !(
        await db.query('SELECT id FROM regions WHERE id=$1 AND NOT suspended AND NOT simulation', [
          region,
        ])
      ).rows.length
    )
      throw new Error('Active production region required.');
    await db.query(
      'INSERT INTO memberships(user_id,region_id,organization_id) SELECT $1,id,organization_id FROM regions WHERE id=$2 ON CONFLICT DO NOTHING',
      [id, region],
    );
  }
  for (const q of input.translationQualifications)
    await db.query(
      'INSERT INTO translation_reviewers(user_id,language,qualification_note) VALUES($1,$2,$3)',
      [id, q.language, q.note],
    );
  await db.query(
    "INSERT INTO audit_events(actor_id,action,entity_id,metadata) VALUES($1,'production.user_provisioned',$2,$3::jsonb)",
    [
      input.authorizedBy,
      id,
      JSON.stringify({
        reason: input.reason,
        regionIds: input.regionIds,
        role: input.role,
        aiRole: input.aiRole ?? null,
      }),
    ],
  );
  await writeFile(process.argv[3], JSON.stringify({ email: input.email, ...mfa }, null, 2), {
    flag: 'wx',
    mode: 0o600,
  });
  await db.query('COMMIT');
  console.info('Account provisioned; distribute enrollment through the approved secure channel.');
} catch {
  await db.query('ROLLBACK');
  console.error('Account provisioning failed; credentials are not printed.');
  process.exitCode = 1;
} finally {
  await db.end();
}
