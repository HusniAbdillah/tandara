import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { sql } from 'kysely';
import type { Kysely, Transaction } from 'kysely';
import type { Database } from '@tandara/database';
import type { z } from 'zod';

export type Connection = Kysely<Database> | Transaction<Database>;
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new BadRequestException(
      result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  return result.data;
}
export function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
export function found<T>(value: T | undefined): T {
  if (!value) throw new NotFoundException('Data tidak ditemukan.');
  return value;
}
export function conflict(message = 'Data berubah. Muat ulang sebelum melanjutkan.'): never {
  throw new ConflictException(message);
}
export async function audit(
  db: Connection,
  actorId: string | null,
  regionId: string | null,
  action: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
) {
  await sql`INSERT INTO audit_events(actor_id,region_id,action,entity_id,metadata) VALUES(${actorId}::uuid,${regionId}::uuid,${action},${entityId},${JSON.stringify(metadata)}::jsonb)`.execute(
    db,
  );
}
export async function rateLimit(db: Connection, key: string, maximum: number, seconds = 60) {
  const result = await sql<{
    count: number;
  }>`INSERT INTO rate_limits(key,count,expires_at) VALUES(${hash(key)},1,now()+${seconds}*interval '1 second') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at < now() THEN 1 ELSE rate_limits.count+1 END, expires_at=CASE WHEN rate_limits.expires_at < now() THEN now()+${seconds}*interval '1 second' ELSE rate_limits.expires_at END RETURNING count`.execute(
    db,
  );
  if (result.rows[0]!.count > maximum) {
    const { HttpException } = await import('@nestjs/common');
    throw new HttpException('Terlalu banyak permintaan. Coba lagi nanti.', 429);
  }
}
export const regionProjection = sql`jsonb_build_object('id',r.id,'name',r.name,'organizationId',r.organization_id,'organization',o.name,'config',r.config,'boundary',ST_AsGeoJSON(r.boundary)::jsonb,'simulation',r.simulation,'suspended',r.suspended)`;
export const workflowProjection = sql`jsonb_build_object('status',r.workflow_status,'assigneeId',r.assignee_id,'assigneeName',(SELECT name FROM users WHERE id=r.assignee_id),'priority',r.priority,'revision',r.revision)`;
export const reportProjection = sql`jsonb_build_object('id',r.id,'regionId',r.region_id,'category',r.category,'description',r.description,'landmarkText',r.landmark_text,'observationTime',r.observation_time,'createdAt',r.created_at,'updatedAt',r.updated_at,'state',r.state,'followUpRequested',r.follow_up_requested,'contactDetails',p.contact_details,'latitude',ST_Y(r.location),'longitude',ST_X(r.location),'publicSummary',r.public_summary,'simulation',r.simulation,'revision',r.revision,'workflow',${workflowProjection})`;
export const planProjection = sql`jsonb_build_object('id',p.id,'regionId',p.region_id,'version',p.version,'state',p.state,'content',p.content,'owner',o.name,'createdAt',p.created_at,'reviewedAt',p.reviewed_at,'reviewer',u.name,'authorId',p.author_id,'updatedAt',p.updated_at,'simulation',p.simulation)`;
export const sourceProjection = sql`jsonb_build_object('id',s.id,'regionId',s.region_id,'name',s.name,'provider',s.provider,'enabled',s.enabled,'mode',s.mode,'sourceUrl',s.source_url,'licenseNote',s.license_note,'lastAttemptAt',s.last_attempt_at,'lastSuccessAt',s.last_success_at,'lastError',s.last_error,'config',s.config)`;
export const informationProjection = sql`jsonb_build_object('id',i.id,'sourceId',i.source_id,'regionId',i.region_id,'title',i.title,'body',i.body,'sourceName',i.source_name,'sourceUrl',i.source_url,'sourceType',i.source_type,'issuedAt',i.issued_at,'observedAt',i.observed_at,'fetchedAt',i.fetched_at,'effectiveAt',i.effective_at,'expiresAt',i.expires_at,'verificationStatus',i.verification_status,'version',i.version,'simulation',i.simulation)`;
