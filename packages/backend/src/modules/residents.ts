import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { sql } from 'kysely';
import {
  residentCredentialsSchema,
  residentClaimSchema,
  residentReportPageSchema,
  residentReportSchema,
  residentNotificationsSchema,
} from '@tandara/contracts';
import type { ResidentProfile } from '@tandara/contracts';
import { DatabaseService } from '../platform/database.service.js';
import { hash, parse, rateLimit, found } from './shared.js';
import { z } from 'zod';
import { passwordHash, verifyPassword } from './identity.js';
import { retainResidentPhone } from './resident-contact.js';

@Injectable()
export class ResidentsService {
  constructor(@Inject(DatabaseService) readonly database: DatabaseService) {}
  async signIn(input: unknown, ip: string, register: boolean) {
    const data = parse(residentCredentialsSchema, input);
    const db = this.database.db;
    await rateLimit(db, `resident-login-ip:${ip}`, 20, 900);
    await rateLimit(db, `resident-login-phone:${data.phone}`, 10, 900);
    if (register) {
      const encoded = await passwordHash(data.password);
      const created =
        await sql`INSERT INTO residents(phone,password_hash) VALUES(${data.phone},${encoded}) ON CONFLICT(phone) DO NOTHING RETURNING id`.execute(
          db,
        );
      if (!created.rows.length)
        throw new BadRequestException('Nomor ini tidak dapat didaftarkan. Coba masuk.');
    }
    const row = (
      await sql<{
        id: string;
        phone: string;
        name: string;
        password_hash: string;
      }>`SELECT id,phone,name,password_hash FROM residents WHERE phone=${data.phone}`.execute(db)
    ).rows[0];
    const valid = await verifyPassword(
      data.password,
      row?.password_hash ?? `${'0'.repeat(32)}:${'0'.repeat(128)}`,
    );
    if (!row || !valid)
      throw new UnauthorizedException('Nomor telepon atau kata sandi tidak sesuai.');
    const token = randomBytes(32).toString('hex'),
      csrf = randomBytes(32).toString('hex');
    await sql`DELETE FROM resident_sessions WHERE expires_at < now()`.execute(db);
    await sql`INSERT INTO resident_sessions(token_hash,resident_id,csrf_hash,expires_at) VALUES(${hash(token)},${row.id}::uuid,${hash(csrf)},now()+interval '8 hours')`.execute(
      db,
    );
    return { token, csrf, user: { id: row.id, phone: row.phone, name: row.name } };
  }
  async session(token?: string, csrf?: string): Promise<ResidentProfile | null> {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const row = (
      await sql<{
        id: string;
        phone: string;
        name: string;
        csrf_hash: string;
      }>`SELECT r.id,r.phone,r.name,s.csrf_hash FROM resident_sessions s JOIN residents r ON r.id=s.resident_id WHERE s.token_hash=${hash(token)} AND s.expires_at>now()`.execute(
        this.database.db,
      )
    ).rows[0];
    if (!row) return null;
    if (csrf !== undefined && hash(csrf) !== row.csrf_hash)
      throw new ForbiddenException('Muat ulang halaman lalu coba lagi.');
    return { id: row.id, phone: row.phone, name: row.name };
  }
  async logout(token?: string, csrf?: string) {
    if (!(await this.session(token, csrf)))
      throw new UnauthorizedException('Silakan masuk kembali.');
    await sql`DELETE FROM resident_sessions WHERE token_hash=${hash(token!)}`.execute(
      this.database.db,
    );
    return { ok: true };
  }
  async authenticate(token?: string, csrf?: string) {
    const user = await this.session(token, csrf);
    if (!user) throw new UnauthorizedException('Silakan masuk kembali.');
    return user;
  }
  async reports(user: ResidentProfile, pageInput: unknown) {
    const page = parse(z.coerce.number().int().min(1).max(10000).default(1), pageInput);
    const db = this.database.db;
    const items = (
      await sql`SELECT id,region_id AS "regionId",state,description,category,landmark_text AS landmark,follow_up_requested AS "followUp",created_at::text AS "createdAt" FROM reports WHERE resident_id=${user.id}::uuid AND NOT erased ORDER BY created_at DESC,id LIMIT 50 OFFSET ${(page - 1) * 50}`.execute(
        db,
      )
    ).rows;
    const count = (
      await sql<{
        total: number;
      }>`SELECT count(*)::int AS total FROM reports WHERE resident_id=${user.id}::uuid AND NOT erased`.execute(
        db,
      )
    ).rows[0]!;
    return residentReportPageSchema.parse({ items, page, total: count.total });
  }
  async claim(user: ResidentProfile, input: unknown) {
    const data = parse(residentClaimSchema, input);
    await rateLimit(this.database.db, `resident-claim:${user.id}`, 10, 60);
    return this.database.db.transaction().execute(async (tx) => {
      const claimedIds: string[] = [];
      for (const receipt of [...data.reports].sort((a, b) => a.id.localeCompare(b.id))) {
        const result = await sql<{
          id: string;
        }>`UPDATE reports SET resident_id=${user.id}::uuid WHERE id=${receipt.id}::uuid AND tracking_hash=${hash(receipt.trackingToken)} AND NOT erased AND (resident_id IS NULL OR resident_id=${user.id}::uuid) RETURNING id`.execute(
          tx,
        );
        if (result.rows[0]) {
          await retainResidentPhone(tx, result.rows[0].id);
          claimedIds.push(result.rows[0].id);
        }
      }
      return { claimedIds: [...new Set(claimedIds)] };
    });
  }
  async report(user: ResidentProfile, id: string) {
    parse(z.uuid(), id);
    const row = (
      await sql`SELECT id,region_id AS "regionId",state,description,category,landmark_text AS landmark,follow_up_requested AS "followUp",created_at::text AS "createdAt" FROM reports WHERE id=${id}::uuid AND resident_id=${user.id}::uuid AND NOT erased`.execute(
        this.database.db,
      )
    ).rows[0];
    return residentReportSchema.parse(found(row));
  }
  async notifications(user: ResidentProfile) {
    const db = this.database.db;
    const items = (
      await sql`SELECT n.id,n.report_id AS "reportId",n.action,n.created_at::text AS "createdAt",n.read_at::text AS "readAt",r.follow_up_requested AS "followUp" FROM resident_notifications n JOIN reports r ON r.id=n.report_id WHERE n.resident_id=${user.id}::uuid AND r.resident_id=${user.id}::uuid AND NOT r.erased ORDER BY n.created_at DESC,n.id DESC LIMIT 100`.execute(
        db,
      )
    ).rows;
    const count = (
      await sql<{
        count: number;
      }>`SELECT count(*)::int AS count FROM resident_notifications n JOIN reports r ON r.id=n.report_id WHERE n.resident_id=${user.id}::uuid AND r.resident_id=${user.id}::uuid AND NOT r.erased AND n.read_at IS NULL`.execute(
        db,
      )
    ).rows[0]!;
    return residentNotificationsSchema.parse({ items, unreadCount: count.count });
  }
  async readNotifications(user: ResidentProfile, input: unknown) {
    const { id } = parse(z.strictObject({ id: z.uuid().optional() }), input);
    const result =
      await sql`UPDATE resident_notifications SET read_at=COALESCE(read_at,now()) WHERE resident_id=${user.id}::uuid AND (${id ?? null}::uuid IS NULL OR id=${id ?? null}::uuid) RETURNING id`.execute(
        this.database.db,
      );
    if (id) found(result.rows[0]);
    return { ok: true };
  }
}
