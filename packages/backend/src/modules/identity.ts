import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { sql } from 'kysely';
import { z } from 'zod';
import type { User, Region } from '@tandara/contracts';
import { DatabaseService } from '../platform/database.service.js';
import { audit, found, hash, parse, rateLimit, regionProjection } from './shared.js';

const derive = promisify(scrypt);
export async function passwordHash(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${((await derive(password, salt, 64)) as Buffer).toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [salt, value] = encoded.split(':');
  if (!salt || !value) return false;
  const expected = Buffer.from(value, 'hex');
  const actual = (await derive(password, salt, 64)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

@Injectable()
export class IdentityService {
  constructor(@Inject(DatabaseService) readonly database: DatabaseService) {}
  get db() {
    return this.database.db;
  }
  async login(input: unknown, ip: string) {
    const data = parse(
      z.strictObject({ email: z.email(), password: z.string().min(1).max(200) }),
      input,
    );
    await rateLimit(this.db, `login-ip:${ip}`, 20, 900);
    await rateLimit(this.db, `login-email:${data.email.toLowerCase()}`, 10, 900);
    const row = (
      await sql<{
        id: string;
        password_hash: string;
        suspended: boolean;
      }>`SELECT id,password_hash,suspended FROM users WHERE email=${data.email}`.execute(this.db)
    ).rows[0];
    // Equal-cost hash even for unknown accounts.
    const valid = await verifyPassword(
      data.password,
      row?.password_hash ?? `${'0'.repeat(32)}:${'0'.repeat(128)}`,
    );
    if (!row || !valid || row.suspended)
      throw new UnauthorizedException('Email atau kata sandi tidak sesuai.');
    const token = randomBytes(32).toString('hex');
    const csrf = randomBytes(32).toString('hex');
    await this.db.transaction().execute(async (tx) => {
      await sql`INSERT INTO sessions(token_hash,user_id,csrf_hash,expires_at) VALUES(${hash(token)},${row.id}::uuid,${hash(csrf)},now()+interval '8 hours')`.execute(
        tx,
      );
      await audit(tx, row.id, null, 'auth.login', row.id);
    });
    return { token, csrf, user: await this.authenticate(token) };
  }
  async authenticate(token?: string, csrf?: string): Promise<User> {
    if (!token || !/^[a-f0-9]{64}$/.test(token))
      throw new UnauthorizedException('Silakan masuk ke Posko.');
    const row = (
      await sql<{
        user: User;
        csrf_hash: string;
      }>`SELECT jsonb_build_object('id',u.id,'name',u.name,'email',u.email,'role',u.role,'suspended',u.suspended,'regionIds',COALESCE((SELECT jsonb_agg(m.region_id) FROM memberships m WHERE m.user_id=u.id),'[]'::jsonb)) AS "user",s.csrf_hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=${hash(token)} AND s.expires_at>now() AND NOT u.suspended`.execute(
        this.db,
      )
    ).rows[0];
    if (!row) throw new UnauthorizedException('Sesi berakhir. Silakan masuk kembali.');
    if (csrf !== undefined && hash(csrf) !== row.csrf_hash)
      throw new ForbiddenException('Token permintaan tidak sesuai. Muat ulang sesi.');
    return row.user;
  }
  async logout(token: string) {
    await sql`DELETE FROM sessions WHERE token_hash=${hash(token)}`.execute(this.db);
    return { ok: true };
  }
  requireAdmin(user: User) {
    if (user.role !== 'admin') throw new ForbiddenException('Khusus administrator.');
  }
  async notifications(user: User) {
    const pref = (
      await sql<{
        enabled: boolean;
      }>`SELECT enabled FROM notification_preferences WHERE user_id=${user.id}::uuid`.execute(
        this.db,
      )
    ).rows[0];
    const items = (
      await sql`SELECT n.id,n.region_id AS "regionId",n.title,n.created_at::text AS "createdAt",n.read_at::text AS "readAt" FROM notifications n WHERE n.user_id=${user.id}::uuid AND (n.region_id IS NULL OR ${user.role === 'admin'} OR EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=${user.id}::uuid AND m.region_id=n.region_id)) ORDER BY n.created_at DESC LIMIT 100`.execute(
        this.db,
      )
    ).rows;
    return { enabled: pref?.enabled ?? true, items };
  }
  async notificationPreference(user: User, input: unknown) {
    const data = parse(z.strictObject({ enabled: z.boolean() }), input);
    await sql`INSERT INTO notification_preferences(user_id,enabled) VALUES(${user.id}::uuid,${data.enabled}) ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled`.execute(
      this.db,
    );
    return { ok: true };
  }
  async readNotification(user: User, id: string) {
    parse(z.uuid(), id);
    found(
      (
        await sql`UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=${id}::uuid AND user_id=${user.id}::uuid AND (region_id IS NULL OR ${user.role === 'admin'} OR EXISTS(SELECT 1 FROM memberships WHERE user_id=${user.id}::uuid AND region_id=notifications.region_id)) RETURNING id`.execute(
          this.db,
        )
      ).rows[0],
    );
    return { ok: true };
  }
  async scope(user: User, regionId: string): Promise<Region> {
    parse(z.uuid(), regionId);
    if (user.role !== 'admin' && !user.regionIds.includes(regionId))
      throw new ForbiddenException('Tidak memiliki akses wilayah ini.');
    return found(
      (
        await sql<{
          data: Region;
        }>`SELECT ${regionProjection} AS data FROM regions r JOIN organizations o ON o.id=r.organization_id WHERE r.id=${regionId}::uuid`.execute(
          this.db,
        )
      ).rows[0],
    ).data;
  }
  async regions(includeSuspended = false) {
    return (
      await sql<{
        data: Region;
      }>`SELECT ${regionProjection} AS data FROM regions r JOIN organizations o ON o.id=r.organization_id WHERE (${includeSuspended} OR NOT r.suspended) ORDER BY r.name`.execute(
        this.db,
      )
    ).rows.map((r) => r.data);
  }
}
