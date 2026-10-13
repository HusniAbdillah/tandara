import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { z } from 'zod';
import type { PlanContent, User } from '@tandara/contracts';
import { IdentityService } from './identity.js';
import { audit } from './shared.js';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../platform/database.service.js';
import { found, hash, parse, type Connection } from './shared.js';
import { redactAiText, sensitiveAiText } from './ai-policy.js';
import { embeddingRelease } from './ai-embeddings.js';
export { embedText, embeddingRelease } from './ai-embeddings.js';

export async function scopedAi<T>(
  db: DatabaseService['db'],
  regionId: string,
  work: (tx: Connection) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(async (tx) => {
    await sql`SELECT set_config('tandara.region',${regionId},true)`.execute(tx);
    await sql`SET LOCAL ROLE tandara_ai_scope`.execute(tx);
    return work(tx);
  });
}
@Injectable()
export class KnowledgeService {
  constructor(
    @Inject(DatabaseService) readonly database: DatabaseService,
    @Inject(IdentityService) readonly identity: IdentityService,
  ) {}
  get db() {
    return this.database.db;
  }
  async synchronize(regionId: string) {
    const plans = (
      await sql<{
        id: string;
        version: number;
        content: PlanContent;
        simulation: boolean;
      }>`SELECT id,version,content,simulation FROM plan_versions WHERE region_id=${regionId}::uuid AND state='published' AND (content->>'expiresAt')::timestamptz>now() AND (${process.env['APP_MODE'] !== 'production'} OR NOT simulation)`.execute(
        this.db,
      )
    ).rows;
    const references = (
      await sql<{
        id: string;
        version: number;
        title: string;
        text: string;
        expires_at: Date;
      }>`SELECT id,version,title,text,expires_at FROM knowledge_references WHERE region_id=${regionId}::uuid AND state='approved' AND expires_at>now()`.execute(
        this.db,
      )
    ).rows;
    await scopedAi(this.db, regionId, async (tx) => {
      for (const p of plans) {
        const doc = (
          await sql<{
            id: string;
          }>`INSERT INTO knowledge_documents(region_id,source_id,version,content_hash,expires_at,simulation) VALUES(${regionId}::uuid,${p.id}::uuid,${String(p.version)},${hash(JSON.stringify(p.content))},${p.content.expiresAt}::timestamptz,${p.simulation}) ON CONFLICT(source_id,version) DO UPDATE SET expires_at=excluded.expires_at RETURNING id`.execute(
            tx,
          )
        ).rows[0]!;
        const sections = [
          ['title', p.content.title],
          ...p.content.instructions.map((text, i) => ['instruction-' + (i + 1), text]),
          ...p.content.checklist.map((text, i) => ['checklist-' + (i + 1), text]),
          ...p.content.routes.map((r, i) => [
            'route-' + (i + 1),
            `${r.name}: ${r.description}. Catatan peninjauan: ${r.reviewNote}. Rute rencana bukan jaminan keamanan saat ini.`,
          ]),
        ];
        for (const [section, text] of sections) {
          if (!text || sensitiveAiText(text)) continue;
          await sql`INSERT INTO knowledge_chunks(document_id,region_id,section,text) VALUES(${doc.id}::uuid,${regionId}::uuid,${section!},${redactAiText(text)}) ON CONFLICT(document_id,section) DO NOTHING`.execute(
            tx,
          );
        }
      }
      for (const r of references) {
        const doc = (
          await sql<{
            id: string;
          }>`INSERT INTO knowledge_documents(region_id,source_id,source_kind,version,content_hash,expires_at,simulation) VALUES(${regionId}::uuid,${r.id}::uuid,'reference',${String(r.version)},${hash(r.text)},${r.expires_at},false) ON CONFLICT(source_id,version) DO UPDATE SET expires_at=excluded.expires_at RETURNING id`.execute(
            tx,
          )
        ).rows[0]!;
        const paragraphs = r.text.split(/\n\s*\n/).flatMap((p) => {
          const chunks = [];
          for (let i = 0; i < p.length; i += 1200) chunks.push(p.slice(i, i + 1200));
          return chunks;
        });
        for (const [index, text] of paragraphs.entries())
          await sql`INSERT INTO knowledge_chunks(document_id,region_id,section,text) VALUES(${doc.id}::uuid,${regionId}::uuid,${'reference-' + (index + 1)},${redactAiText(text)}) ON CONFLICT(document_id,section) DO NOTHING`.execute(
            tx,
          );
      }
      const ids = [...plans.map((p) => p.id), ...references.map((r) => r.id)];
      await sql`DELETE FROM knowledge_documents WHERE region_id=${regionId}::uuid AND NOT (source_id=ANY(${ids}::uuid[]))`.execute(
        tx,
      );
    });
    return plans;
  }
  async search(regionId: string, query: string, vector: number[] | null = null) {
    parse(z.uuid(), regionId);
    parse(z.string().trim().min(2).max(1500), query);
    found(
      (
        await sql`SELECT id FROM regions WHERE id=${regionId}::uuid AND NOT suspended`.execute(
          this.db,
        )
      ).rows[0],
    );
    await this.synchronize(regionId);
    return scopedAi(this.db, regionId, async (tx) => {
      // Exact vector ranking with scope/lifecycle filters applied before ranking. RRF combines lexical and semantic ranks.
      const result = await sql<{
        id: string;
        entityId: string;
        kind: 'plan' | 'reference';
        title: string;
        section: string;
        version: string;
        text: string;
        expiresAt: string;
        simulation: boolean;
      }>`
WITH eligible AS (
 SELECT c.*,d.source_id,d.source_kind,d.version,d.expires_at,d.simulation,p.content->>'title' title,p.content->>'sourceUrl' source_url FROM knowledge_chunks c JOIN knowledge_documents d ON d.id=c.document_id JOIN public.ai_approved_plans p ON p.id=d.source_id
 WHERE c.region_id=${regionId}::uuid AND p.state='published' AND d.expires_at>now() AND (${process.env['APP_MODE'] !== 'production'} OR NOT d.simulation)
), lexical AS (SELECT id,row_number() OVER(ORDER BY ts_rank_cd(lexical,plainto_tsquery('simple',${query})) DESC,id) rank FROM eligible WHERE lexical @@ plainto_tsquery('simple',${query}) LIMIT 30),
semantic AS (SELECT id,row_number() OVER(ORDER BY embedding <=> ${vector ? JSON.stringify(vector) : null}::vector,id) rank FROM eligible e WHERE ${vector !== null} AND embedding IS NOT NULL AND embedding_release=${embeddingRelease()} AND NOT EXISTS(SELECT 1 FROM knowledge_chunks other WHERE other.document_id=e.document_id AND other.embedding_release IS DISTINCT FROM ${embeddingRelease()}) LIMIT 30),
ranked AS (SELECT id,sum(1.0/(60+rank)) score FROM (SELECT * FROM lexical UNION ALL SELECT * FROM semantic) x GROUP BY id)
SELECT e.id::text id,e.source_id::text AS "entityId",e.source_kind kind,e.source_url AS "sourceUrl",e.title,e.section,e.version,e.text,e.expires_at::text AS "expiresAt",e.simulation FROM ranked r JOIN eligible e ON e.id=r.id ORDER BY r.score DESC,e.id LIMIT 10`.execute(
        tx,
      );
      return result.rows;
    });
  }
  async references(user: User, regionId: string) {
    await this.identity.scope(user, regionId);
    return (
      await sql`SELECT id,title,text,source_url AS "sourceUrl",license_note AS "licenseNote",state,version,expires_at::text AS "expiresAt",author_id AS "authorId",reviewer_id AS "reviewerId" FROM knowledge_references WHERE region_id=${regionId}::uuid ORDER BY created_at DESC LIMIT 100`.execute(
        this.db,
      )
    ).rows;
  }
  async importReference(user: User, regionId: string, input: unknown) {
    await this.identity.scope(user, regionId);
    const data = parse(
      z.strictObject({
        title: z.string().min(5).max(200),
        text: z.string().min(20).max(12000),
        sourceUrl: z.url().refine((url) => new URL(url).protocol === 'https:'),
        licenseNote: z.string().min(10).max(1000),
        expiresAt: z.iso.datetime({ offset: true }),
      }),
      input,
    );
    if (
      Date.parse(data.expiresAt) <= Date.now() ||
      sensitiveAiText(data.text + ' ' + data.title) ||
      redactAiText(data.title) !== data.title
    )
      throw new BadRequestException(
        'Sumber kedaluwarsa atau mungkin mengandung identitas pribadi.',
      );
    const result = (
      await sql<{
        id: string;
      }>`INSERT INTO knowledge_references(region_id,title,text,source_url,license_note,expires_at,author_id) VALUES(${regionId}::uuid,${data.title},${redactAiText(data.text)},${data.sourceUrl},${data.licenseNote},${data.expiresAt}::timestamptz,${user.id}::uuid) RETURNING id`.execute(
        this.db,
      )
    ).rows[0]!;
    await audit(this.db, user.id, regionId, 'knowledge.imported', result.id);
    return result;
  }
  async reviewReference(user: User, regionId: string, id: string, input: unknown) {
    await this.identity.scope(user, regionId);
    parse(z.uuid(), id);
    const data = parse(
      z.strictObject({
        action: z.enum(['approved', 'withdrawn']),
        note: z.string().min(10).max(1000),
      }),
      input,
    );
    await this.db.transaction().execute(async (tx) => {
      const row = found(
        (
          await sql<{
            author_id: string;
            state: string;
            expires_at: Date;
          }>`SELECT author_id,state,expires_at FROM knowledge_references WHERE id=${id}::uuid AND region_id=${regionId}::uuid FOR UPDATE`.execute(
            tx,
          )
        ).rows[0],
      );
      if (
        data.action === 'approved' &&
        (row.author_id === user.id ||
          row.state !== 'draft' ||
          row.expires_at.getTime() <= Date.now())
      )
        throw new ConflictException(
          'Persetujuan memerlukan peninjau berbeda dan sumber yang masih berlaku.',
        );
      await sql`UPDATE knowledge_references SET state=${data.action},reviewer_id=${user.id}::uuid,review_note=${data.note} WHERE id=${id}::uuid`.execute(
        tx,
      );
      await audit(tx, user.id, regionId, 'knowledge.' + data.action, id);
    });
    await this.synchronize(regionId);
    return { ok: true };
  }
}
