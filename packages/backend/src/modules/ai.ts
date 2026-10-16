import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { StateGraph, StateSchema, START, END } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { sql } from 'kysely';
import { z } from 'zod';
import {
  aiRequestSchema,
  aiReviewSchema,
  aiEvaluationSchema,
  type AiEvidence,
  type User,
  type AiRun,
} from '@tandara/contracts';
import { DatabaseService } from '../platform/database.service.js';
import { IdentityService } from './identity.js';
import { PreparednessService } from './preparedness.js';
import { KnowledgeService, embedText, embeddingRelease, scopedAi } from './knowledge.js';
import { aiOperationsSettings } from '../config/ai-operations.js';
import { readAiSettings } from '../config/ai.js';
import { audit, found, hash, parse, rateLimit, type Connection } from './shared.js';
import {
  MAX_CONTEXT_CHARACTERS,
  WORKFLOW_VERSION,
  redactAiText,
  sensitiveAiText,
  validateAssistance,
} from './ai-policy.js';
import { generateAssistance } from './ai-gateway.js';
import {
  AiInferenceError,
  CompatibleAdapter,
  createAiAdapter,
  PROMPT_VERSION,
  type TriageInput,
} from './adapters.js';

type RunRow = {
  id: string;
  region_id: string;
  organization_id: string;
  actor_id: string | null;
  report_id: string | null;
  task: string;
  request: z.infer<typeof aiRequestSchema>;
  release_id: string;
  state: string;
  deadline: Date;
  manifest: Record<string, unknown>;
};
export type AiLease = {
  id: string;
  region_id: string | null;
  entity_id: string | null;
  attempts: number;
  fence: string;
  lease_owner: string;
};
const State = new StateSchema({ runId: z.string(), regionId: z.string(), stage: z.string() });
export async function setupAiCheckpoints() {
  const saver = PostgresSaver.fromConnString(process.env['DATABASE_URL']!, {
    schema: 'ai_checkpoints',
  });
  try {
    await saver.setup();
  } finally {
    await saver.end();
  }
}

