import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { sql } from 'kysely';
import { residentCredentialsSchema } from '@tandara/contracts';
import type { ResidentProfile } from '@tandara/contracts';
import { DatabaseService } from '../platform/database.service.js';
import { hash, parse, rateLimit } from './shared.js';
import { passwordHash, verifyPassword } from './identity.js';

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
}
