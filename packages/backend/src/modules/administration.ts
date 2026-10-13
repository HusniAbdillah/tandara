import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { z } from 'zod';
import { regionConfigSchema, sourceProviderSchema } from '@tandara/contracts';
import type { User, Source } from '@tandara/contracts';
import { IdentityService, passwordHash } from './identity.js';
import { audit, conflict, found, parse, sourceProjection } from './shared.js';
import { eraseReport } from './privacy.js';
import { AiService } from './ai.js';

@Injectable()
export class AdministrationService {
  constructor(
    @Inject(IdentityService) readonly identity: IdentityService,
    @Inject(AiService) readonly ai: AiService,
  ) {}
  get db() {
    return this.identity.db;
  }
  async organizations(user: User) {
    this.identity.requireAdmin(user);
    return (await sql`SELECT id,name,description FROM organizations ORDER BY name`.execute(this.db))
      .rows;
  }
  async saveOrganization(user: User, input: unknown) {
    this.identity.requireAdmin(user);
    const d = parse(
      z.strictObject({
        id: z.uuid().optional(),
        name: z.string().trim().min(3).max(150),
        description: z.string().max(1000),
      }),
      input,
    );
    return this.db.transaction().execute(async (tx) => {
      const row = d.id
        ? found(
            (
              await sql<{
                id: string;
              }>`UPDATE organizations SET name=${d.name},description=${d.description} WHERE id=${d.id}::uuid RETURNING id`.execute(
                tx,
              )
            ).rows[0],
          )
        : found(
            (
              await sql<{
                id: string;
              }>`INSERT INTO organizations(name,description) VALUES(${d.name},${d.description}) RETURNING id`.execute(
                tx,
              )
            ).rows[0],
          );
      await audit(tx, user.id, null, 'organization.saved', row.id);
      return row;
    });
  }
  async users(user: User) {
    this.identity.requireAdmin(user);
    return (
      await sql<{
        data: User;
      }>`SELECT jsonb_build_object('id',u.id,'name',u.name,'email',u.email,'role',u.role,'suspended',u.suspended,'regionIds',COALESCE(jsonb_agg(m.region_id) FILTER(WHERE m.region_id IS NOT NULL),'[]'::jsonb)) data FROM users u LEFT JOIN memberships m ON m.user_id=u.id GROUP BY u.id ORDER BY u.name`.execute(
        this.db,
      )
    ).rows.map((r) => r.data);
  }
  async saveUser(user: User, input: unknown) {
    this.identity.requireAdmin(user);
    const d = parse(
      z.strictObject({
        id: z.uuid().optional(),
        email: z.email(),
        name: z.string().min(3).max(100),
        password: z.string().min(12).max(200).optional(),
        role: z.enum(['admin', 'coordinator']),
        regionIds: z.array(z.uuid()).max(50),
        suspended: z.boolean(),
      }),
      input,
    );
    if (!d.id && !d.password) throw new BadRequestException('Kata sandi diperlukan.');
    if (d.id === user.id && (d.suspended || d.role !== 'admin'))
      throw new BadRequestException('Tidak dapat menonaktifkan akun sendiri.');
    const encoded = d.password ? await passwordHash(d.password) : null;
    return this.db.transaction().execute(async (tx) => {
      const row = d.id
        ? found(
            (
              await sql<{
                id: string;
              }>`UPDATE users SET email=${d.email},name=${d.name},role=${d.role},suspended=${d.suspended},password_hash=COALESCE(${encoded},password_hash) WHERE id=${d.id}::uuid RETURNING id`.execute(
                tx,
              )
            ).rows[0],
          )
        : found(
            (
              await sql<{
                id: string;
              }>`INSERT INTO users(email,name,role,password_hash,suspended) VALUES(${d.email},${d.name},${d.role},${encoded!},${d.suspended}) RETURNING id`.execute(
                tx,
              )
            ).rows[0],
          );
      await sql`DELETE FROM memberships WHERE user_id=${row.id}::uuid`.execute(tx);
      for (const regionId of new Set(d.regionIds)) {
        const r = found(
          (
            await sql<{
              organization_id: string;
            }>`SELECT organization_id FROM regions WHERE id=${regionId}::uuid`.execute(tx)
          ).rows[0],
        );
        await sql`INSERT INTO memberships VALUES(${row.id}::uuid,${regionId}::uuid,${r.organization_id}::uuid)`.execute(
          tx,
        );
      }
      if (d.id) await sql`DELETE FROM sessions WHERE user_id=${row.id}::uuid`.execute(tx);
      await audit(tx, user.id, null, 'user.permissions_changed', row.id, {
        role: d.role,
        regions: d.regionIds,
        suspended: d.suspended,
      });
      return row;
    });
  }
  async saveRegion(user: User, input: unknown) {
    this.identity.requireAdmin(user);
    const d = parse(
      z.strictObject({
        id: z.uuid().optional(),
        name: z.string().min(3).max(150),
        organizationId: z.uuid(),
        config: regionConfigSchema,
        boundary: z.strictObject({
          type: z.literal('Polygon'),
          coordinates: z
            .array(z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])))
            .min(1)
            .max(10),
        }),
        suspended: z.boolean(),
      }),
      input,
    );
    if (
      d.boundary.coordinates.some(
        (r) => r.length < 4 || r.length > 500 || JSON.stringify(r[0]) !== JSON.stringify(r.at(-1)),
      )
    )
      throw new BadRequestException('Polygon harus tertutup, 4–500 titik per ring.');
    return this.db.transaction().execute(async (tx) => {
      found(
        (await sql`SELECT id FROM organizations WHERE id=${d.organizationId}::uuid`.execute(tx))
          .rows[0],
      );
      const geom = sql`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(d.boundary)}),4326)`;
      if (
        !(
          await sql<{
            ok: boolean;
          }>`SELECT ST_IsValid(${geom}) AND ST_Area(${geom}::geography)>0 ok`.execute(tx)
        ).rows[0]?.ok
      )
        throw new BadRequestException('Polygon tidak valid.');
      const row = d.id
        ? found(
            (
              await sql<{
                id: string;
              }>`UPDATE regions SET name=${d.name},organization_id=${d.organizationId}::uuid,config=${JSON.stringify(d.config)}::jsonb,boundary=${geom},suspended=${d.suspended} WHERE id=${d.id}::uuid RETURNING id`.execute(
                tx,
              )
            ).rows[0],
          )
        : found(
            (
              await sql<{
                id: string;
              }>`INSERT INTO regions(name,organization_id,config,boundary,suspended,simulation) VALUES(${d.name},${d.organizationId}::uuid,${JSON.stringify(d.config)}::jsonb,${geom},${d.suspended},${process.env['APP_MODE'] !== 'production'}) RETURNING id`.execute(
                tx,
              )
            ).rows[0],
          );
      await sql`UPDATE memberships SET organization_id=${d.organizationId}::uuid WHERE region_id=${row.id}::uuid`.execute(
        tx,
      );
      await audit(tx, user.id, row.id, 'region.saved', row.id);
      return row;
    });
  }
  async sources(user: User, regionId: string): Promise<Source[]> {
    await this.identity.scope(user, regionId);
    return (
      await sql<{
        data: Source;
      }>`SELECT ${sourceProjection} data FROM information_sources s WHERE s.region_id=${regionId}::uuid ORDER BY s.name`.execute(
        this.db,
      )
    ).rows.map((r) => r.data);
  }
  async saveSource(user: User, regionId: string, input: unknown) {
    this.identity.requireAdmin(user);
    await this.identity.scope(user, regionId);
    const d = parse(
      z.strictObject({
        id: z.uuid().optional(),
        name: z.string().min(3).max(150),
        provider: sourceProviderSchema,
        enabled: z.boolean(),
        mode: z.enum(['simulation', 'live', 'disabled']),
        sourceUrl: z.url().refine((v) => new URL(v).protocol === 'https:'),
        licenseNote: z.string().min(5).max(1500),
        config: z.strictObject({
          authorized: z.boolean().default(false),
          adm4: z
            .string()
            .regex(/^\d{2}\.\d{2}\.\d{2}\.\d{4}$/)
            .optional(),
          admin: z
            .string()
            .regex(/^ID-[A-Z]{2}$/)
            .optional(),
          fail: z.boolean().optional(),
          province: z.string().trim().min(3).max(100).optional(),
        }),
      }),
      input,
    );
    if (d.enabled && d.mode === 'disabled')
      throw new BadRequestException('Sumber disabled tidak dapat diaktifkan.');
    if (d.enabled && d.provider === 'inarisk')
      throw new BadRequestException('Konektor InaRISK belum tersedia.');
    if (d.enabled && d.provider === 'fixture' && d.mode !== 'simulation')
      throw new BadRequestException('Fixture harus berlabel simulasi.');
    if (
      d.enabled &&
      ((d.provider === 'bmkg' && !d.config.adm4) ||
        (d.provider === 'petabencana' && !d.config.admin) ||
        (d.provider === 'bmkg_nowcast' && !d.config.province))
    )
      throw new BadRequestException('Lengkapi cakupan lokasi untuk provider ini.');
    if (
      d.enabled &&
      d.provider !== 'fixture' &&
      (d.mode !== 'live' || !d.config.authorized || process.env['ALLOW_LIVE_SOURCES'] !== 'true')
    )
      throw new BadRequestException('Aktivasi memerlukan izin sumber dan ALLOW_LIVE_SOURCES=true.');
    return this.db.transaction().execute(async (tx) => {
      if (d.id) {
        // A new location/provider cannot inherit old warnings or a previous successful check.
        const changed = (
          await sql<{
            changed: boolean;
          }>`SELECT provider<>${d.provider} OR mode<>${d.mode} OR source_url<>${d.sourceUrl} OR COALESCE(config->>'province','')<>${d.config.province ?? ''} OR COALESCE(config->>'adm4','')<>${d.config.adm4 ?? ''} OR COALESCE(config->>'admin','')<>${d.config.admin ?? ''} AS changed FROM information_sources WHERE id=${d.id}::uuid AND region_id=${regionId}::uuid FOR UPDATE`.execute(
            tx,
          )
        ).rows[0]?.changed;
        if (changed) {
          await sql`UPDATE information_records SET expires_at=LEAST(COALESCE(expires_at,now()),now()),verification_status='source_configuration_changed' WHERE source_id=${d.id}::uuid`.execute(
            tx,
          );
          await sql`UPDATE information_sources SET last_attempt_at=NULL,last_success_at=NULL,last_error=NULL WHERE id=${d.id}::uuid`.execute(
            tx,
          );
        }
      }
      const row = d.id
        ? found(
            (
              await sql<{
                id: string;
              }>`UPDATE information_sources SET name=${d.name},provider=${d.provider},enabled=${d.enabled},mode=${d.mode},source_url=${d.sourceUrl},license_note=${d.licenseNote},config=${JSON.stringify(d.config)}::jsonb WHERE id=${d.id}::uuid AND region_id=${regionId}::uuid RETURNING id`.execute(
                tx,
              )
            ).rows[0],
          )
        : found(
            (
              await sql<{
                id: string;
              }>`INSERT INTO information_sources(region_id,name,provider,enabled,mode,source_url,license_note,config) VALUES(${regionId}::uuid,${d.name},${d.provider},${d.enabled},${d.mode},${d.sourceUrl},${d.licenseNote},${JSON.stringify(d.config)}::jsonb) RETURNING id`.execute(
                tx,
              )
            ).rows[0],
          );
      await audit(tx, user.id, regionId, 'source.configured', row.id, {
        enabled: d.enabled,
        mode: d.mode,
      });
      return row;
    });
  }
  async refreshSource(user: User, regionId: string, id: string) {
    await this.identity.scope(user, regionId);
    parse(z.uuid(), id);
    if (
      !found(
        (
          await sql<{
            enabled: boolean;
          }>`SELECT enabled FROM information_sources WHERE id=${id}::uuid AND region_id=${regionId}::uuid`.execute(
            this.db,
          )
        ).rows[0],
      ).enabled
    )
      throw new BadRequestException('Sumber dinonaktifkan.');
    await sql`INSERT INTO outbox_jobs(kind,entity_id,region_id,dedupe_key) VALUES('source_sync',${id}::uuid,${regionId}::uuid,${`manual-source:${id}:${Math.floor(Date.now() / 60000)}`}) ON CONFLICT DO NOTHING`.execute(
      this.db,
    );
    return { ok: true };
  }
  async audit(user: User, regionId: string, q = '') {
    await this.identity.scope(user, regionId);
    parse(z.string().max(100), q);
    return (
      await sql`SELECT a.id,u.name actor,a.region_id AS "regionId",a.action,a.entity_id AS "entityId",a.metadata,a.created_at::text AS "createdAt" FROM audit_events a LEFT JOIN users u ON u.id=a.actor_id WHERE (a.region_id=${regionId}::uuid OR (${user.role === 'admin'} AND a.region_id IS NULL)) AND a.action ILIKE ${'%' + q + '%'} ORDER BY a.created_at DESC LIMIT 200`.execute(
        this.db,
      )
    ).rows;
  }
  async operations(user: User) {
    this.identity.requireAdmin(user);
    const worker = (
      await sql<{ seen_at: Date }>`SELECT max(seen_at) seen_at FROM worker_heartbeat`.execute(
        this.db,
      )
    ).rows[0];
    const jobs = (
      await sql`SELECT id,kind,state,attempts,error,created_at::text AS "createdAt" FROM outbox_jobs ORDER BY created_at DESC LIMIT 100`.execute(
        this.db,
      )
    ).rows;
    const deletions = (
      await sql`SELECT id,report_id AS "reportId",region_id AS "regionId",state,created_at::text AS "createdAt" FROM deletion_requests ORDER BY created_at DESC LIMIT 100`.execute(
        this.db,
      )
    ).rows;
    return {
      database: await this.identity.database.isReady(),
      workerLastSeen: worker?.seen_at?.toISOString() ?? null,
      aiMode: process.env['AI_MODE'] ?? 'heuristic',
      jobs,
      deletions,
    };
  }
  async retryJob(user: User, id: string) {
    this.identity.requireAdmin(user);
    parse(z.uuid(), id);
    const failed = (
      await sql<{
        kind: string;
        entity_id: string;
      }>`SELECT kind,entity_id FROM outbox_jobs WHERE id=${id}::uuid AND state='failed'`.execute(
        this.db,
      )
    ).rows[0];
    if (failed?.kind === 'knowledge_index') return this.ai.retryIndex(user, failed.entity_id);
    return this.db.transaction().execute(async (tx) => {
      const row = (
        await sql<{
          kind: string;
        }>`UPDATE outbox_jobs SET state='pending',attempts=0,available_at=now(),error=NULL WHERE id=${id}::uuid AND state='failed' RETURNING kind`.execute(
          tx,
        )
      ).rows[0];
      if (!row) conflict('Hanya pekerjaan gagal dapat dicoba lagi.');
      if (row.kind === 'triage')
        await sql`DELETE FROM app_metadata WHERE key=${`triage-job:${id}`}`.execute(tx);
      await audit(tx, user.id, null, 'job.retry', id, { kind: row.kind });
      return { ok: true };
    });
  }
  async deleteReport(user: User, id: string) {
    this.identity.requireAdmin(user);
    parse(z.uuid(), id);
    return this.db.transaction().execute(async (tx) => {
      const r = found(
        (
          await sql<{
            report_id: string;
            region_id: string;
            state: string;
          }>`SELECT report_id,region_id,state FROM deletion_requests WHERE id=${id}::uuid FOR UPDATE`.execute(
            tx,
          )
        ).rows[0],
      );
      if (r.state === 'completed') return { ok: true };
      await eraseReport(
        tx,
        r.report_id,
        r.region_id,
        user.id,
        'Laporan dihapus atas permintaan pelapor.',
      );
      return { ok: true };
    });
  }
}
