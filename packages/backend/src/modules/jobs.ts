import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { DatabaseService } from '../platform/database.service.js';
import { audit } from './shared.js';
import { eraseReport } from './privacy.js';
import { AiInferenceError, createAiAdapter, ingestSource, PROMPT_VERSION } from './adapters.js';
import type { SourceInput, TriageInput } from './adapters.js';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { AiService, type AiLease } from './ai.js';
import { aiOperationsSettings } from '../config/ai-operations.js';
import { observeAi, recordQueueMetrics } from '../platform/telemetry.js';

interface Job {
  id: string;
  kind: string;
  entity_id: string | null;
  region_id: string | null;
  attempts: number;
  fence: string;
  lease_owner: string;
}
@Injectable()
export class JobsService {
  readonly workerId = hostname() + ':' + randomUUID();
  constructor(
    @Inject(DatabaseService) readonly database: DatabaseService,
    @Inject(AiService) readonly ai: AiService,
  ) {}
  get db() {
    return this.database.db;
  }
  async tick() {
    await sql`INSERT INTO worker_heartbeat(id,seen_at) VALUES(${this.workerId},now()) ON CONFLICT(id) DO UPDATE SET seen_at=now()`.execute(
      this.db,
    );
    await sql`UPDATE outbox_jobs SET state='pending',locked_at=NULL,lease_owner=NULL,lease_until=NULL WHERE state='processing' AND (lease_until<now() OR (lease_until IS NULL AND locked_at<now()-interval '2 minutes'))`.execute(
      this.db,
    );
    if (process.env['OTEL_EXPORTER_OTLP_ENDPOINT']) {
      const rows = (
        await sql<{
          task: string;
          count: number;
          age: number;
        }>`SELECT COALESCE(r.task,j.kind) task,count(*)::int count,COALESCE(max(extract(epoch FROM now()-j.created_at)),0)::float8 age FROM outbox_jobs j LEFT JOIN ai_runs r ON r.id=j.entity_id WHERE j.state='pending' AND j.kind IN ('triage','ai_workflow','knowledge_index') GROUP BY COALESCE(r.task,j.kind)`.execute(
          this.db,
        )
      ).rows;
      const reserved = (
        await sql<{
          amount: number;
        }>`SELECT COALESCE(sum(reserved),0)::float8 amount FROM ai_budget_ledger WHERE day=current_date`.execute(
          this.db,
        )
      ).rows[0]!.amount;
      const workers = (
        await sql<{
          count: number;
        }>`SELECT count(*)::int count FROM worker_heartbeat WHERE seen_at>now()-interval '45 seconds'`.execute(
          this.db,
        )
      ).rows[0]!.count;
      const cap = aiOperationsSettings().AI_DAILY_BUDGET_MICRO_USD;
      recordQueueMetrics(rows, cap ? (100 * reserved) / cap : reserved ? 100 : 0, workers);
    }
    const job = await this.db.transaction().execute(async (tx) => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended('ai-dispatch',0))`.execute(tx);
      const active = (
        await sql<{
          count: number;
        }>`SELECT count(*)::int count FROM outbox_jobs WHERE state='processing' AND kind IN ('ai_workflow','triage','knowledge_index') AND lease_until>now()`.execute(
          tx,
        )
      ).rows[0]!.count;
      const row = (
        await sql<Job>`SELECT j.id,j.kind,j.entity_id,j.region_id,j.attempts FROM outbox_jobs j WHERE state='pending' AND available_at<=now() AND (${active < aiOperationsSettings().AI_MAX_CONCURRENT} OR kind NOT IN ('ai_workflow','triage','knowledge_index')) ORDER BY COALESCE((SELECT dispatched_at FROM ai_dispatch_turns recent WHERE recent.region_id=j.region_id),'-infinity'::timestamptz),CASE kind WHEN 'retention' THEN 0 WHEN 'triage' THEN 1 WHEN 'source_sync' THEN 2 WHEN 'ai_workflow' THEN 3 ELSE 4 END,available_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`.execute(
          tx,
        )
      ).rows[0];
      if (row) {
        const claimed = (
          await sql<{
            fence: string;
          }>`UPDATE outbox_jobs SET state='processing',attempts=attempts+1,locked_at=now(),lease_owner=${this.workerId},lease_until=now()+interval '2 minutes',fence=fence+1 WHERE id=${row.id}::uuid RETURNING fence::text`.execute(
            tx,
          )
        ).rows[0]!;
        row.fence = claimed.fence;
        row.lease_owner = this.workerId;
        if (row.region_id)
          await sql`INSERT INTO ai_dispatch_turns(region_id) VALUES(${row.region_id}::uuid) ON CONFLICT(region_id) DO UPDATE SET dispatched_at=now()`.execute(
            tx,
          );
      }
      return row;
    });
    if (!job) return false;
    const renewal = setInterval(() => {
      void sql`UPDATE outbox_jobs SET lease_until=now()+interval '2 minutes' WHERE id=${job.id}::uuid AND fence=${job.fence}::bigint AND lease_owner=${this.workerId} AND state='processing' AND lease_until>now()`
        .execute(this.db)
        .then(() =>
          sql`UPDATE worker_heartbeat SET seen_at=now() WHERE id=${this.workerId}`.execute(this.db),
        )
        .catch(() => {});
    }, 20000);
    renewal.unref();
    try {
      if (job.kind === 'triage')
        await observeAi('triage', process.env['AI_PROVIDER'] ?? 'custom', () => this.triage(job));
      if (job.kind === 'source_sync') await this.source(job);
      if (job.kind === 'retention') await this.retention();
      if (job.kind === 'ai_workflow')
        await observeAi('assistance', process.env['AI_PROVIDER'] ?? 'custom', () =>
          this.ai.process(job as AiLease),
        );
      if (job.kind === 'knowledge_index')
        await observeAi('knowledge_index', process.env['AI_EMBEDDING_PROVIDER'] ?? 'custom', () =>
          this.ai.indexKnowledge(job as AiLease),
        );
      await sql`UPDATE outbox_jobs SET state='completed',locked_at=NULL,error=NULL,lease_owner=NULL,lease_until=NULL WHERE id=${job.id}::uuid AND fence=${job.fence}::bigint AND lease_owner=${this.workerId} AND lease_until>now()`.execute(
        this.db,
      );
    } catch (error) {
      const terminal =
        job.attempts >=
          (job.kind === 'triage' && process.env['APP_MODE'] !== 'production' ? 3 : 2) ||
        (error instanceof AiInferenceError && !error.retryable);
      const delay = Math.max(
        Math.min(300000, 2 ** (job.attempts + 1) * 1000),
        error instanceof AiInferenceError ? error.retryAfterMs : 0,
      );
      if (['ai_workflow', 'knowledge_index'].includes(job.kind))
        await sql`UPDATE ai_runs SET state='failed',error=${error instanceof AiInferenceError ? error.code : 'workflow_unavailable'},updated_at=now() WHERE id=${job.entity_id}::uuid AND state NOT IN ('cancelled','expired','ready','unavailable')`.execute(
          this.db,
        );
      await sql`UPDATE outbox_jobs SET state=${terminal ? 'failed' : 'pending'},locked_at=NULL,lease_owner=NULL,lease_until=NULL,error=${error instanceof AiInferenceError ? error.message : 'Processing failed; inspect adapter configuration or availability'},available_at=now()+${delay + Math.floor(Math.random() * 1000)}*interval '1 millisecond' WHERE id=${job.id}::uuid AND fence=${job.fence}::bigint AND lease_owner=${this.workerId}`.execute(
        this.db,
      );
    } finally {
      clearInterval(renewal);
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
      output = await this.ai.triage(job, report);
    } catch (error) {
      failure =
        error instanceof AiInferenceError ? error : new AiInferenceError('invalid_output', false);
      // Do not mark retryable attempts as processed: the outbox owns bounded retries.
      if (failure.retryable && job.attempts < (process.env['APP_MODE'] === 'production' ? 2 : 3))
        throw failure;
    }
    await this.db.transaction().execute(async (tx) => {
      await this.ai.assertFence(tx, job);
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
      const provenance = (
        await sql<{
          release_id: string;
          manifest: Record<string, unknown>;
        }>`SELECT r.release_id,m.manifest FROM ai_runs r JOIN ai_model_releases m ON m.id=r.release_id WHERE r.request_key=${'triage:' + job.id}`.execute(
          tx,
        )
      ).rows[0];
      if (output && provenance)
        await this.ai.allowed(job.region_id!, 'triage', provenance.release_id, tx);
      const realInference = provenance?.manifest['mode'] === 'compatible';
      const provider = realInference ? String(provenance.manifest['provider']) : adapter.provider;
      const model = realInference ? String(provenance.manifest['model']) : adapter.model;
      await sql`INSERT INTO ai_suggestions(report_id,output,state,provider,model,prompt_version,duration_ms,error) VALUES(${report.id}::uuid,${output ? JSON.stringify(output) : null}::jsonb,${failure ? 'failed' : 'ready'},${provider},${model},${String(provenance?.manifest['promptVersion'] ?? PROMPT_VERSION)},${Date.now() - start},${failure?.message ?? null})`.execute(
        tx,
      );
      await audit(tx, null, job.region_id, 'triage.processed', report.id, {
        provider,
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
        await this.ai.assertFence(tx, job);
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
    await this.ai.scheduleKnowledge();
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
      await sql`UPDATE ai_runs SET state='expired',request='{}'::jsonb,updated_at=now() WHERE state IN ('queued','processing','failed') AND deadline<now()`.execute(
        tx,
      );
      await sql`DELETE FROM ai_runs WHERE created_at<now()-interval '30 days'`.execute(tx);
      if (
        (
          await sql<{
            present: string | null;
          }>`SELECT to_regclass('ai_checkpoints.checkpoints') present`.execute(tx)
        ).rows[0]?.['present']
      ) {
        for (const table of ['checkpoint_writes', 'checkpoint_blobs', 'checkpoints'])
          await sql
            .raw(
              `DELETE FROM ai_checkpoints.${table} c WHERE NOT EXISTS(SELECT 1 FROM ai_runs r WHERE r.id::text=c.thread_id)`,
            )
            .execute(tx);
      }
      await sql`DELETE FROM worker_heartbeat WHERE seen_at<now()-interval '1 day'`.execute(tx);
    });
  }
}
