import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { z } from 'zod';
import { planContentSchema, planStateSchema, trainingContentSchema } from '@tandara/contracts';
import type { Plan, User, PublicData, Coverage, Training } from '@tandara/contracts';
import { IdentityService } from './identity.js';
import {
  audit,
  conflict,
  found,
  informationProjection,
  parse,
  planProjection,
  rateLimit,
  regionProjection,
} from './shared.js';

@Injectable()
export class PreparednessService {
  constructor(@Inject(IdentityService) readonly identity: IdentityService) {}
  get db() {
    return this.identity.db;
  }
  async plans(regionId: string, privateAccess = false): Promise<Plan[]> {
    return (
      await sql<{
        data: Plan;
      }>`SELECT ${planProjection} data FROM plan_versions p JOIN regions r ON r.id=p.region_id JOIN organizations o ON o.id=r.organization_id LEFT JOIN users u ON u.id=p.reviewer_id WHERE p.region_id=${regionId}::uuid AND (${privateAccess} OR (p.state='published' AND (p.content->>'expiresAt')::timestamptz>now())) ORDER BY p.version DESC`.execute(
        this.db,
      )
    ).rows.map((r) => r.data);
  }
  async publicData(regionId: string): Promise<PublicData> {
    parse(z.uuid(), regionId);
    const region = found(
      (
        await sql<{
          data: PublicData['region'];
        }>`SELECT ${regionProjection} data FROM regions r JOIN organizations o ON o.id=r.organization_id WHERE r.id=${regionId}::uuid AND NOT r.suspended`.execute(
          this.db,
        )
      ).rows[0],
    ).data;
    const information = (
      await sql<{
        data: PublicData['information'][number];
      }>`SELECT ${informationProjection} data FROM information_records i JOIN information_sources s ON s.id=i.source_id WHERE i.region_id=${regionId}::uuid AND s.enabled AND (i.expires_at IS NULL OR i.expires_at>now()) ORDER BY (i.source_type='official_alert') DESC, i.effective_at ASC NULLS LAST, i.fetched_at DESC LIMIT 30`.execute(
        this.db,
      )
    ).rows.map((r) => r.data);
    const reports = (
      await sql<
        PublicData['reports'][number]
      >`SELECT r.id,r.category,COALESCE(r.public_summary,r.landmark_text,r.category) AS summary,r.landmark_text AS "landmarkText",r.observation_time::text AS "observationTime",r.reviewed_at::text AS "reviewedAt",u.name AS reviewer,r.simulation,CASE WHEN r.publish_on_map AND r.location IS NOT NULL THEN jsonb_build_object('latitude',ST_Y(r.location),'longitude',ST_X(r.location)) ELSE NULL END AS location FROM reports r JOIN users u ON u.id=r.reviewed_by WHERE r.region_id=${regionId}::uuid AND r.workflow_status IN ('verified','assigned','in_progress','awaiting_approval','resolved') AND r.publish_on_map AND NOT r.follow_up_requested AND NOT r.erased ORDER BY r.reviewed_at DESC LIMIT 100`.execute(
        this.db,
      )
    ).rows;
    const sources = (
      await sql<
        PublicData['sources'][number]
      >`SELECT id,name,provider,last_attempt_at::text AS "lastAttemptAt",last_success_at::text AS "lastSuccessAt",(last_error IS NOT NULL) AS failed FROM information_sources WHERE region_id=${regionId}::uuid AND enabled ORDER BY name`.execute(
        this.db,
      )
    ).rows;
    return {
      region,
      information,
      reports,
      sources,
      plans: await this.plans(regionId),
      fetchedAt: new Date().toISOString(),
    };
  }
  async managePlans(user: User, regionId: string) {
    await this.identity.scope(user, regionId);
    return this.plans(regionId, true);
  }
  async savePlan(user: User, regionId: string, input: unknown) {
    const region = await this.identity.scope(user, regionId);
    if (region.suspended) throw new ForbiddenException('Wilayah dinonaktifkan.');
    const data = parse(
      z.strictObject({ content: planContentSchema, reason: z.string().trim().min(5).max(500) }),
      input,
    );
    if (Date.parse(data.content.expiresAt) <= Date.now())
      throw new BadRequestException('Tanggal berlaku harus di masa depan.');
    return this.db.transaction().execute(async (tx) => {
      // Serialize version allocation and validate local plan points against the region.
      await sql`SELECT id FROM regions WHERE id=${regionId}::uuid FOR UPDATE`.execute(tx);
      for (const point of data.content.points) {
        const ok = (
          await sql<{
            ok: boolean;
          }>`SELECT ST_Covers(boundary,ST_SetSRID(ST_MakePoint(${point.longitude},${point.latitude}),4326)) ok FROM regions WHERE id=${regionId}::uuid`.execute(
            tx,
          )
        ).rows[0]?.ok;
        if (!ok) throw new BadRequestException('Titik rencana di luar batas wilayah.');
      }
      const version = (
        await sql<{
          n: number;
        }>`SELECT COALESCE(max(version),0)+1 n FROM plan_versions WHERE region_id=${regionId}::uuid`.execute(
          tx,
        )
      ).rows[0]!.n;
      const row = found(
        (
          await sql<{
            id: string;
          }>`INSERT INTO plan_versions(region_id,version,content,state,author_id,simulation) VALUES(${regionId}::uuid,${version},${JSON.stringify(data.content)}::jsonb,'draft',${user.id}::uuid,${region.simulation}) RETURNING id`.execute(
            tx,
          )
        ).rows[0],
      );
      await audit(tx, user.id, regionId, 'plan.created', row.id, { version, reason: data.reason });
      return row;
    });
  }
  async editPlan(user: User, regionId: string, id: string, input: unknown) {
    await this.identity.scope(user, regionId);
    parse(z.uuid(), id);
    const data = parse(
      z.strictObject({
        content: planContentSchema,
        reason: z.string().min(5).max(500),
        updatedAt: z.string(),
      }),
      input,
    );
    return this.db.transaction().execute(async (tx) => {
      const row = found(
        (
          await sql<{
            state: string;
            updated_at: Date;
            author_id: string;
          }>`SELECT state,updated_at,author_id FROM plan_versions WHERE id=${id}::uuid AND region_id=${regionId}::uuid FOR UPDATE`.execute(
            tx,
          )
        ).rows[0],
      );
      if (!['draft', 'changes_requested'].includes(row.state) || row.author_id !== user.id)
        throw new ForbiddenException('Hanya penulis dapat mengubah draf.');
      if (new Date(data.updatedAt).getTime() !== row.updated_at.getTime()) conflict();
      if (Date.parse(data.content.expiresAt) <= Date.now())
        throw new BadRequestException('Tanggal berlaku sudah lewat.');
      for (const p of data.content.points)
        if (
          !(
            await sql<{
              ok: boolean;
            }>`SELECT ST_Covers(boundary,ST_SetSRID(ST_MakePoint(${p.longitude},${p.latitude}),4326)) ok FROM regions WHERE id=${regionId}::uuid`.execute(
              tx,
            )
          ).rows[0]?.ok
        )
          throw new BadRequestException('Titik di luar wilayah.');
      await sql`UPDATE plan_versions SET content=${JSON.stringify(data.content)}::jsonb,updated_at=now() WHERE id=${id}::uuid`.execute(
        tx,
      );
      await audit(tx, user.id, regionId, 'plan.edited', id, { reason: data.reason });
      return { ok: true };
    });
  }
  async planTransition(user: User, regionId: string, id: string, input: unknown) {
    await this.identity.scope(user, regionId);
    parse(z.uuid(), id);
    const data = parse(
      z.strictObject({ state: planStateSchema, reason: z.string().trim().min(5).max(500) }),
      input,
    );
    return this.db.transaction().execute(async (tx) => {
      await sql`SELECT id FROM regions WHERE id=${regionId}::uuid FOR UPDATE`.execute(tx);
      const p = found(
        (
          await sql<{
            state: Plan['state'];
            author_id: string;
            content: Plan['content'];
          }>`SELECT state,author_id,content FROM plan_versions WHERE id=${id}::uuid AND region_id=${regionId}::uuid FOR UPDATE`.execute(
            tx,
          )
        ).rows[0],
      );
      const allowed: Record<Plan['state'], Plan['state'][]> = {
        draft: ['in_review', 'archived'],
        in_review: ['approved', 'changes_requested', 'archived'],
        changes_requested: ['in_review', 'archived'],
        approved: ['published', 'archived'],
        published: ['archived'],
        archived: [],
      };
      if (!allowed[p.state].includes(data.state))
        conflict('Perubahan status rencana tidak diizinkan.');
      if (['approved', 'changes_requested'].includes(data.state) && p.author_id === user.id)
        throw new ForbiddenException('Peninjau harus berbeda dari penulis rencana.');
      if (['in_review'].includes(data.state) && p.author_id !== user.id && user.role !== 'admin')
        throw new ForbiddenException('Hanya penulis dapat meminta tinjauan.');
      if (data.state === 'published' && Date.parse(p.content.expiresAt) <= Date.now())
        throw new BadRequestException('Rencana telah kedaluwarsa.');
      if (data.state === 'published')
        await sql`UPDATE plan_versions SET state='archived',updated_at=now() WHERE region_id=${regionId}::uuid AND state='published'`.execute(
          tx,
        );
      await sql`UPDATE plan_versions SET state=${data.state},reviewer_id=CASE WHEN ${data.state}='approved' THEN ${user.id}::uuid ELSE reviewer_id END,reviewed_at=CASE WHEN ${data.state}='approved' THEN now() ELSE reviewed_at END,review_note=${data.reason},updated_at=now() WHERE id=${id}::uuid`.execute(
        tx,
      );
      await audit(tx, user.id, regionId, `plan.${data.state}`, id, { reason: data.reason });
      return { ok: true };
    });
  }
  async coverage(user: User, regionId: string): Promise<Coverage> {
    const region = await this.identity.scope(user, regionId);
    // Four geographic quadrants intersected with the configured boundary. Geometry,
    // not WebMercator pixel distance; unknown-position reports do not establish coverage.
    const cells = (
      await sql<
        Coverage['cells'][number]
      >`WITH b AS (SELECT boundary,ST_XMin(boundary) x0,ST_XMax(boundary) x1,ST_YMin(boundary) y0,ST_YMax(boundary) y1 FROM regions WHERE id=${regionId}::uuid), cells AS (SELECT (x*2+y+1)::int id,ST_Intersection(boundary,ST_MakeEnvelope(x0+(x1-x0)*x/2,y0+(y1-y0)*y/2,x0+(x1-x0)*(x+1)/2,y0+(y1-y0)*(y+1)/2,4326)) geom FROM b CROSS JOIN generate_series(0,1) x CROSS JOIN generate_series(0,1) y) SELECT c.id,ST_AsGeoJSON(c.geom)::jsonb geometry,count(r.id)::int count,CASE WHEN count(r.id)=0 THEN 'insufficient_information' ELSE 'information_available' END state FROM cells c LEFT JOIN reports r ON r.region_id=${regionId}::uuid AND NOT r.erased AND r.state NOT IN ('rejected','closed') AND r.observation_time>now()-${region.config.coverageHours}*interval '1 hour' AND ST_Covers(c.geom,r.location) WHERE GeometryType(c.geom)='POLYGON' GROUP BY c.id,c.geom ORDER BY c.id`.execute(
        this.db,
      )
    ).rows;
    return {
      hours: region.config.coverageHours,
      method:
        'Empat bagian batas wilayah; laporan dengan titik dan waktu pengamatan dalam jendela waktu dihitung, termasuk yang belum ditinjau. Titik pada batas dapat masuk dua bagian. Tidak mengukur bahaya atau keamanan.',
      generatedAt: new Date().toISOString(),
      cells,
    };
  }
  async assistance(user: User, regionId: string) {
    await this.identity.scope(user, regionId);
    await audit(this.db, user.id, regionId, 'assistance.list', null);
    return (
      await sql`SELECT a.id,a.report_id AS "reportId",a.region_id AS "regionId",a.state,a.note,a.organization_id AS "organizationId",a.updated_at::text AS "updatedAt",r.description,p.contact_details AS "contactDetails" FROM assistance_requests a JOIN reports r ON r.id=a.report_id LEFT JOIN report_private_details p ON p.report_id=r.id WHERE a.region_id=${regionId}::uuid AND NOT r.erased ORDER BY a.updated_at DESC LIMIT 100`.execute(
        this.db,
      )
    ).rows;
  }
  async updateAssistance(user: User, regionId: string, id: string, input: unknown) {
    const region = await this.identity.scope(user, regionId);
    parse(z.uuid(), id);
    const data = parse(
      z.strictObject({
        state: z.enum(['received', 'assigned', 'in_progress', 'closed']),
        note: z.string().trim().min(5).max(1000),
        organizationId: z.uuid().nullable(),
      }),
      input,
    );
    if (data.organizationId && data.organizationId !== region.organizationId)
      throw new ForbiddenException('Organisasi di luar wilayah.');
    if (data.state === 'assigned' && !data.organizationId)
      throw new BadRequestException('Pilih organisasi penanggung jawab.');
    return this.db.transaction().execute(async (tx) => {
      const row = found(
        (
          await sql<{
            state: string;
            report_id: string;
          }>`SELECT state,report_id FROM assistance_requests WHERE id=${id}::uuid AND region_id=${regionId}::uuid FOR UPDATE`.execute(
            tx,
          )
        ).rows[0],
      );
      const allowed: Record<string, string[]> = {
        received: ['assigned', 'in_progress', 'closed'],
        assigned: ['in_progress', 'closed'],
        in_progress: ['assigned', 'closed'],
        closed: [],
      };
      if (!allowed[row.state]?.includes(data.state))
        conflict('Perubahan status bantuan tidak diizinkan.');
      await sql`UPDATE assistance_requests SET state=${data.state},note=${data.note},organization_id=${data.organizationId}::uuid,updated_at=now() WHERE id=${id}::uuid`.execute(
        tx,
      );
      await sql`INSERT INTO report_history(report_id,actor_id,action,reason) VALUES(${row.report_id}::uuid,${user.id}::uuid,${`assistance.${data.state}`},${data.note})`.execute(
        tx,
      );
      await audit(tx, user.id, regionId, 'assistance.updated', id, { state: data.state });
      return { ok: true };
    });
  }
  async training(regionId: string, includeFeedback = false): Promise<Training[]> {
    parse(z.uuid(), regionId);
    found(
      (
        await sql`SELECT id FROM regions WHERE id=${regionId}::uuid AND NOT suspended`.execute(
          this.db,
        )
      ).rows[0],
    );
    return this.trainingRecords(regionId, includeFeedback);
  }
  async groupSummary(user: User, regionId: string) {
    await this.identity.scope(user, regionId);
    const rows = (
      await sql<{
        id: string;
        category: string;
        state: string;
        missing: boolean;
      }>`SELECT id,category,state,(location IS NULL OR observation_time IS NULL) AS missing FROM reports WHERE region_id=${regionId}::uuid AND NOT erased AND created_at>now()-interval '24 hours' ORDER BY created_at DESC LIMIT 100`.execute(
        this.db,
      )
    ).rows;
    return {
      provider: 'deterministic',
      needsHumanReview: true,
      generatedAt: new Date().toISOString(),
      sourceIds: rows.map((r) => r.id),
      summary: `${rows.length} laporan dalam sampel 24 jam terakhir (maksimum 100). ${rows.filter((r) => r.missing).length} belum memiliki lokasi atau waktu pengamatan lengkap. Ringkasan ini menghitung catatan, bukan penilaian tingkat bahaya.`,
      groups: rows.reduce<Record<string, number>>(
        (v, r) => ({ ...v, [r.category]: (v[r.category] ?? 0) + 1 }),
        {},
      ),
    };
  }
  async trainingRecords(regionId: string, includeFeedback = false): Promise<Training[]> {
    parse(z.uuid(), regionId);
    found(
      (
        await sql`SELECT id FROM regions WHERE id=${regionId}::uuid AND NOT suspended`.execute(
          this.db,
        )
      ).rows[0],
    );
    const result = (
      await sql<Training>`SELECT s.id,s.region_id AS "regionId",s.content,s.simulation,count(t.id)::int AS participants,count(t.id)::int AS completed,COALESCE(jsonb_agg(t.feedback) FILTER(WHERE t.id IS NOT NULL),'[]'::jsonb) AS feedback FROM training_scenarios s LEFT JOIN training_results t ON t.scenario_id=s.id WHERE s.region_id=${regionId}::uuid GROUP BY s.id ORDER BY s.created_at DESC`.execute(
        this.db,
      )
    ).rows;
    return result.map((r) => ({ ...r, feedback: includeFeedback ? r.feedback : [] }));
  }
  async createTraining(user: User, regionId: string, input: unknown) {
    await this.identity.scope(user, regionId);
    const data = parse(trainingContentSchema, input);
    return this.db.transaction().execute(async (tx) => {
      const row = found(
        (
          await sql<{
            id: string;
          }>`INSERT INTO training_scenarios(region_id,content,author_id) VALUES(${regionId}::uuid,${JSON.stringify(data)}::jsonb,${user.id}::uuid) RETURNING id`.execute(
            tx,
          )
        ).rows[0],
      );
      await audit(tx, user.id, regionId, 'training.created', row.id);
      return row;
    });
  }
  async completeTraining(regionId: string, id: string, input: unknown, ip: string) {
    parse(z.uuid(), id);
    parse(z.uuid(), regionId);
    const data = parse(
      z.strictObject({
        answers: z.array(z.number().int().min(0).max(4)).max(20),
        feedback: z.string().max(500),
        completionKey: z.uuid(),
      }),
      input,
    );
    const scenario = found(
      (
        await sql<{
          content: Training['content'];
        }>`SELECT s.content FROM training_scenarios s JOIN regions r ON r.id=s.region_id WHERE s.id=${id}::uuid AND s.region_id=${regionId}::uuid AND NOT r.suspended`.execute(
          this.db,
        )
      ).rows[0],
    );
    if (
      data.answers.length !== scenario.content.steps.length ||
      data.answers.some((a, i) => a >= scenario.content.steps[i]!.options.length)
    )
      throw new BadRequestException('Lengkapi semua pertanyaan.');
    const score = data.answers.filter((v, i) => v === scenario.content.steps[i]!.answer).length;
    await rateLimit(this.db, `training:${ip}`, 30, 3600);
    await this.db.transaction().execute(async (tx) => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${data.completionKey},0))`.execute(
        tx,
      );
      const existing = (
        await sql<{
          scenario_id: string;
          answers: number[];
          feedback: string;
        }>`SELECT scenario_id,answers,feedback FROM training_results WHERE completion_key=${data.completionKey}::uuid`.execute(
          tx,
        )
      ).rows[0];
      if (existing) {
        if (
          existing.scenario_id !== id ||
          JSON.stringify(existing.answers) !== JSON.stringify(data.answers) ||
          existing.feedback !== data.feedback
        )
          conflict('Hasil latihan berbeda menggunakan kunci yang sama.');
        return;
      }
      await sql`INSERT INTO training_results(scenario_id,completion_key,score,answers,feedback) VALUES(${id}::uuid,${data.completionKey}::uuid,${score},${JSON.stringify(data.answers)}::jsonb,${data.feedback})`.execute(
        tx,
      );
    });
    return { score, total: scenario.content.steps.length };
  }
}