@Injectable()
export class AiService implements OnApplicationShutdown {
  private saver: PostgresSaver | undefined;
  private setup: Promise<void> | undefined;
  constructor(
    @Inject(DatabaseService) readonly database: DatabaseService,
    @Inject(IdentityService) readonly identity: IdentityService,
    @Inject(PreparednessService) readonly preparedness: PreparednessService,
    @Inject(KnowledgeService) readonly knowledge: KnowledgeService,
  ) {}
  get db() {
    return this.database.db;
  }
  async onApplicationShutdown() {
    await this.saver?.end();
  }
  async release(task = 'assistance') {
    const settings = readAiSettings(process.env);
    const manifest = {
      provider: settings.AI_PROVIDER,
      endpoint: settings.AI_BASE_URL,
      pricing: hash(
        JSON.stringify([
          aiOperationsSettings().AI_INPUT_MICRO_USD_PER_MILLION_TOKENS,
          aiOperationsSettings().AI_OUTPUT_MICRO_USD_PER_MILLION_TOKENS,
          aiOperationsSettings().AI_EMBEDDING_MICRO_USD_PER_MILLION_TOKENS,
        ]),
      ),
      model: settings.AI_MODE === 'compatible' ? settings.AI_MODEL : 'deterministic',
      mode: settings.AI_MODE,
      promptVersion: task === 'triage' ? PROMPT_VERSION : WORKFLOW_VERSION,
      schemaVersion: '1',
      retrievalVersion: 'rrf-exact-1',
      embeddingRelease: embeddingRelease(),
      maxOutputTokens: settings.AI_MAX_OUTPUT_TOKENS,
    };
    const fingerprint = hash(JSON.stringify(manifest));
    const row =
      (
        await sql<{
          id: string;
          manifest: Record<string, unknown>;
        }>`INSERT INTO ai_model_releases(manifest,fingerprint) VALUES(${JSON.stringify(manifest)}::jsonb,${fingerprint}) ON CONFLICT(fingerprint) DO NOTHING RETURNING id,manifest`.execute(
          this.db,
        )
      ).rows[0] ??
      (
        await sql<{
          id: string;
          manifest: Record<string, unknown>;
        }>`SELECT id,manifest FROM ai_model_releases WHERE fingerprint=${fingerprint}`.execute(
          this.db,
        )
      ).rows[0]!;
    const override = (
      await sql<{
        value: { id: string };
      }>`SELECT value FROM app_metadata WHERE key=${'ai-active-release:' + task}`.execute(this.db)
    ).rows[0];
    if (!override) return row;
    const selected = found(
      (
        await sql<{
          id: string;
          manifest: Record<string, unknown>;
        }>`SELECT id,manifest FROM ai_model_releases WHERE id=${override.value.id}::uuid`.execute(
          this.db,
        )
      ).rows[0],
    );
    if (
      selected.manifest['provider'] !== manifest.provider ||
      selected.manifest['endpoint'] !== manifest.endpoint ||
      selected.manifest['pricing'] !== manifest.pricing ||
      selected.manifest['mode'] !== manifest.mode ||
      selected.manifest['embeddingRelease'] !== manifest.embeddingRelease ||
      selected.manifest['promptVersion'] !== manifest.promptVersion
    )
      throw new ServiceUnavailableException(
        'Rilis tidak sesuai konfigurasi provider atau embedding.',
      );
    return selected;
  }
  async triage(lease: AiLease, input: TriageInput) {
    const release = await this.release('triage');
    const region = await this.allowed(lease.region_id!, 'triage', release.id);
    if (sensitiveAiText(input.description + ' ' + (input.landmarkText ?? '')))
      throw new AiInferenceError('provider_rejected', false);
    const safe = {
      ...input,
      description: redactAiText(input.description),
      landmarkText: input.landmarkText ? redactAiText(input.landmarkText) : null,
    };
    const run = await this.db.transaction().execute(async (tx) => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended('ai-admission',0))`.execute(tx);
      const previous = (
        await sql<{
          id: string;
          state: string;
        }>`SELECT id,state FROM ai_runs WHERE request_key=${'triage:' + lease.id} ORDER BY created_at DESC LIMIT 1`.execute(
          tx,
        )
      ).rows[0];
      if (previous && !(previous.state === 'failed' && lease.attempts === 0)) return previous;
      if (previous)
        await sql`UPDATE ai_runs SET request_key=request_key||':'||id WHERE id=${previous.id}::uuid`.execute(
          tx,
        );
      const row = (
        await sql<{
          id: string;
          state: string;
        }>`INSERT INTO ai_runs(region_id,organization_id,report_id,task,request,request_key,release_id) VALUES(${lease.region_id}::uuid,${region.organization_id}::uuid,${input.id}::uuid,'triage','{}'::jsonb,${'triage:' + lease.id},${release.id}::uuid) RETURNING id,state`.execute(
          tx,
        )
      ).rows[0]!;
      await this.reserve(tx, row.id, region.organization_id);
      return row;
    });
    const saved = (
      await sql<{
        candidate: unknown;
      }>`SELECT candidate FROM ai_attempts WHERE run_id=${run.id}::uuid AND state='succeeded' ORDER BY number DESC LIMIT 1`.execute(
        this.db,
      )
    ).rows[0];
    if (saved) {
      const { triageSchema } = await import('@tandara/contracts');
      return triageSchema.parse(saved.candidate);
    }
    const settings = readAiSettings(process.env);
    const adapter =
      settings.AI_MODE === 'compatible'
        ? new CompatibleAdapter(
            settings.AI_BASE_URL,
            settings.AI_API_KEY,
            String(release.manifest['model']),
            {
              provider: settings.AI_PROVIDER,
              timeout: settings.AI_TIMEOUT_MS,
              maxOutputTokens: Number(release.manifest['maxOutputTokens']),
            },
          )
        : createAiAdapter();
    if (!adapter) throw new AiInferenceError('provider_rejected', false);
    const number =
      (
        await sql<{
          count: number;
        }>`SELECT count(*)::int count FROM ai_attempts WHERE run_id=${run.id}::uuid`.execute(
          this.db,
        )
      ).rows[0]!.count + 1;
    if (number > (process.env['APP_MODE'] === 'production' ? 3 : 4))
      throw new AiInferenceError('provider_rejected', false);
    const attempt = (
      await sql<{
        id: string;
      }>`INSERT INTO ai_attempts(run_id,region_id,number,provider,model,state,estimated_tokens) VALUES(${run.id}::uuid,${lease.region_id}::uuid,${number},${adapter.provider},${adapter.model},'processing',${safe.description.length + (safe.landmarkText?.length ?? 0) + settings.AI_MAX_OUTPUT_TOKENS}) RETURNING id`.execute(
        this.db,
      )
    ).rows[0]!;
    const start = Date.now();
    try {
      const output = await adapter.suggest(safe);
      await this.db.transaction().execute(async (tx) => {
        await this.assertFence(tx, lease);
        if (
          !(
            await sql`SELECT id FROM reports WHERE id=${input.id}::uuid AND NOT erased FOR SHARE`.execute(
              tx,
            )
          ).rows.length
        )
          throw new AiInferenceError('provider_rejected', false);
        await this.allowed(lease.region_id!, 'triage', release.id, tx);
        await sql`UPDATE ai_attempts SET state='succeeded',candidate=${JSON.stringify(output)}::jsonb,usage=${adapter instanceof CompatibleAdapter && adapter.usage ? JSON.stringify(adapter.usage) : null}::jsonb,duration_ms=${Date.now() - start} WHERE id=${attempt.id}::uuid`.execute(
          tx,
        );
        await sql`UPDATE ai_runs SET state='ready',updated_at=now() WHERE id=${run.id}::uuid AND state<>'cancelled'`.execute(
          tx,
        );
      });
      await this.reconcile(run.id);
      return output;
    } catch (error) {
      const failure =
        error instanceof AiInferenceError ? error : new AiInferenceError('invalid_output', false);
      await sql`UPDATE ai_attempts SET state='failed',error=${failure.code},duration_ms=${Date.now() - start} WHERE id=${attempt.id}::uuid`.execute(
        this.db,
      );
      await sql`UPDATE ai_runs SET state='failed',error=${failure.code} WHERE id=${run.id}::uuid AND state<>'cancelled'`.execute(
        this.db,
      );
      throw failure;
    }
  }
  async allowed(regionId: string, task: string, releaseId: string, tx: Connection = this.db) {
    await sql`SELECT pg_advisory_xact_lock(hashtextextended('ai-policy',0))`.execute(tx);
    const region = found(
      (
        await sql<{
          organization_id: string;
          suspended: boolean;
          simulation: boolean;
        }>`SELECT organization_id,suspended,simulation FROM regions WHERE id=${regionId}::uuid FOR SHARE`.execute(
          tx,
        )
      ).rows[0],
    );
    const settings = readAiSettings(process.env);
    const off = (
      await sql`SELECT scope FROM ai_controls WHERE NOT enabled AND ((scope='global' AND scope_id='*') OR (scope='provider' AND scope_id=${settings.AI_PROVIDER}) OR (scope='task' AND scope_id=${task}) OR (scope='organization' AND scope_id=${region.organization_id}) OR (scope='release' AND scope_id=${releaseId}))`.execute(
        tx,
      )
    ).rows.length;
    if (off || region.suspended || settings.AI_MODE === 'disabled')
      throw new ServiceUnavailableException(
        'Bantuan AI dihentikan; pekerjaan manual tetap tersedia.',
      );
    if (process.env['APP_MODE'] === 'production') {
      if (region.simulation || settings.AI_MODE !== 'compatible')
        throw new ServiceUnavailableException('AI produksi memerlukan konfigurasi nyata.');
      const approvals = await this.approvalCount(releaseId, tx);
      if (approvals < 2)
        throw new ServiceUnavailableException('Rilis AI belum disetujui dua penanggung jawab.');
    }
    return region;
  }
  async submit(user: User, regionId: string, input: unknown, previousRunId: string | null = null) {
    const region = await this.identity.scope(user, regionId);
    const normalizedInput =
      typeof input === 'object' &&
      input !== null &&
      !(input as Record<string, unknown>)['requestKey']
        ? { ...input, requestKey: crypto.randomUUID() }
        : input;
    const request = parse(aiRequestSchema, normalizedInput);
    if (
      request.task === 'translation' &&
      !(region.config.languages as readonly string[]).includes(request.language)
    )
      throw new BadRequestException('Bahasa belum diaktifkan wilayah ini.');
    if (sensitiveAiText(request.question ?? ''))
      throw new BadRequestException(
        'Teks mengandung kemungkinan identitas pribadi; tinjau secara lokal.',
      );
    request.question = request.question
      ? parse(z.string().max(1500), redactAiText(request.question))
      : undefined;
    if (request.reportId)
      found(
        (
          await sql`SELECT id FROM reports WHERE id=${request.reportId}::uuid AND region_id=${regionId}::uuid AND NOT erased`.execute(
            this.db,
          )
        ).rows[0],
      );
    await rateLimit(this.db, `ai-submit:${user.id}`, 30, 3600);
    const release = await this.release();
    await this.allowed(regionId, request.task, release.id);
    return this.db.transaction().execute(async (tx) => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended('ai-admission',0))`.execute(tx);
      if (previousRunId) {
        const parent = found(
          (
            await sql<{
              state: string;
            }>`SELECT state FROM ai_runs WHERE id=${previousRunId}::uuid AND region_id=${regionId}::uuid FOR UPDATE`.execute(
              tx,
            )
          ).rows[0],
        );
        if (!['failed', 'expired'].includes(parent.state))
          throw new ConflictException(
            'Hanya permintaan gagal atau kedaluwarsa yang dapat diulang.',
          );
        const linked = (
          await sql<{
            id: string;
          }>`SELECT id FROM ai_runs WHERE previous_run_id=${previousRunId}::uuid ORDER BY created_at DESC LIMIT 1`.execute(
            tx,
          )
        ).rows[0];
        if (linked) return linked;
      }
      const existing = (
        await sql<{
          id: string;
          request: unknown;
          actor_id: string;
          region_id: string;
        }>`SELECT id,request,actor_id,region_id FROM ai_runs WHERE request_key=${request.requestKey}`.execute(
          tx,
        )
      ).rows[0];
      if (existing) {
        if (
          existing.actor_id !== user.id ||
          existing.region_id !== regionId ||
          hash(JSON.stringify(parse(aiRequestSchema, existing.request))) !==
            hash(JSON.stringify(request))
        )
          throw new ConflictException('Kunci permintaan telah dipakai untuk permintaan berbeda.');
        return { id: existing.id };
      }
      const ops = aiOperationsSettings();
      const pending = (
        await sql<{
          count: number;
        }>`SELECT count(*)::int count FROM ai_runs WHERE region_id=${regionId}::uuid AND state IN ('queued','processing')`.execute(
          tx,
        )
      ).rows[0]!.count;
      if (pending >= ops.AI_MAX_PENDING_PER_REGION)
        throw new ServiceUnavailableException('Antrean AI wilayah penuh.');
      const run = (
        await sql<{
          id: string;
        }>`INSERT INTO ai_runs(region_id,organization_id,actor_id,report_id,task,request,request_key,release_id,previous_run_id) VALUES(${regionId}::uuid,${region.organizationId}::uuid,${user.id}::uuid,${request.reportId ?? null}::uuid,${request.task},${JSON.stringify(request)}::jsonb,${request.requestKey},${release.id}::uuid,${previousRunId}::uuid) RETURNING id`.execute(
          tx,
        )
      ).rows[0]!;
      await this.reserve(tx, run.id, region.organizationId);
      await sql`INSERT INTO outbox_jobs(kind,entity_id,region_id,dedupe_key) VALUES('ai_workflow',${run.id}::uuid,${regionId}::uuid,${'ai:' + run.id})`.execute(
        tx,
      );
      await audit(tx, user.id, regionId, 'ai.submitted', run.id, {
        task: request.task,
        previousRunId,
        releaseId: release.id,
      });
      return run;
    });
  }
  async retry(user: User, regionId: string, id: string) {
    await this.identity.scope(user, regionId);
    parse(z.uuid(), id);
    const parent = found(
      (
        await sql<{
          request: unknown;
        }>`SELECT request FROM ai_runs WHERE id=${id}::uuid AND region_id=${regionId}::uuid AND task NOT IN ('knowledge_index','triage')`.execute(
          this.db,
        )
      ).rows[0],
    );
    const request = parse(aiRequestSchema, parent.request);
    return this.submit(user, regionId, { ...request, requestKey: crypto.randomUUID() }, id);
  }
  async reserve(tx: Connection, runId: string, organizationId: string) {
    const s = aiOperationsSettings();
    const release = found(
      (
        await sql<{
          manifest: Record<string, unknown>;
          task: string;
          request: Record<string, unknown>;
        }>`SELECT m.manifest,r.task,r.request FROM ai_runs r JOIN ai_model_releases m ON m.id=r.release_id WHERE r.id=${runId}::uuid`.execute(
          tx,
        )
      ).rows[0],
    );
    const budget = (
      await sql<{
        global: string;
        monthly: string;
        organization: string;
      }>`SELECT COALESCE(sum(COALESCE(actual, reserved)) FILTER(WHERE day=current_date),0)::text global,COALESCE(sum(COALESCE(actual, reserved)) FILTER(WHERE day>=date_trunc('month',now())::date),0)::text monthly,COALESCE(sum(COALESCE(actual, reserved)) FILTER(WHERE day=current_date AND organization_id=${organizationId}::uuid),0)::text organization FROM ai_budget_ledger`.execute(
        tx,
      )
    ).rows[0]!;
    const paid =
      readAiSettings(process.env).AI_MODE === 'compatible' || s.AI_EMBEDDING_MODE === 'compatible';
    // Byte/JSON expansion bounds include multilingual text and source metadata; never assume characters equal tokens.
    const inputBound =
      release.task === 'triage'
        ? Buffer.byteLength(JSON.stringify(release.request), 'utf8') + 12000
        : 6 * (MAX_CONTEXT_CHARACTERS + 21500) + 12000;
    let embeddingBound = 0;
    if (s.AI_EMBEDDING_MODE === 'compatible') {
      if (release.task === 'knowledge_index') {
        const chunk = (
          await sql<{
            text: string;
          }>`SELECT text FROM knowledge_chunks WHERE id=${String(release.request['chunkId'])}::uuid`.execute(
            tx,
          )
        ).rows[0];
        embeddingBound = chunk ? Buffer.byteLength(chunk.text, 'utf8') + 64 : 0;
      } else if (['answer', 'plan_draft', 'training_draft', 'translation'].includes(release.task))
        embeddingBound = Buffer.byteLength(String(release.request['question'] ?? ''), 'utf8') + 64;
    }
    const generationCost =
      readAiSettings(process.env).AI_MODE === 'compatible' && release.task !== 'knowledge_index'
        ? (release.task === 'triage' && process.env['APP_MODE'] !== 'production' ? 4 : 3) *
          (inputBound * s.AI_INPUT_MICRO_USD_PER_MILLION_TOKENS +
            Number(release.manifest['maxOutputTokens']) * s.AI_OUTPUT_MICRO_USD_PER_MILLION_TOKENS)
        : 0;
    const worst = Math.ceil(
      (generationCost + 3 * embeddingBound * s.AI_EMBEDDING_MICRO_USD_PER_MILLION_TOKENS) / 1000000,
    );
    if (
      paid &&
      (worst > s.AI_RUN_MAX_MICRO_USD ||
        Number(budget.global) + worst > s.AI_DAILY_BUDGET_MICRO_USD ||
        Number(budget.monthly) + worst > s.AI_MONTHLY_BUDGET_MICRO_USD ||
        Number(budget.organization) + worst > s.AI_ORG_DAILY_BUDGET_MICRO_USD)
    )
      throw new ServiceUnavailableException('Batas anggaran AI tercapai.');
    await sql`INSERT INTO ai_budget_reservations(run_id,organization_id,reserved) VALUES(${runId}::uuid,${organizationId}::uuid,${paid ? worst : 0}) ON CONFLICT DO NOTHING`.execute(
      tx,
    );
    await sql`INSERT INTO ai_budget_ledger(run_id,organization_id,day,reserved) VALUES(${runId}::uuid,${organizationId}::uuid,current_date,${paid ? worst : 0}) ON CONFLICT DO NOTHING`.execute(
      tx,
    );
  }
  async retryIndex(user: User, id: string) {
    await this.requireOperator(user, 'operator');
    parse(z.uuid(), id);
    if (aiOperationsSettings().AI_EMBEDDING_MODE !== 'compatible')
      throw new ConflictException('Embedding belum diaktifkan.');
    const release = await this.release();
    return this.db.transaction().execute(async (tx) => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended('ai-admission',0))`.execute(tx);
      const parent = found(
        (
          await sql<{
            region_id: string;
            organization_id: string;
            request: unknown;
            state: string;
          }>`SELECT region_id,organization_id,request,state FROM ai_runs WHERE id=${id}::uuid AND task='knowledge_index' FOR UPDATE`.execute(
            tx,
          )
        ).rows[0],
      );
      if (parent.state !== 'failed')
        throw new ConflictException('Hanya indeks gagal yang dapat diulang.');
      await this.allowed(parent.region_id, 'knowledge_index', release.id, tx);
      const linked = (
        await sql<{ id: string }>`SELECT id FROM ai_runs WHERE previous_run_id=${id}::uuid`.execute(
          tx,
        )
      ).rows[0];
      if (linked) return { ok: true };
      const pending = (
        await sql<{
          count: string;
        }>`SELECT count(*)::text count FROM ai_runs WHERE region_id=${parent.region_id}::uuid AND state IN ('queued','processing')`.execute(
          tx,
        )
      ).rows[0];
      if (Number(pending?.count) >= aiOperationsSettings().AI_MAX_PENDING_PER_REGION)
        throw new ConflictException('Antrean AI penuh. Coba kembali nanti.');
      const request = parse(z.object({ chunkId: z.uuid() }), parent.request);
      await sql`UPDATE ai_runs SET request_key=request_key||':failed:'||id::text WHERE id=${id}::uuid`.execute(
        tx,
      );
      const next = found(
        (
          await sql<{
            id: string;
          }>`INSERT INTO ai_runs(region_id,organization_id,actor_id,task,request,request_key,release_id,previous_run_id) VALUES(${parent.region_id}::uuid,${parent.organization_id}::uuid,${user.id}::uuid,'knowledge_index',${JSON.stringify(request)}::jsonb,${'index:' + request.chunkId + ':' + embeddingRelease()},${release.id}::uuid,${id}::uuid) RETURNING id`.execute(
            tx,
          )
        ).rows[0],
      );
      await this.reserve(tx, next.id, parent.organization_id);
      await sql`INSERT INTO outbox_jobs(kind,entity_id,region_id,dedupe_key) VALUES('knowledge_index',${next.id}::uuid,${parent.region_id}::uuid,${'ai:' + next.id})`.execute(
        tx,
      );
      await audit(tx, user.id, parent.region_id, 'ai.index_retried', next.id, {
        previousRunId: id,
      });
      return { ok: true };
    });
  }
  async scheduleKnowledge() {
    // Ingestion has its own provider profile and shares conservative funded admission.
    if (
      aiOperationsSettings().AI_EMBEDDING_MODE !== 'compatible' ||
      readAiSettings(process.env).AI_MODE === 'disabled'
    )
      return;
    const regions = (
      await sql<{
        id: string;
        organization_id: string;
      }>`SELECT id,organization_id FROM regions WHERE NOT suspended`.execute(this.db)
    ).rows;
    const release = await this.release();
    for (const region of regions) {
      await this.knowledge.synchronize(region.id);
      const chunks = (
        await scopedAi(this.db, region.id, (tx) =>
          sql<{
            id: string;
          }>`SELECT id FROM knowledge_chunks WHERE embedding_release IS DISTINCT FROM ${embeddingRelease()} LIMIT 20`.execute(
            tx,
          ),
        )
      ).rows;
      for (const chunk of chunks) {
        try {
          await this.allowed(region.id, 'knowledge_index', release.id);
          await this.db.transaction().execute(async (tx) => {
            await sql`SELECT pg_advisory_xact_lock(hashtextextended('ai-admission',0))`.execute(tx);
            const pending = (
              await sql<{
                count: number;
              }>`SELECT count(*)::int count FROM ai_runs WHERE region_id=${region.id}::uuid AND state IN ('queued','processing')`.execute(
                tx,
              )
            ).rows[0]!.count;
            if (pending >= aiOperationsSettings().AI_MAX_PENDING_PER_REGION)
              throw new ServiceUnavailableException('Antrean indeks penuh.');
            const run = (
              await sql<{
                id: string;
              }>`INSERT INTO ai_runs(region_id,organization_id,task,request,request_key,release_id) VALUES(${region.id}::uuid,${region.organization_id}::uuid,'knowledge_index',${JSON.stringify({ chunkId: chunk.id })}::jsonb,${'index:' + chunk.id + ':' + embeddingRelease()},${release.id}::uuid) ON CONFLICT DO NOTHING RETURNING id`.execute(
                tx,
              )
            ).rows[0];
            if (!run) return;
            await this.reserve(tx, run.id, region.organization_id);
            await sql`INSERT INTO outbox_jobs(kind,entity_id,region_id,dedupe_key) VALUES('knowledge_index',${run.id}::uuid,${region.id}::uuid,${'ai:' + run.id})`.execute(
              tx,
            );
          });
        } catch {
          break;
        }
      }
    }
  }
  async reconcile(runId: string) {
    const ops = aiOperationsSettings();
    const attempts = (
      await sql<{
        usage: { prompt_tokens: number; completion_tokens: number } | null;
        estimated_tokens: number;
        operation: string;
      }>`SELECT usage,estimated_tokens,operation FROM ai_attempts WHERE run_id=${runId}::uuid`.execute(
        this.db,
      )
    ).rows;
    const estimated = attempts.some((a) => !a.usage);
    const amount = Math.ceil(
      attempts.reduce(
        (sum, a) =>
          sum +
          (a.usage
            ? a.operation === 'embedding'
              ? a.usage.prompt_tokens * ops.AI_EMBEDDING_MICRO_USD_PER_MILLION_TOKENS
              : a.usage.prompt_tokens * ops.AI_INPUT_MICRO_USD_PER_MILLION_TOKENS +
                a.usage.completion_tokens * ops.AI_OUTPUT_MICRO_USD_PER_MILLION_TOKENS
            : a.estimated_tokens *
              (a.operation === 'embedding'
                ? ops.AI_EMBEDDING_MICRO_USD_PER_MILLION_TOKENS
                : Math.max(
                    ops.AI_INPUT_MICRO_USD_PER_MILLION_TOKENS,
                    ops.AI_OUTPUT_MICRO_USD_PER_MILLION_TOKENS,
                  ))),
        0,
      ) / 1000000,
    );
    await sql`UPDATE ai_budget_reservations SET actual=${amount},estimated=${estimated} WHERE run_id=${runId}::uuid`.execute(
      this.db,
    );
    await sql`UPDATE ai_budget_ledger SET actual=${amount},estimated=${estimated} WHERE run_id=${runId}::uuid`.execute(
      this.db,
    );
  }
  async indexKnowledge(lease: AiLease) {
    const run = await this.load(lease.entity_id!, lease.region_id!);
    const chunkId = z.object({ chunkId: z.uuid() }).parse(run.request).chunkId;
    const chunk = (
      await scopedAi(this.db, run.region_id, (tx) =>
        sql<{
          text: string;
          embedding_release: string | null;
          source_id: string;
          source_kind: 'plan' | 'reference';
          version: string;
        }>`SELECT c.text,c.embedding_release,d.source_id,d.source_kind,d.version FROM knowledge_chunks c JOIN knowledge_documents d ON d.id=c.document_id JOIN public.ai_approved_plans p ON p.id=d.source_id WHERE c.id=${chunkId}::uuid AND d.expires_at>now()`.execute(
          tx,
        ),
      )
    ).rows[0];
    if (!chunk || chunk.embedding_release === embeddingRelease()) {
      await sql`UPDATE ai_runs SET state='ready' WHERE id=${run.id}::uuid`.execute(this.db);
      return;
    }
    const start = Date.now();
    const attempt = (
      await sql<{
        id: string;
      }>`INSERT INTO ai_attempts(run_id,region_id,number,provider,model,state,estimated_tokens,operation) VALUES(${run.id}::uuid,${run.region_id}::uuid,${lease.attempts + 1},${aiOperationsSettings().AI_EMBEDDING_PROVIDER},${aiOperationsSettings().AI_EMBEDDING_MODEL},'processing',${Buffer.byteLength(chunk.text, 'utf8') + 64},'embedding') RETURNING id`.execute(
        this.db,
      )
    ).rows[0]!;
    try {
      let tokens: number | null = null;
      const vector = await embedText(chunk.text, (n) => {
        tokens = n;
      });
      await this.db.transaction().execute(async (tx) => {
        await this.fresh(
          tx,
          [
            {
              id: chunkId,
              entityId: chunk.source_id,
              kind: chunk.source_kind,
              version: chunk.version,
              title: '',
              text: chunk.text,
            },
          ],
          run.region_id,
        );
        await sql`SELECT id FROM ai_runs WHERE id=${run.id}::uuid FOR UPDATE`.execute(tx);
        await this.assertFence(tx, lease);
        await this.load(run.id, run.region_id, tx);
        await sql`UPDATE knowledge_chunks SET embedding=${JSON.stringify(vector)}::vector,embedding_release=${embeddingRelease()} WHERE id=${chunkId}::uuid AND region_id=${run.region_id}::uuid`.execute(
          tx,
        );
        await sql`UPDATE ai_attempts SET state='succeeded',usage=${tokens === null ? null : JSON.stringify({ prompt_tokens: tokens, completion_tokens: 0 })}::jsonb,duration_ms=${Date.now() - start} WHERE id=${attempt.id}::uuid`.execute(
          tx,
        );
        await sql`UPDATE ai_runs SET state='ready',updated_at=now() WHERE id=${run.id}::uuid`.execute(
          tx,
        );
      });
    } catch (error) {
      const failure =
        error instanceof AiInferenceError
          ? error
          : new AiInferenceError('provider_rejected', false);
      await sql`UPDATE ai_attempts SET state='failed',error=${failure.code} WHERE id=${attempt.id}::uuid`.execute(
        this.db,
      );
      throw failure;
    } finally {
      await this.reconcile(run.id);
    }
  }
  async load(id: string, regionId: string, tx: Connection = this.db): Promise<RunRow> {
    const run = found(
      (
        await sql<RunRow>`SELECT r.*,m.manifest FROM ai_runs r JOIN ai_model_releases m ON m.id=r.release_id WHERE r.id=${id}::uuid AND r.region_id=${regionId}::uuid`.execute(
          tx,
        )
      ).rows[0],
    );
    const configured = readAiSettings(process.env);
    if (
      run.manifest['provider'] !== configured.AI_PROVIDER ||
      run.manifest['endpoint'] !== configured.AI_BASE_URL ||
      run.manifest['pricing'] !==
        hash(
          JSON.stringify([
            aiOperationsSettings().AI_INPUT_MICRO_USD_PER_MILLION_TOKENS,
            aiOperationsSettings().AI_OUTPUT_MICRO_USD_PER_MILLION_TOKENS,
            aiOperationsSettings().AI_EMBEDDING_MICRO_USD_PER_MILLION_TOKENS,
          ]),
        ) ||
      run.manifest['mode'] !== configured.AI_MODE ||
      run.manifest['embeddingRelease'] !== embeddingRelease() ||
      run.manifest['promptVersion'] !== (run.task === 'triage' ? PROMPT_VERSION : WORKFLOW_VERSION)
    )
      throw new AiInferenceError('provider_rejected', false);
    if (['cancelled', 'expired', 'unavailable'].includes(run.state))
      throw new AiInferenceError('provider_rejected', false);
    if (run.deadline.getTime() < Date.now()) {
      await sql`UPDATE ai_runs SET state='expired' WHERE id=${id}::uuid`.execute(tx);
      throw new AiInferenceError('provider_rejected', false);
    }
    await this.allowed(regionId, run.task, run.release_id, tx);
    if (run.actor_id) {
      const actor = found(
        (
          await sql<{
            suspended: boolean;
            role: string;
          }>`SELECT suspended,role FROM users WHERE id=${run.actor_id}::uuid FOR SHARE`.execute(tx)
        ).rows[0],
      );
      const member = (
        await sql`SELECT user_id FROM memberships WHERE user_id=${run.actor_id}::uuid AND region_id=${regionId}::uuid FOR SHARE`.execute(
          tx,
        )
      ).rows.length;
      if (actor.suspended || (actor.role !== 'admin' && !member))
        throw new AiInferenceError('provider_rejected', false);
    }
    if (
      run.report_id &&
      !(
        await sql`SELECT id FROM reports WHERE id=${run.report_id}::uuid AND NOT erased`.execute(tx)
      ).rows.length
    )
      throw new AiInferenceError('provider_rejected', false);
    return run;
  }
  async assertFence(tx: Connection, lease: AiLease) {
    if (
      !(
        await sql`SELECT id FROM outbox_jobs WHERE id=${lease.id}::uuid AND state='processing' AND fence=${lease.fence}::bigint AND lease_owner=${lease.lease_owner} AND lease_until>now() FOR SHARE`.execute(
          tx,
        )
      ).rows.length
    )
      throw new Error('Worker lease lost');
  }
  async sources(run: RunRow, lease: AiLease): Promise<AiEvidence[]> {
    const result: AiEvidence[] = [];
    if (run.report_id || ['clarification', 'public_summary', 'duplicates'].includes(run.task)) {
      const reports = (
        await sql<{
          id: string;
          description: string;
          revision: number;
          state: string;
          landmark_text: string | null;
          observation_time: string | null;
          evidence: string | null;
        }>`SELECT r.id,r.description,r.revision,r.state,r.landmark_text,r.observation_time::text,(SELECT evidence FROM duplicate_candidates d WHERE d.report_id=COALESCE(${run.report_id ?? null}::uuid,r.id) AND d.other_id=r.id LIMIT 1) evidence FROM reports r WHERE region_id=${run.region_id}::uuid AND NOT erased AND (${run.report_id ? sql`id=${run.report_id}::uuid OR (${run.task === 'duplicates'} AND id IN (SELECT other_id FROM duplicate_candidates WHERE report_id=${run.report_id}::uuid))` : sql`true`}) ORDER BY (${run.report_id ? sql`id=${run.report_id}::uuid` : sql`false`}) DESC,created_at DESC LIMIT ${run.report_id ? 6 : 3}`.execute(
          this.db,
        )
      ).rows;
      for (const r of reports) {
        if (sensitiveAiText(r.description + ' ' + (r.landmark_text ?? ''))) {
          if (run.report_id) throw new AiInferenceError('provider_rejected', false);
          continue;
        }
        result.push({
          id: 'report:' + r.id,
          entityId: r.id,
          kind: 'report',
          version: String(r.revision),
          title: 'Laporan ' + r.state,
          text: redactAiText(
            [
              r.description,
              ...(run.task === 'duplicates'
                ? [
                    `Patokan: ${r.landmark_text ?? 'belum diketahui'}.`,
                    `Waktu pengamatan: ${r.observation_time ?? 'belum diketahui'}.`,
                    ...(r.evidence
                      ? [`Bukti kandidat dari perhitungan platform: ${r.evidence}`]
                      : []),
                  ]
                : []),
            ].join('\n'),
          ),
        });
      }
    }
    if (run.task === 'briefing') {
      const counts = (
        await sql<{
          state: string;
          category: string;
          count: number;
        }>`SELECT state,category,count(*)::int count FROM reports WHERE region_id=${run.region_id}::uuid AND NOT erased AND created_at>now()-${run.request.hours}*interval '1 hour' GROUP BY state,category ORDER BY state,category`.execute(
          this.db,
        )
      ).rows;
      const states: Record<string, string> = {
        submitted: 'belum ditinjau',
        under_review: 'sedang ditinjau',
        clarification_requested: 'menunggu klarifikasi',
        reviewed: 'ditinjau koordinator',
        rejected: 'ditolak',
        closed: 'ditutup',
      };
      const categories: Record<string, string> = {
        road_flooding: 'genangan jalan',
        water_entering_homes: 'air masuk rumah',
        blocked_access: 'akses terhambat',
        debris: 'material hanyut',
        damaged_facility: 'fasilitas rusak',
        follow_up_needed: 'perlu tindak lanjut',
        other: 'informasi lain',
      };
      result.push({
        id: 'counts:' + run.id,
        entityId: run.id,
        kind: 'counts',
        version: new Date().toISOString(),
        title: 'Jumlah lengkap dalam ' + run.request.hours + ' jam',
        text: [
          `Rentang penerimaan: ${run.request.hours} jam terakhir.`,
          `Jumlah seluruh laporan: ${counts.reduce((s, r) => s + r.count, 0)}.`,
          ...counts.map(
            (r) =>
              `${categories[r.category] ?? r.category}, ${states[r.state] ?? r.state}: ${r.count} laporan.`,
          ),
          'Petikan berikut mencakup paling banyak 20 laporan; jumlah di atas mencakup seluruh laporan pada rentang ini. Laporan tidak membuktikan keadaan atau keamanan wilayah.',
        ].join('\n'),
      });
      const sample = (
        await sql<{
          id: string;
          description: string;
          revision: number;
          state: string;
        }>`SELECT id,description,revision,state FROM reports WHERE region_id=${run.region_id}::uuid AND NOT erased AND created_at>now()-${run.request.hours}*interval '1 hour' ORDER BY created_at DESC LIMIT 20`.execute(
          this.db,
        )
      ).rows;
      for (const r of sample)
        if (!sensitiveAiText(r.description))
          result.push({
            id: 'report:' + r.id,
            entityId: r.id,
            kind: 'report',
            version: String(r.revision),
            title: 'Sampel ' + r.state,
            text: redactAiText(r.description).slice(0, 800),
          });
    }
    if (run.task === 'coverage' && run.actor_id) {
      const user = await this.identity.authenticateInternal(run.actor_id);
      const coverage = await this.preparedness.coverage(user, run.region_id);
      result.push({
        id: 'coverage:' + run.id,
        entityId: run.id,
        kind: 'coverage',
        version: coverage.generatedAt,
        title: 'Perhitungan cakupan PostGIS',
        text: [
          `Rentang pengamatan: ${coverage.hours} jam.`,
          coverage.method,
          `Jumlah area: ${coverage.cells.length}.`,
          ...coverage.cells.map(
            (c) =>
              `Area ${c.id}: ${c.count} laporan; ${c.state === 'information_available' ? 'informasi tersedia' : 'informasi belum cukup'}.`,
          ),
          'Area tanpa laporan tidak berarti aman. Perhitungan ini tidak memprediksi bahaya atau memastikan keamanan rute.',
        ].join('\n'),
      });
    }
    if (
      ['answer', 'plan_draft', 'training_draft', 'translation'].includes(run.task) ||
      (['clarification', 'public_summary'].includes(run.task) &&
        (Boolean(run.request.question) || !run.report_id))
    ) {
      let vector: number[] | null = null;
      if (
        aiOperationsSettings().AI_EMBEDDING_MODE === 'compatible' &&
        run.request.question &&
        ['answer', 'plan_draft', 'training_draft', 'translation'].includes(run.task)
      )
        vector = await this.queryEmbedding(run, lease);
      let chunks = await this.knowledge.search(
        run.region_id,
        run.request.question ?? 'rencana kesiapsiagaan langkah dokumen warga',
        vector,
      );
      if (chunks.length === 0 && run.task !== 'answer') {
        chunks = await this.knowledge.search(
          run.region_id,
          'rencana kesiapsiagaan langkah dokumen warga posko',
          null,
        );
      }
      const maxChunks = ['clarification', 'public_summary'].includes(run.task) ? 3 : 10;
      for (const chunk of chunks.slice(0, maxChunks))
        result.push({
          id: chunk.kind + ':' + chunk.id,
          entityId: chunk.entityId,
          kind: chunk.kind,
          version: chunk.version,
          title: chunk.title + ' / ' + chunk.section,
          text: chunk.text,
        });
      if (run.task === 'translation' && run.request.question)
        result.push({
          id: 'instruction:' + run.id,
          entityId: run.id,
          kind: 'instruction',
          version: '1',
          title: 'Teks asli untuk terjemahan',
          text: run.request.question,
        });
    }
    let length = 0;
    return result.filter((s) => {
      length += s.text.length;
      return length <= MAX_CONTEXT_CHARACTERS;
    });
  }
  async queryEmbedding(run: RunRow, lease: AiLease): Promise<number[]> {
    const saved = (
      await sql<{
        candidate: number[];
      }>`SELECT candidate FROM ai_attempts WHERE run_id=${run.id}::uuid AND operation='embedding' AND state='succeeded' ORDER BY number DESC LIMIT 1`.execute(
        this.db,
      )
    ).rows[0];
    if (saved) return saved.candidate;
    const ops = aiOperationsSettings();
    const attempt = found(
      (
        await sql<{
          id: string;
        }>`INSERT INTO ai_attempts(run_id,region_id,number,provider,model,state,estimated_tokens,operation) SELECT ${run.id}::uuid,${run.region_id}::uuid,COALESCE(max(number),0)+1,${ops.AI_EMBEDDING_PROVIDER},${ops.AI_EMBEDDING_MODEL},'processing',${run.request.question!.length},'embedding' FROM ai_attempts WHERE run_id=${run.id}::uuid RETURNING id`.execute(
          this.db,
        )
      ).rows[0],
    );
    let tokens: number | null = null;
    try {
      const vector = await embedText(
        run.request.question!,
        (n) => {
          tokens = n;
        },
        'query',
      );
      await this.db.transaction().execute(async (tx) => {
        await this.assertFence(tx, lease);
        await sql`SELECT id FROM ai_runs WHERE id=${run.id}::uuid FOR UPDATE`.execute(tx);
        await this.load(run.id, run.region_id, tx);
        await sql`UPDATE ai_attempts SET state='succeeded',candidate=${JSON.stringify(vector)}::jsonb,usage=${tokens === null ? null : JSON.stringify({ prompt_tokens: tokens, completion_tokens: 0 })}::jsonb WHERE id=${attempt.id}::uuid`.execute(
          tx,
        );
      });
      return vector;
    } catch (error) {
      await sql`UPDATE ai_attempts SET state='failed',error=${error instanceof AiInferenceError ? error.code : 'provider_rejected'} WHERE id=${attempt.id}::uuid`.execute(
        this.db,
      );
      throw error;
    } finally {
      await this.reconcile(run.id);
    }
  }
  async process(lease: AiLease) {
    const id = lease.entity_id!;
    const regionId = lease.region_id!;
    const already = (await sql`SELECT id FROM ai_outputs WHERE run_id=${id}::uuid`.execute(this.db))
      .rows.length;
    if (already) return;
    const run = await this.load(id, regionId);
    const provider = String(run.manifest['provider']);
    const breaker = (
      await sql<{
        count: number;
        latest: Date | null;
      }>`SELECT count(*)::int count,max(created_at) latest FROM ai_attempts WHERE provider=${provider} AND state='failed' AND error='provider_unavailable' AND created_at>now()-interval '1 minute'`.execute(
        this.db,
      )
    ).rows[0]!;
    if (breaker.count >= 5) throw new AiInferenceError('provider_unavailable', true, 60000);
    if (!this.saver) {
      this.saver = PostgresSaver.fromConnString(process.env['DATABASE_URL']!, {
        schema: 'ai_checkpoints',
      });
      this.setup =
        process.env['APP_MODE'] === 'production' ? Promise.resolve() : this.saver.setup();
    }
    await this.setup;
    // Only opaque IDs/stages enter graph checkpoints. Source text and candidates stay in scoped domain tables.
    const graph = new StateGraph(State)
      .addNode('prepare', async () => {
        const current = await this.load(id, regionId);
        const cached = (
          await sql<{
            snapshot: AiEvidence;
          }>`SELECT snapshot FROM ai_output_sources WHERE run_id=${id}::uuid ORDER BY source_id`.execute(
            this.db,
          )
        ).rows;
        const sources = cached.length
          ? cached.map((r) => r.snapshot)
          : await this.sources(current, lease);
        await this.db.transaction().execute(async (tx) => {
          // Match erasure lock order: sources, run, then outbox fence.
          await this.fresh(tx, sources, regionId);
          await sql`SELECT id FROM ai_runs WHERE id=${id}::uuid FOR UPDATE`.execute(tx);
          await this.assertFence(tx, lease);
          const state = (
            await sql<{ state: string }>`SELECT state FROM ai_runs WHERE id=${id}::uuid`.execute(tx)
          ).rows[0]?.state;
          if (!state || ['cancelled', 'expired', 'unavailable'].includes(state))
            throw new AiInferenceError('provider_rejected', false);
          await sql`UPDATE ai_runs SET state='processing',updated_at=now() WHERE id=${id}::uuid AND state IN ('queued','processing','failed')`.execute(
            tx,
          );
          for (const s of sources)
            await sql`INSERT INTO ai_output_sources(run_id,region_id,source_id,entity_id,kind,version,snapshot) VALUES(${id}::uuid,${regionId}::uuid,${s.id},${s.entityId}::uuid,${s.kind},${s.version},${JSON.stringify(s)}::jsonb) ON CONFLICT DO NOTHING`.execute(
              tx,
            );
        });
        return { stage: 'prepared' };
      })
      .addNode('generate', async () => {
        const saved = (
          await sql`SELECT id FROM ai_attempts WHERE run_id=${id}::uuid AND operation='generation' AND state='succeeded'`.execute(
            this.db,
          )
        ).rows.length;
        if (saved) return { stage: 'generated' };
        await this.load(id, regionId);
        const sources = (
          await scopedAi(this.db, regionId, (tx) =>
            sql<{
              snapshot: AiEvidence;
            }>`SELECT snapshot FROM ai_output_sources WHERE run_id=${id}::uuid ORDER BY source_id`.execute(
              tx,
            ),
          )
        ).rows.map((r) => r.snapshot);
        const attempts = (
          await sql<{
            count: number;
          }>`SELECT count(*)::int count FROM ai_attempts WHERE run_id=${id}::uuid`.execute(this.db)
        ).rows[0]!.count;
        const generationAttempts = (
          await sql<{
            count: number;
          }>`SELECT count(*)::int count FROM ai_attempts WHERE run_id=${id}::uuid AND operation='generation'`.execute(
            this.db,
          )
        ).rows[0]!.count;
        if (generationAttempts >= 3) throw new AiInferenceError('provider_rejected', false);
        const started = Date.now();
        const model = String(run.manifest['model']);
        const attempt = (
          await sql<{
            id: string;
          }>`INSERT INTO ai_attempts(run_id,region_id,number,provider,model,state,estimated_tokens) VALUES(${id}::uuid,${regionId}::uuid,${attempts + 1},${provider},${model},'processing',${sources.reduce((s, c) => s + c.text.length, 0) + Number(run.manifest['maxOutputTokens'])}) RETURNING id`.execute(
            this.db,
          )
        ).rows[0]!;
        try {
          const result = await generateAssistance(
            run.task,
            run.request.question ?? '',
            run.request.language,
            sources,
            model,
            Number(run.manifest['maxOutputTokens']),
          );
          await this.db.transaction().execute(async (tx) => {
            await this.fresh(tx, sources, regionId);
            const state = (
              await sql<{
                state: string;
              }>`SELECT state FROM ai_runs WHERE id=${id}::uuid FOR UPDATE`.execute(tx)
            ).rows[0]?.state;
            await this.assertFence(tx, lease);
            if (!state || ['cancelled', 'expired', 'unavailable'].includes(state))
              throw new AiInferenceError('provider_rejected', false);
            await this.load(id, regionId, tx);
            await sql`UPDATE ai_attempts SET state='succeeded',candidate=${JSON.stringify(result.output)}::jsonb,usage=${result.usage ? JSON.stringify(result.usage) : null}::jsonb,duration_ms=${Date.now() - started} WHERE id=${attempt.id}::uuid`.execute(
              tx,
            );
          });
        } catch (error) {
          const failure =
            error instanceof AiInferenceError
              ? error
              : new AiInferenceError('invalid_output', false);
          await sql`UPDATE ai_attempts SET state='failed',error=${failure.code},duration_ms=${Date.now() - started} WHERE id=${attempt.id}::uuid`.execute(
            this.db,
          );
          throw failure;
        }
        return { stage: 'generated' };
      })
      .addNode('validate', async () => {
        await this.db.transaction().execute(async (tx) => {
          const sources = (
            await sql<{
              snapshot: AiEvidence;
            }>`SELECT snapshot FROM ai_output_sources WHERE run_id=${id}::uuid`.execute(tx)
          ).rows.map((r) => r.snapshot);
          await this.fresh(tx, sources, regionId);
          await sql`SELECT id FROM ai_runs WHERE id=${id}::uuid FOR UPDATE`.execute(tx);
          await this.assertFence(tx, lease);
          await this.load(id, regionId, tx);
          const attempt = found(
            (
              await sql<{
                candidate: unknown;
              }>`SELECT candidate FROM ai_attempts WHERE run_id=${id}::uuid AND operation='generation' AND state='succeeded' ORDER BY number DESC LIMIT 1`.execute(
                tx,
              )
            ).rows[0],
          );
          const output = validateAssistance(attempt.candidate, sources, run.task);
          const provenance = {
            ...run.manifest,
            releaseId: run.release_id,
            generatedAt: new Date().toISOString(),
            sampled: run.task === 'briefing',
            sourceCount: sources.length,
            workflowVersion: WORKFLOW_VERSION,
            visibility: 'private_draft',
          };
          await sql`INSERT INTO ai_outputs(run_id,region_id,output,provenance) VALUES(${id}::uuid,${regionId}::uuid,${JSON.stringify(output)}::jsonb,${JSON.stringify(provenance)}::jsonb) ON CONFLICT(run_id) DO NOTHING`.execute(
            tx,
          );
          await sql`UPDATE ai_runs SET state='ready',error=NULL,updated_at=now() WHERE id=${id}::uuid`.execute(
            tx,
          );
          await audit(tx, run.actor_id, regionId, 'ai.ready', id, { task: run.task });
        });
        return { stage: 'ready' };
      })
      .addEdge(START, 'prepare')
      .addEdge('prepare', 'generate')
      .addEdge('generate', 'validate')
      .addEdge('validate', END)
      .compile({ checkpointer: this.saver });
    try {
      await graph.invoke(
        { runId: id, regionId, stage: 'queued' },
        { configurable: { thread_id: id }, recursionLimit: 8, callbacks: [] },
      );
      await this.reconcile(id);
    } catch (error) {
      await sql`UPDATE ai_runs SET state='failed',error=${error instanceof AiInferenceError ? error.code : 'workflow_unavailable'},updated_at=now() WHERE id=${id}::uuid AND state NOT IN ('cancelled','expired','ready')`.execute(
        this.db,
      );
      throw error;
    }
  }
  async fresh(tx: Connection, sources: AiEvidence[], regionId: string) {
    for (const source of sources) {
      if (
        source.kind === 'report' &&
        !(
          await sql`SELECT id FROM reports WHERE id=${source.entityId}::uuid AND region_id=${regionId}::uuid AND NOT erased AND revision::text=${source.version} FOR SHARE`.execute(
            tx,
          )
        ).rows.length
      )
        throw new ConflictException('Laporan sumber berubah atau dihapus.');
      if (
        source.kind === 'plan' &&
        !(
          await sql`SELECT id FROM plan_versions WHERE id=${source.entityId}::uuid AND region_id=${regionId}::uuid AND state='published' AND version::text=${source.version} AND (content->>'expiresAt')::timestamptz>now() FOR SHARE`.execute(
            tx,
          )
        ).rows.length
      )
        throw new ConflictException('Rencana sumber tidak lagi berlaku.');
      if (
        source.kind === 'reference' &&
        !(
          await sql`SELECT id FROM knowledge_references WHERE id=${source.entityId}::uuid AND region_id=${regionId}::uuid AND state='approved' AND version::text=${source.version} AND expires_at>now() FOR SHARE`.execute(
            tx,
          )
        ).rows.length
      )
        throw new ConflictException('Referensi tidak lagi berlaku.');
    }
  }
  async list(user: User, regionId: string) {
    await this.identity.scope(user, regionId);
    const ids = (
      await scopedAi(this.db, regionId, (tx) =>
        sql<{
          id: string;
        }>`SELECT id FROM ai_runs WHERE task NOT IN ('knowledge_index','triage') ORDER BY created_at DESC LIMIT 50`.execute(
          tx,
        ),
      )
    ).rows;
    return Promise.all(ids.map((r) => this.detail(user, regionId, r.id)));
  }
  async detail(user: User, regionId: string, id: string): Promise<AiRun> {
    await this.identity.scope(user, regionId);
    parse(z.uuid(), id);
    const result = await scopedAi(this.db, regionId, async (tx) => {
      const run = found(
        (
          await sql<AiRun>`SELECT id,region_id AS "regionId",task,state,created_at::text AS "createdAt",error,release_id AS "releaseId" FROM ai_runs WHERE id=${id}::uuid`.execute(
            tx,
          )
        ).rows[0],
      );
      const output = (
        await sql<{
          output: AiRun['output'];
          provenance: AiRun['provenance'];
        }>`SELECT output,provenance FROM ai_outputs WHERE run_id=${id}::uuid`.execute(tx)
      ).rows[0];
      const sources = (
        await sql<{
          snapshot: AiEvidence;
        }>`SELECT snapshot FROM ai_output_sources WHERE run_id=${id}::uuid ORDER BY source_id`.execute(
          tx,
        )
      ).rows.map((r) => r.snapshot);
      const reviews = (
        await sql<
          AiRun['reviews'][number]
        >`SELECT id,action,note,reviewer_id AS "reviewerId",created_at::text AS "createdAt",output FROM ai_reviews WHERE run_id=${id}::uuid ORDER BY created_at DESC,id DESC`.execute(
          tx,
        )
      ).rows;
      return {
        ...run,
        output: output?.output ?? null,
        provenance: output?.provenance ?? {},
        sources,
        reviews,
      };
    });
    try {
      await this.fresh(this.db, result.sources, regionId);
    } catch {
      return {
        ...result,
        state: 'unavailable',
        output: null,
        sources: [],
        reviews: [],
        error: 'source_changed_or_withdrawn',
      };
    }
    return result;
  }
  async review(user: User, regionId: string, id: string, input: unknown) {
    const detail = await this.detail(user, regionId, id);
    const data = parse(aiReviewSchema, input);
    if (detail.state !== 'ready' || !detail.output)
      throw new ConflictException('Hasil belum tersedia atau sumber berubah.');
    if (data.action === 'edited' && !data.output)
      throw new BadRequestException('Isi koreksi diperlukan.');
    if (
      detail.task === 'translation' &&
      data.action !== 'rejected' &&
      process.env['APP_MODE'] === 'production'
    ) {
      const request = (
        await sql<{
          request: { language: string };
        }>`SELECT request FROM ai_runs WHERE id=${id}::uuid`.execute(this.db)
      ).rows[0]!;
      if (
        !(
          await sql`SELECT user_id FROM translation_reviewers WHERE user_id=${user.id}::uuid AND language=${request.request.language}`.execute(
            this.db,
          )
        ).rows.length
      )
        throw new BadRequestException('Peninjau bahasa yang memenuhi kualifikasi diperlukan.');
    }
    if (data.output) validateAssistance(data.output, detail.sources, detail.task);
    await this.db.transaction().execute(async (tx) => {
      await this.fresh(tx, detail.sources, regionId);
      await sql`SELECT id FROM ai_runs WHERE id=${id}::uuid FOR UPDATE`.execute(tx);
      const state = (
        await sql<{ state: string }>`SELECT state FROM ai_runs WHERE id=${id}::uuid`.execute(tx)
      ).rows[0]?.state;
      if (state !== 'ready') throw new ConflictException('Status hasil berubah.');
      const actor = found(
        (
          await sql<{
            role: string;
            suspended: boolean;
          }>`SELECT role,suspended FROM users WHERE id=${user.id}::uuid FOR SHARE`.execute(tx)
        ).rows[0],
      );
      const member = (
        await sql`SELECT user_id FROM memberships WHERE user_id=${user.id}::uuid AND region_id=${regionId}::uuid FOR SHARE`.execute(
          tx,
        )
      ).rows.length;
      if (actor.suspended || (actor.role !== 'admin' && !member))
        throw new ConflictException('Akses peninjau berubah.');
      const previous = (
        await sql<{
          id: string;
        }>`SELECT id FROM ai_reviews WHERE run_id=${id}::uuid ORDER BY created_at DESC,id DESC LIMIT 1`.execute(
          tx,
        )
      ).rows[0];
      await sql`INSERT INTO ai_reviews(run_id,region_id,reviewer_id,action,note,output,previous_id) VALUES(${id}::uuid,${regionId}::uuid,${user.id}::uuid,${data.action},${data.note},${data.output ? JSON.stringify(data.output) : null}::jsonb,${previous?.id ?? null}::uuid)`.execute(
        tx,
      );
      await audit(tx, user.id, regionId, 'ai.review', id, { action: data.action });
    });
    return { ok: true };
  }
  async cancel(user: User, regionId: string, id: string) {
    await this.identity.scope(user, regionId);
    parse(z.uuid(), id);
    await sql`UPDATE ai_runs SET state='cancelled',updated_at=now() WHERE id=${id}::uuid AND region_id=${regionId}::uuid AND state IN ('queued','processing','failed')`.execute(
      this.db,
    );
    await audit(this.db, user.id, regionId, 'ai.cancelled', id);
    return { ok: true };
  }
  async operations(user: User) {
    this.identity.requireAdmin(user);
    const s = readAiSettings(process.env);
    const ops = aiOperationsSettings();
    return {
      mode: s.AI_MODE,
      embeddingMode: ops.AI_EMBEDDING_MODE,
      provider: s.AI_PROVIDER,
      model: s.AI_MODEL,
      controls: (
        await sql`SELECT scope,scope_id AS "scopeId",enabled,reason FROM ai_controls ORDER BY scope,scope_id`.execute(
          this.db,
        )
      ).rows,
      runs: (
        await sql`SELECT task,state,count(*)::int count FROM ai_runs GROUP BY task,state ORDER BY task,state`.execute(
          this.db,
        )
      ).rows,
      budgets: (
        await sql`SELECT organization_id AS "organizationId",day::text AS "day",sum(reserved)::float8 reserved,${ops.AI_ORG_DAILY_BUDGET_MICRO_USD}::float8 "limit" FROM ai_budget_ledger WHERE day>=current_date-7 GROUP BY organization_id,day ORDER BY day DESC`.execute(
          this.db,
        )
      ).rows,
      releases: (
        await sql`SELECT m.id,m.manifest,m.created_at::text AS "createdAt",EXISTS(SELECT 1 FROM ai_release_approvals a JOIN users u ON u.id=a.actor_id JOIN ai_evaluations e ON e.release_id=a.release_id AND e.artifact_hash=a.evaluation_hash WHERE a.release_id=m.id AND NOT u.suspended AND (${process.env['APP_MODE'] !== 'production'} OR EXISTS(SELECT 1 FROM ai_admin_roles role WHERE role.user_id=u.id AND role.role='approver')) GROUP BY a.evaluation_hash HAVING count(DISTINCT a.actor_id)>=2) approved FROM ai_model_releases m ORDER BY created_at DESC LIMIT 20`.execute(
          this.db,
        )
      ).rows,
      attempts: (
        await sql`SELECT provider,state,count(*)::int count,COALESCE(sum(estimated_tokens),0)::float8 AS "estimatedTokens" FROM ai_attempts WHERE created_at>now()-interval '24 hours' GROUP BY provider,state`.execute(
          this.db,
        )
      ).rows,
    };
  }
  async requireOperator(user: User, role: 'operator' | 'approver') {
    this.identity.requireAdmin(user);
    if (
      process.env['APP_MODE'] === 'production' &&
      !(
        await sql`SELECT user_id FROM ai_admin_roles WHERE user_id=${user.id}::uuid AND role=${role}`.execute(
          this.db,
        )
      ).rows.length
    )
      throw new BadRequestException('Peran AI ' + role + ' diperlukan.');
  }
  async control(user: User, input: unknown) {
    await this.requireOperator(user, 'operator');
    const data = parse(
      z.strictObject({
        scope: z.enum(['global', 'provider', 'task', 'organization', 'release']),
        scopeId: z.string().min(1).max(200),
        enabled: z.boolean(),
        reason: z.string().min(5).max(1000),
      }),
      input,
    );
    await this.db.transaction().execute(async (tx) => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended('ai-policy',0))`.execute(tx);
      await sql`INSERT INTO ai_controls(scope,scope_id,enabled,reason) VALUES(${data.scope},${data.scopeId},${data.enabled},${data.reason}) ON CONFLICT(scope,scope_id) DO UPDATE SET enabled=excluded.enabled,reason=excluded.reason,updated_at=now()`.execute(
        tx,
      );
      await audit(tx, user.id, null, 'ai.control', null, data);
    });
    return { ok: true };
  }
  async approveRelease(user: User, id: string, input: unknown) {
    await this.requireOperator(user, 'approver');
    parse(z.uuid(), id);
    const data = parse(
      z.strictObject({
        evaluationHash: z.string().regex(/^[a-f0-9]{64}$/),
        note: z.string().min(10).max(1000),
      }),
      input,
    );
    if (
      !(
        await sql`SELECT id FROM ai_evaluations WHERE release_id=${id}::uuid AND artifact_hash=${data.evaluationHash}`.execute(
          this.db,
        )
      ).rows.length
    )
      throw new ConflictException('Laporan evaluasi lengkap belum didaftarkan untuk rilis ini.');
    await sql`INSERT INTO ai_release_approvals(release_id,actor_id,evaluation_hash,note) VALUES(${id}::uuid,${user.id}::uuid,${data.evaluationHash},${data.note}) ON CONFLICT DO NOTHING`.execute(
      this.db,
    );
    await audit(this.db, user.id, null, 'ai.release.approved', id, {
      evaluationHash: data.evaluationHash,
    });
    return { ok: true };
  }
  async approvalCount(id: string, tx: Connection = this.db) {
    return (
      await sql<{
        count: number;
      }>`SELECT COALESCE(max(n),0)::int count FROM (SELECT count(DISTINCT a.actor_id) n FROM ai_release_approvals a JOIN users u ON u.id=a.actor_id JOIN ai_evaluations e ON e.release_id=a.release_id AND e.artifact_hash=a.evaluation_hash WHERE a.release_id=${id}::uuid AND NOT u.suspended AND (${process.env['APP_MODE'] !== 'production'} OR EXISTS(SELECT 1 FROM ai_admin_roles role WHERE role.user_id=u.id AND role.role='approver')) GROUP BY a.evaluation_hash) approved`.execute(
        tx,
      )
    ).rows[0]!.count;
  }
  async activateRelease(user: User, id: string) {
    await this.requireOperator(user, 'operator');
    parse(z.uuid(), id);
    if ((await this.approvalCount(id)) < 2)
      throw new ConflictException('Dua persetujuan diperlukan.');
    const release = found(
      (
        await sql<{
          manifest: Record<string, unknown>;
        }>`SELECT manifest FROM ai_model_releases WHERE id=${id}::uuid`.execute(this.db)
      ).rows[0],
    );
    const group = String(release.manifest['promptVersion']).startsWith('triage-')
      ? 'triage'
      : 'assistance';
    const expectedPrompt = group === 'triage' ? PROMPT_VERSION : WORKFLOW_VERSION;
    const settings = readAiSettings(process.env);
    if (
      release.manifest['provider'] !== settings.AI_PROVIDER ||
      release.manifest['endpoint'] !== settings.AI_BASE_URL ||
      release.manifest['pricing'] !==
        hash(
          JSON.stringify([
            aiOperationsSettings().AI_INPUT_MICRO_USD_PER_MILLION_TOKENS,
            aiOperationsSettings().AI_OUTPUT_MICRO_USD_PER_MILLION_TOKENS,
            aiOperationsSettings().AI_EMBEDDING_MICRO_USD_PER_MILLION_TOKENS,
          ]),
        ) ||
      release.manifest['mode'] !== settings.AI_MODE ||
      release.manifest['embeddingRelease'] !== embeddingRelease() ||
      release.manifest['promptVersion'] !== expectedPrompt
    )
      throw new ConflictException('Rilis tidak sesuai provider atau alur yang terpasang.');
    await sql`INSERT INTO app_metadata(key,value) VALUES(${'ai-active-release:' + group},${JSON.stringify({ id })}::jsonb) ON CONFLICT(key) DO UPDATE SET value=excluded.value`.execute(
      this.db,
    );
    await audit(this.db, user.id, null, 'ai.release.activated', id);
    return { ok: true };
  }
  async registerEvaluation(user: User, id: string, input: unknown) {
    await this.requireOperator(user, 'operator');
    parse(z.uuid(), id);
    const report = parse(aiEvaluationSchema, input);
    const release = found(
      (
        await sql<{
          fingerprint: string;
        }>`SELECT fingerprint FROM ai_model_releases WHERE id=${id}::uuid`.execute(this.db)
      ).rows[0],
    );
    if (release.fingerprint !== report.modelFingerprint)
      throw new ConflictException('Evaluasi berasal dari manifest rilis berbeda.');
    const result = (
      await sql<{
        id: string;
      }>`INSERT INTO ai_evaluations(release_id,artifact_hash,report,actor_id) VALUES(${id}::uuid,${report.artifactHash},${JSON.stringify(report)}::jsonb,${user.id}::uuid) ON CONFLICT DO NOTHING RETURNING id`.execute(
        this.db,
      )
    ).rows[0];
    await audit(this.db, user.id, null, 'ai.evaluation.registered', id, {
      artifactHash: report.artifactHash,
      datasetHash: report.datasetHash,
    });
    return { id: result?.id ?? id };
  }
}
