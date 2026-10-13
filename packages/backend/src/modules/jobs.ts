import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { DatabaseService } from '../platform/database.service.js';
import { audit } from './shared.js';
import { eraseReport } from './privacy.js';
import { AiInferenceError, createAiAdapter, ingestSource, PROMPT_VERSION } from './adapters.js';
import type { SourceInput, TriageInput } from './adapters.js';

interface Job {
  id: string;
  kind: string;
  entity_id: string | null;
  region_id: string | null;
  attempts: number;
}
@Injectable()
export class JobsService {
  constructor(@Inject(DatabaseService) readonly database: DatabaseService) {}
  get db() {
    return this.database.db;
  }
  async tick() {
    await sql`INSERT INTO worker_heartbeat(id,seen_at) VALUES('primary',now()) ON CONFLICT(id) DO UPDATE SET seen_at=now()`.execute(
      this.db,
    );
    await sql`UPDATE outbox_jobs SET state='pending',locked_at=NULL WHERE state='processing' AND locked_at<now()-interval '2 minutes'`.execute(
      this.db,
    );
    const job = await this.db.transaction().execute(async (tx) => {
      const row = (
        await sql<Job>`SELECT id,kind,entity_id,region_id,attempts FROM outbox_jobs WHERE state='pending' AND available_at<=now() ORDER BY available_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`.execute(
          tx,
        )
      ).rows[0];
      if (row)
        await sql`UPDATE outbox_jobs SET state='processing',attempts=attempts+1,locked_at=now() WHERE id=${row.id}::uuid`.execute(
          tx,
        );
      return row;
    });
    if (!job) return false;
    try {
      if (job.kind === 'triage') await this.triage(job);
      if (job.kind === 'source_sync') await this.source(job);
      if (job.kind === 'retention') await this.retention();
      await sql`UPDATE outbox_jobs SET state='completed',locked_at=NULL,error=NULL WHERE id=${job.id}::uuid`.execute(
        this.db,
      );
    } catch (error) {
      const terminal = job.attempts >= 3 || (error instanceof AiInferenceError && !error.retryable);
      const delay = Math.max(
        Math.min(300000, 2 ** (job.attempts + 1) * 1000),
        error instanceof AiInferenceError ? error.retryAfterMs : 0,
      );
      await sql`UPDATE outbox_jobs SET state=${terminal ? 'failed' : 'pending'},locked_at=NULL,error=${error instanceof AiInferenceError ? error.message : 'Processing failed; inspect adapter configuration or availability'},available_at=now()+${delay}*interval '1 millisecond' WHERE id=${job.id}::uuid`.execute(
        this.db,
      );
    }
    return true;
  }
  async triage(job: Job) {
    if (
      (await sql`SELECT key FROM app_metadata WHERE key=${`triage-job:${job.id}`}`.execute(this.db))
        .rows.length
    )
      return;
    const report = (
      await sql<TriageInput>`SELECT id,description,landmark_text AS "landmarkText",observation_time::text AS "observationTime" FROM reports WHERE id=${job.entity_id}::uuid AND NOT erased`.execute(
        this.db,
      )
    ).rows[0];
    if (!report) return;
    // Spatial duplicate evidence stays available when AI is disabled or unavailable.
    const mayProcess = await this.db.transaction().execute(async (tx) => {
      const available = (
        await sql`SELECT id FROM reports WHERE id=${report.id}::uuid AND NOT erased FOR SHARE`.execute(
          tx,
        )
      ).rows.length;
      if (!available) return false;
      await sql`INSERT INTO duplicate_candidates(report_id,other_id,region_id,evidence) SELECT r.id,o.id,r.region_id,'Titik dalam 250 meter, pengamatan dalam 60 menit; kemiripan teks >= 0,15 atau kategori sama. Perlu keputusan manusia.' FROM reports r JOIN reports o ON o.region_id=r.region_id AND o.id<>r.id WHERE r.id=${report.id}::uuid AND NOT r.erased AND NOT o.erased AND o.state NOT IN ('rejected','closed') AND r.observation_time IS NOT NULL AND o.observation_time IS NOT NULL AND abs(extract(epoch FROM r.observation_time-o.observation_time))<=3600 AND ST_DWithin(r.location::geography,o.location::geography,250) AND (similarity(r.description,o.description)>=0.15 OR r.category=o.category) ON CONFLICT(report_id,other_id) DO NOTHING`.execute(
        tx,
      );
      return true;
    });
    if (!mayProcess) return;
    const adapter = createAiAdapter();
    const start = Date.now();
    if (!adapter) return;
    let output = null;
    let failure: AiInferenceError | null = null;
    try {
      output = await adapter.suggest(report);
    } catch (error) {
      failure =
        error instanceof AiInferenceError ? error : new AiInferenceError('invalid_output', false);
      // Do not mark retryable attempts as processed: the outbox owns bounded retries.
      if (failure.retryable && job.attempts < 3) throw failure;
    }
    await this.db.transaction().execute(async (tx) => {
      const marked =
        await sql`INSERT INTO app_metadata(key,value) VALUES(${`triage-job:${job.id}`},'{}'::jsonb) ON CONFLICT DO NOTHING RETURNING key`.execute(
          tx,
        );
      if (!marked.rows.length) return;
      const available = (
        await sql`SELECT id FROM reports WHERE id=${report.id}::uuid AND NOT erased FOR SHARE`.execute(
          tx,
        )
      ).rows.length;
      if (!available) return;
      await sql`INSERT INTO ai_suggestions(report_id,output,state,provider,model,prompt_version,duration_ms,error) VALUES(${report.id}::uuid,${output ? JSON.stringify(output) : null}::jsonb,${failure ? 'failed' : 'ready'},${adapter.provider},${adapter.model},${PROMPT_VERSION},${Date.now() - start},${failure?.message ?? null})`.execute(
        tx,
      );
      await audit(tx, null, job.region_id, 'triage.processed', report.id, {
        provider: adapter.provider,
        failed: Boolean(failure),
      });
    });
    if (failure) throw failure;
  }
  async source(job: Job) {
    const source = (
      await sql<
        SourceInput & { enabled: boolean }
      >`SELECT id,region_id AS "regionId",name,provider,mode,source_url AS "sourceUrl",config,enabled FROM information_sources WHERE id=${job.entity_id}::uuid`.execute(
        this.db,
      )
    ).rows[0];
    if (!source?.enabled) return;
    await sql`UPDATE information_sources SET last_attempt_at=now() WHERE id=${source.id}::uuid`.execute(
      this.db,
    );
    try {
      const records = await ingestSource(source);
      await this.db.transaction().execute(async (tx) => {
        const enabled = (
          await sql<{
            enabled: boolean;
          }>`SELECT enabled FROM information_sources WHERE id=${source.id}::uuid FOR UPDATE`.execute(
            tx,
          )
        ).rows[0]?.enabled;
        if (!enabled) return;
        for (const r of records) {
          const externalId =
            source.provider === 'fixture' ? 'fixture-1' : `${r.version}:${r.effectiveAt ?? ''}`;
          const row = (
            await sql<{
              id: string;
            }>`INSERT INTO information_records(source_id,region_id,external_id,title,body,source_name,source_url,source_type,observed_at,fetched_at,effective_at,expires_at,verification_status,version,simulation) VALUES(${source.id}::uuid,${source.regionId}::uuid,${externalId},${r.title},${r.body},${r.sourceName},${r.sourceUrl},${r.sourceType},${r.observedAt}::timestamptz,${r.fetchedAt}::timestamptz,${r.effectiveAt}::timestamptz,${r.expiresAt}::timestamptz,${r.verificationStatus},${r.version},${r.simulation}) ON CONFLICT(source_id,external_id) DO UPDATE SET title=excluded.title,body=excluded.body,fetched_at=excluded.fetched_at,expires_at=excluded.expires_at,version=excluded.version RETURNING id`.execute(
              tx,
            )
          ).rows[0]!;
          await sql`INSERT INTO information_revisions(information_id,content) VALUES(${row.id}::uuid,${JSON.stringify(r)}::jsonb)`.execute(
            tx,
          );
        }
        await sql`UPDATE information_sources SET last_success_at=now(),last_error=NULL WHERE id=${source.id}::uuid`.execute(
          tx,
        );
        await sql`INSERT INTO source_runs(source_id,state,record_count) VALUES(${source.id}::uuid,'success',${records.length})`.execute(
          tx,
        );
        await audit(tx, null, source.regionId, 'source.synced', source.id, {
          count: records.length,
        });
      });
    } catch {
      await sql`UPDATE information_sources SET last_error='Adapter failed, invalid data, timeout, or missing authorization' WHERE id=${source.id}::uuid`.execute(
        this.db,
      );
      await sql`INSERT INTO source_runs(source_id,state,error) VALUES(${source.id}::uuid,'failed','Adapter failed')`.execute(
        this.db,
      );
      throw new Error('Source failed');
    }
  }
  async schedule() {
    await sql`INSERT INTO outbox_jobs(kind,entity_id,region_id,dedupe_key) SELECT 'source_sync',id,region_id,'source:'||id||':'||floor(extract(epoch FROM now())/1800)::text FROM information_sources WHERE enabled ON CONFLICT DO NOTHING`.execute(
      this.db,
    );
    await sql`INSERT INTO outbox_jobs(kind,dedupe_key) VALUES('retention','retention:'||to_char(now(),'YYYY-MM-DD')) ON CONFLICT DO NOTHING`.execute(
      this.db,
    );
  }
  async retention() {
    await this.db.transaction().execute(async (tx) => {
      await sql`DELETE FROM sessions WHERE expires_at<now()`.execute(tx);
      await sql`DELETE FROM rate_limits WHERE expires_at<now()`.execute(tx);
      await sql`DELETE FROM report_private_details WHERE retention_until<now()`.execute(tx);
      const expired = (
        await sql<{
          id: string;
          region_id: string;
        }>`SELECT r.id,r.region_id FROM reports r JOIN regions g ON g.id=r.region_id WHERE NOT r.erased AND r.created_at<now()-((g.config->>'retentionDays')::int*interval '1 day') LIMIT 200 FOR UPDATE OF r SKIP LOCKED`.execute(
          tx,
        )
      ).rows;
      for (const r of expired)
        await eraseReport(tx, r.id, r.region_id, null, 'Masa retensi laporan berakhir.');
      await sql`DELETE FROM notifications WHERE created_at<now()-interval '90 days'`.execute(tx);
    });
  }
}
