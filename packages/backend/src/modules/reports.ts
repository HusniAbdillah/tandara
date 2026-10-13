import { BadRequestException, Inject, Injectable, ForbiddenException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { sql } from 'kysely';
import { z } from 'zod';
import {
  createReportSchema,
  reviewInputSchema,
  aiReviewInputSchema,
  reportReviewStateSchema,
} from '@tandara/contracts';
import type { User, Report, ReportDetail, ReportReviewState } from '@tandara/contracts';
import sharp from 'sharp';
import { IdentityService } from './identity.js';
import { audit, conflict, found, hash, parse, rateLimit, reportProjection } from './shared.js';

export const transitions: Record<ReportReviewState, ReportReviewState[]> = {
  submitted: ['under_review', 'clarification_requested', 'reviewed', 'rejected', 'closed'],
  under_review: ['clarification_requested', 'reviewed', 'rejected', 'closed'],
  clarification_requested: ['under_review', 'reviewed', 'rejected', 'closed'],
  reviewed: ['under_review', 'closed'],
  rejected: ['under_review', 'closed'],
  closed: [],
};
export function canTransition(from: ReportReviewState, to: ReportReviewState) {
  return transitions[from].includes(to);
}

@Injectable()
export class ReportsService {
  constructor(@Inject(IdentityService) readonly identity: IdentityService) {}
  get db() {
    return this.identity.db;
  }
  async create(input: unknown, key: string | undefined, ip: string) {
    const data = parse(createReportSchema, input);
    if (data.privacyConsent !== true)
      throw new BadRequestException('Persetujuan penyimpanan laporan diperlukan.');
    parse(z.uuid(), key);
    if (data.contactDetails && !data.contactPermission)
      throw new BadRequestException('Izin kontak diperlukan.');
    if (data.observationTime && Date.parse(data.observationTime) > Date.now() + 300000)
      throw new BadRequestException('Waktu pengamatan tidak boleh di masa depan.');
    const token =
      data.trackingToken ?? `${randomBytes(18).toString('hex')}${randomBytes(18).toString('hex')}`;
    // Clients supply a receipt secret for replay. Legacy clients get a receipt only on first delivery.
    const payloadHash = hash(JSON.stringify(data));
    return this.db.transaction().execute(async (tx) => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${key!},0))`.execute(tx);
      const existing = (
        await sql<{
          id: string;
          payload_hash: string;
          tracking_hash: string;
          state: ReportReviewState;
        }>`SELECT id,payload_hash,tracking_hash,state FROM reports WHERE idempotency_key=${key!}::uuid`.execute(
          tx,
        )
      ).rows[0];
      if (existing) {
        if (
          existing.payload_hash !== payloadHash ||
          !data.trackingToken ||
          existing.tracking_hash !== hash(token)
        )
          conflict('Kunci sinkronisasi telah digunakan. Isi laporan harus tetap sama.');
        return { id: existing.id, trackingToken: token, state: existing.state };
      }
      await rateLimit(tx, `report:${ip}`, 20, 3600);
      const region = found(
        (
          await sql<{
            config: { categories: string[]; retentionDays: number };
            suspended: boolean;
          }>`SELECT config,suspended FROM regions WHERE id=${data.regionId}::uuid FOR SHARE`.execute(
            tx,
          )
        ).rows[0],
      );
      if (region.suspended) throw new ForbiddenException('Wilayah sedang dinonaktifkan.');
      if (!region.config.categories.includes(data.category))
        throw new BadRequestException('Kategori tidak tersedia di wilayah ini.');
      const location = data.location;
      if (location) {
        const contained = (
          await sql<{
            ok: boolean;
          }>`SELECT ST_Covers(boundary,ST_SetSRID(ST_MakePoint(${location.longitude},${location.latitude}),4326)) AS ok FROM regions WHERE id=${data.regionId}::uuid`.execute(
            tx,
          )
        ).rows[0];
        if (!contained?.ok)
          throw new BadRequestException(
            'Lokasi berada di luar batas wilayah. Pilih wilayah yang sesuai.',
          );
      }
      const row = found(
        (
          await sql<{
            id: string;
            state: ReportReviewState;
          }>`INSERT INTO reports(region_id,category,description,landmark_text,observation_time,location,accuracy_meters,follow_up_requested,tracking_hash,idempotency_key,payload_hash,simulation) VALUES(${data.regionId}::uuid,${data.category},${data.description},${data.landmarkText ?? null},${data.observationTime}::timestamptz,CASE WHEN ${location?.longitude ?? null}::float IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(${location?.longitude ?? null},${location?.latitude ?? null}),4326) END,${location?.accuracyMeters ?? null},${data.followUpRequested},${hash(token)},${key!}::uuid,${payloadHash},${process.env['APP_MODE'] !== 'production'}) RETURNING id,state`.execute(
            tx,
          )
        ).rows[0],
      );
      if (data.contactDetails)
        await sql`INSERT INTO report_private_details(report_id,contact_details,consent_at,retention_until) VALUES(${row.id}::uuid,${data.contactDetails},now(),now()+${region.config.retentionDays}*interval '1 day')`.execute(
          tx,
        );
      if (data.followUpRequested)
        await sql`INSERT INTO assistance_requests(report_id,region_id) VALUES(${row.id}::uuid,${data.regionId}::uuid)`.execute(
          tx,
        );
      await sql`INSERT INTO report_history(report_id,action,reason) VALUES(${row.id}::uuid,'submitted','Diterima platform; menunggu tinjauan manusia.')`.execute(
        tx,
      );
      await sql`INSERT INTO outbox_jobs(kind,entity_id,region_id,dedupe_key) VALUES('triage',${row.id}::uuid,${data.regionId}::uuid,${`triage:${row.id}`})`.execute(
        tx,
      );
      await audit(tx, null, data.regionId, 'report.created', row.id, {
        simulation: process.env['APP_MODE'] !== 'production',
      });
      await sql`INSERT INTO notifications(user_id,region_id,title) SELECT DISTINCT u.id,${data.regionId}::uuid,${(process.env['APP_MODE'] === 'production' ? '' : 'Simulasi: ') + 'laporan komunitas baru menunggu tinjauan.'} FROM users u JOIN memberships m ON m.user_id=u.id LEFT JOIN notification_preferences p ON p.user_id=u.id WHERE m.region_id=${data.regionId}::uuid AND NOT u.suspended AND COALESCE(p.enabled,true)`.execute(
        tx,
      );
      return { id: row.id, trackingToken: token, state: row.state };
    });
  }
  async track(id: string, token: string | undefined) {
    parse(z.uuid(), id);
    const r = found(
      (
        await sql<{
          id: string;
          state: string;
          createdAt: string;
          updatedAt: string;
          assistanceState: string | null;
          erased: boolean;
        }>`SELECT r.id,r.state,r.erased,r.created_at::text AS "createdAt",r.updated_at::text AS "updatedAt",a.state AS "assistanceState" FROM reports r LEFT JOIN assistance_requests a ON a.report_id=r.id WHERE r.id=${id}::uuid AND r.tracking_hash=${hash(token ?? '')}`.execute(
          this.db,
        )
      ).rows[0],
    );
    // Do not reveal operational notes or identities through the receipt.
    const history = (
      await sql`SELECT id,action,CASE WHEN action='submitted' THEN 'Diterima platform' ELSE 'Status diperbarui oleh koordinator' END AS reason,NULL AS actor,created_at::text AS "createdAt" FROM report_history WHERE report_id=${id}::uuid ORDER BY created_at`.execute(
        this.db,
      )
    ).rows;
    return { ...r, history };
  }
  async eraseRequest(id: string, token: string | undefined) {
    await this.track(id, token);
    await sql`INSERT INTO deletion_requests(report_id,region_id) SELECT id,region_id FROM reports WHERE id=${id}::uuid ON CONFLICT(report_id) DO NOTHING`.execute(
      this.db,
    );
    return { ok: true };
  }
  async inbox(user: User, regionId: string, query: Record<string, unknown>) {
    await this.identity.scope(user, regionId);
    const filter = parse(
      z.object({
        page: z.coerce.number().int().min(1).max(10000).default(1),
        state: reportReviewStateSchema.optional(),
        q: z.string().max(100).default(''),
        category: z.string().max(50).optional(),
        sort: z.enum(['newest', 'oldest']).default('newest'),
      }),
      query,
    );
    const where = sql`r.region_id=${regionId}::uuid AND NOT r.erased AND (${filter.state ?? null}::text IS NULL OR r.state=${filter.state ?? null}) AND (${filter.category ?? null}::text IS NULL OR r.category=${filter.category ?? null}) AND (r.description ILIKE ${'%' + filter.q + '%'} OR COALESCE(r.landmark_text,'') ILIKE ${'%' + filter.q + '%'})`;
    const items = (
      await sql<{
        data: Report;
      }>`SELECT ${reportProjection} AS data FROM reports r LEFT JOIN report_private_details p ON p.report_id=r.id WHERE ${where} ORDER BY r.created_at ${filter.sort === 'newest' ? sql`DESC` : sql`ASC`},r.id LIMIT 20 OFFSET ${(filter.page - 1) * 20}`.execute(
        this.db,
      )
    ).rows.map((r) => r.data);
    const total = (
      await sql<{
        count: number;
      }>`SELECT count(*)::int AS count FROM reports r WHERE ${where}`.execute(this.db)
    ).rows[0]!.count;
    return { items, total, page: filter.page, pageSize: 20 };
  }
  async accessible(user: User, id: string) {
    parse(z.uuid(), id);
    const row = found(
      (
        await sql<{
          region_id: string;
        }>`SELECT region_id FROM reports WHERE id=${id}::uuid AND NOT erased`.execute(this.db)
      ).rows[0],
    );
    await this.identity.scope(user, row.region_id);
    return row.region_id;
  }
  async detail(user: User, id: string): Promise<ReportDetail> {
    const regionId = await this.accessible(user, id);
    const report = found(
      (
        await sql<{
          data: Report;
        }>`SELECT ${reportProjection} AS data FROM reports r LEFT JOIN report_private_details p ON p.report_id=r.id WHERE r.id=${id}::uuid`.execute(
          this.db,
        )
      ).rows[0],
    ).data;
    const history = (
      await sql<
        ReportDetail['history'][number]
      >`SELECT h.id,h.action,h.reason,u.name AS actor,h.created_at::text AS "createdAt" FROM report_history h LEFT JOIN users u ON u.id=h.actor_id WHERE h.report_id=${id}::uuid ORDER BY h.created_at`.execute(
        this.db,
      )
    ).rows;
    const suggestions = (
      await sql<
        ReportDetail['suggestions'][number]
      >`SELECT s.id,s.output,s.reviewed_output AS "reviewedOutput",s.legacy_provenance AS "legacyProvenance",COALESCE((SELECT jsonb_agg(jsonb_build_object('id',v.id,'action',v.action,'note',v.note,'output',v.output,'reviewerId',v.reviewer_id,'createdAt',v.created_at) ORDER BY v.created_at DESC) FROM ai_suggestion_reviews v WHERE v.suggestion_id=s.id),'[]'::jsonb) reviews,s.state,s.provider,s.model,s.prompt_version AS "promptVersion",s.duration_ms AS "durationMs",s.error,s.created_at::text AS "createdAt",s.human_note AS "humanNote" FROM ai_suggestions s WHERE report_id=${id}::uuid ORDER BY created_at DESC`.execute(
        this.db,
      )
    ).rows;
    const duplicates = (
      await sql<
        ReportDetail['duplicates'][number]
      >`SELECT d.id,d.report_id AS "reportId",d.other_id AS "otherId",d.evidence,d.state,r.description AS "otherDescription" FROM duplicate_candidates d JOIN reports r ON r.id=d.other_id WHERE d.report_id=${id}::uuid AND NOT r.erased`.execute(
        this.db,
      )
    ).rows;
    const attachments = (
      await sql<
        ReportDetail['attachments'][number]
      >`SELECT id,name,created_at::text AS "createdAt" FROM report_attachments WHERE report_id=${id}::uuid`.execute(
        this.db,
      )
    ).rows;
    if (report.contactDetails || report.followUpRequested)
      await audit(this.db, user.id, regionId, 'report.private_view', id);
    return { report, history, suggestions, duplicates, attachments };
  }
  async review(user: User, id: string, input: unknown) {
    const regionId = await this.accessible(user, id);
    const data = parse(reviewInputSchema, input);
    return this.db.transaction().execute(async (tx) => {
      const current = found(
        (
          await sql<{
            state: ReportReviewState;
            revision: number;
            follow_up_requested: boolean;
          }>`SELECT state,revision,follow_up_requested FROM reports WHERE id=${id}::uuid FOR UPDATE`.execute(
            tx,
          )
        ).rows[0],
      );
      if (current.revision !== data.revision) conflict();
      if (!canTransition(current.state, data.state)) conflict('Perubahan status tidak diizinkan.');
      if (data.publicSummary && (data.state !== 'reviewed' || current.follow_up_requested))
        throw new BadRequestException(
          'Ringkasan publik hanya untuk laporan yang ditinjau tanpa kebutuhan bantuan pribadi.',
        );
      const region = await this.identity.scope(user, regionId);
      if (data.category && !region.config.categories.includes(data.category))
        throw new BadRequestException('Kategori tidak diizinkan.');
      await sql`UPDATE reports SET state=${data.state},category=COALESCE(${data.category ?? null},category),public_summary=${data.state === 'reviewed' ? (data.publicSummary ?? null) : null},reviewed_by=${user.id}::uuid,reviewed_at=now(),updated_at=now(),revision=revision+1 WHERE id=${id}::uuid`.execute(
        tx,
      );
      await sql`INSERT INTO report_history(report_id,actor_id,action,reason) VALUES(${id}::uuid,${user.id}::uuid,${data.state},${data.reason})`.execute(
        tx,
      );
      await audit(tx, user.id, regionId, 'report.review', id, {
        state: data.state,
        category: data.category ?? null,
      });
      return { ok: true };
    });
  }
  async aiReview(user: User, id: string, suggestionId: string, input: unknown) {
    const region = await this.accessible(user, id);
    parse(z.uuid(), suggestionId);
    const data = parse(aiReviewInputSchema, input);
    if (data.action === 'edited' && !data.output)
      throw new BadRequestException('Isi saran hasil koreksi diperlukan.');
    return this.db.transaction().execute(async (tx) => {
      const result =
        await sql`UPDATE ai_suggestions SET state=${data.action},human_note=${data.note},reviewed_output=${data.output ? JSON.stringify(data.output) : null}::jsonb,reviewer_id=${user.id}::uuid,reviewed_at=now() WHERE id=${suggestionId}::uuid AND report_id=${id}::uuid AND state='ready' RETURNING id`.execute(
          tx,
        );
      if (!result.rows.length) conflict('Saran sudah ditinjau atau tidak tersedia.');
      await sql`INSERT INTO ai_suggestion_reviews(suggestion_id,reviewer_id,action,note,output) VALUES(${suggestionId}::uuid,${user.id}::uuid,${data.action},${data.note},${data.output ? JSON.stringify(data.output) : null}::jsonb)`.execute(
        tx,
      );
      await audit(tx, user.id, region, 'ai.review', suggestionId, { action: data.action });
      return { ok: true };
    });
  }
  async regenerate(user: User, id: string) {
    const region = await this.accessible(user, id);
    await rateLimit(this.db, `triage-user:${user.id}`, 20, 3600);
    await sql`INSERT INTO outbox_jobs(kind,entity_id,region_id) VALUES('triage',${id}::uuid,${region}::uuid)`.execute(
      this.db,
    );
    return { ok: true };
  }
  async duplicate(user: User, id: string, candidateId: string, input: unknown) {
    const region = await this.accessible(user, id);
    parse(z.uuid(), candidateId);
    const data = parse(
      z.strictObject({
        state: z.enum(['linked', 'dismissed', 'suggested']),
        reason: z.string().trim().min(5).max(500),
      }),
      input,
    );
    return this.db.transaction().execute(async (tx) => {
      const row =
        await sql`UPDATE duplicate_candidates SET state=${data.state},reviewer_id=${user.id}::uuid,reason=${data.reason} WHERE id=${candidateId}::uuid AND report_id=${id}::uuid RETURNING id`.execute(
          tx,
        );
      found(row.rows[0]);
      await audit(tx, user.id, region, 'duplicate.review', candidateId, {
        state: data.state,
        reason: data.reason,
      });
      return { ok: true };
    });
  }
  async upload(id: string, token: string | undefined, input: unknown) {
    await this.track(id, token);
    const data = parse(z.strictObject({ data: z.string().max(2800000) }), input);
    const buffer = Buffer.from(data.data, 'base64');
    if (
      buffer.length > 2000000 ||
      !(
        (buffer[0] === 0xff && buffer[1] === 0xd8) ||
        (buffer[0] === 0x89 && buffer.subarray(1, 4).toString() === 'PNG')
      )
    )
      throw new BadRequestException('Hanya JPEG/PNG hingga 2 MB.');
    let output: Buffer;
    try {
      output = await sharp(buffer, { limitInputPixels: 16000000 })
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
    } catch {
      throw new BadRequestException('Foto tidak dapat dibaca.');
    }
    const row = await this.db.transaction().execute(async (tx) => {
      found(
        (
          await sql`SELECT id FROM reports WHERE id=${id}::uuid AND NOT erased FOR UPDATE`.execute(
            tx,
          )
        ).rows[0],
      );
      const count = (
        await sql<{
          n: number;
        }>`SELECT count(*)::int n FROM report_attachments WHERE report_id=${id}::uuid`.execute(tx)
      ).rows[0]!.n;
      if (count >= 3) throw new BadRequestException('Maksimal tiga foto per laporan.');
      return found(
        (
          await sql<{
            id: string;
          }>`INSERT INTO report_attachments(report_id,name,content,mime) VALUES(${id}::uuid,'Foto laporan',${output},'image/jpeg') RETURNING id`.execute(
            tx,
          )
        ).rows[0],
      );
    });
    return row;
  }
  async attachment(user: User, id: string, attachmentId: string) {
    const region = await this.accessible(user, id);
    parse(z.uuid(), attachmentId);
    const row = found(
      (
        await sql<{
          content: Buffer;
        }>`SELECT content FROM report_attachments WHERE id=${attachmentId}::uuid AND report_id=${id}::uuid`.execute(
          this.db,
        )
      ).rows[0],
    );
    await audit(this.db, user.id, region, 'attachment.view', attachmentId);
    return row.content;
  }
}
