import 'reflect-metadata';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createAiAdapter } from '../packages/backend/dist/index.js';
import { generateAssistance } from '../packages/backend/dist/modules/ai-gateway.js';
import { readAiSettings } from '../packages/backend/dist/config/ai.js';
import { aiOperationsSettings } from '../packages/backend/dist/config/ai-operations.js';
import {
  embeddingRelease,
  embedText,
  KnowledgeService,
} from '../packages/backend/dist/modules/knowledge.js';
import { createDatabase } from '../packages/database/dist/client.js';
import { PROMPT_VERSION } from '../packages/backend/dist/modules/adapters.js';
import {
  WORKFLOW_VERSION,
  MAX_CONTEXT_CHARACTERS,
  sensitiveAiText,
  redactAiText,
} from '../packages/backend/dist/modules/ai-policy.js';
import { aiEvidenceSchema, aiTaskSchema } from '../packages/contracts/dist/index.js';
const require = createRequire(new URL('../packages/backend/package.json', import.meta.url));
const { z } = require('zod');
const digest = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex');
if (
  ['LANGSMITH_TRACING', 'LANGCHAIN_TRACING_V2'].some((key) =>
    ['true', '1'].includes(process.env[key] ?? ''),
  )
)
  throw new Error('External model content tracing is prohibited.');
if (
  process.env.AI_EVALUATION_ALLOW_PAID !== 'true' ||
  process.env.AI_EVALUATION_APPROVED_DATA !== 'true'
)
  throw new Error('Protected evaluation requires explicit paid-call and reviewed-data flags.');
const inputPath = process.argv[2],
  outputPath = process.argv[3];
if (!inputPath || !outputPath)
  throw new Error('Provide reviewed JSONL dataset and private output path.');
const settings = readAiSettings(process.env);
if (settings.AI_MODE !== 'compatible')
  throw new Error('Real-provider evaluation requires configured inference.');
const raw = await readFile(inputPath, 'utf8');
const caseSchema = z.strictObject({
  id: z.string().min(1).max(100),
  task: aiTaskSchema,
  adversarial: z.boolean(),
  sourceFamily: z.string().min(1),
  reviewedBy: z.array(z.string().min(3)).min(1),
  approvedForExternalProcessing: z.literal(true),
  input: z
    .object({
      id: z.uuid(),
      description: z.string().max(2000),
      landmarkText: z.string().nullable(),
      observationTime: z.string().nullable(),
    })
    .optional(),
  sources: z.array(aiEvidenceSchema).max(30).default([]),
  question: z.string().max(1500).default(''),
  language: z.enum(['id', 'jv', 'su']).default('id'),
  expectedCategory: z.string().nullable().optional(),
  expectedAbstention: z.boolean().optional(),
  expectedRetrievedSourceIds: z.array(z.string()).optional(),
  retrieval: z.object({ regionId: z.uuid(), query: z.string().min(2).max(1500) }).optional(),
});
const cases = raw
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => caseSchema.parse(JSON.parse(line)));
if (
  cases.length < 1000 ||
  cases.length > 2000 ||
  cases.filter((c) => c.adversarial).length < 200 ||
  new Set(cases.map((c) => c.id)).size !== cases.length
)
  throw new Error(
    'Requires 1000–2000 unique reviewed cases, including at least 200 held-out adversarial cases.',
  );
for (const c of cases) {
  const text = [
    c.input?.description ?? '',
    c.input?.landmarkText ?? '',
    ...c.sources.map((s) => s.text),
    c.question,
  ].join('\n');
  if (sensitiveAiText(text) || redactAiText(text) !== text || text.length > MAX_CONTEXT_CHARACTERS)
    throw new Error('Evaluation input exceeds privacy or context policy.');
  if (c.task === 'triage' && !c.input) throw new Error('Triage case input missing.');
  if (c.expectedRetrievedSourceIds?.length && !c.retrieval)
    throw new Error('Retrieval benchmark requires an actual staging corpus query.');
}
const prices = aiOperationsSettings();
const reserve =
  Math.ceil(
    cases.reduce(
      (total, c) =>
        total +
        (c.retrieval
          ? 6 * (MAX_CONTEXT_CHARACTERS + 21500) + 12000
          : Buffer.byteLength(
              JSON.stringify(
                c.task === 'triage'
                  ? c.input
                  : {
                      task: c.task,
                      language: c.language,
                      question: c.question,
                      sources: c.sources,
                    },
              ),
              'utf8',
            ) + 12000) *
          prices.AI_INPUT_MICRO_USD_PER_MILLION_TOKENS +
        settings.AI_MAX_OUTPUT_TOKENS * prices.AI_OUTPUT_MICRO_USD_PER_MILLION_TOKENS,
      0,
    ) / 1000000,
  ) +
  (prices.AI_EMBEDDING_MODE === 'compatible'
    ? Math.ceil(
        (cases.filter((c) => c.retrieval).length *
          9000 *
          prices.AI_EMBEDDING_MICRO_USD_PER_MILLION_TOKENS) /
          1000000,
      )
    : 0);
const cap = Number(process.env.AI_EVALUATION_MAX_MICRO_USD ?? 0);
if (!Number.isSafeInteger(cap) || cap <= 0 || reserve > cap)
  throw new Error('Evaluation conservative reservation exceeds the explicit evaluation cap.');
const manifest = {
  provider: settings.AI_PROVIDER,
  endpoint: settings.AI_BASE_URL,
  pricing: digest([
    prices.AI_INPUT_MICRO_USD_PER_MILLION_TOKENS,
    prices.AI_OUTPUT_MICRO_USD_PER_MILLION_TOKENS,
    prices.AI_EMBEDDING_MICRO_USD_PER_MILLION_TOKENS,
  ]),
  model: settings.AI_MODEL,
  mode: settings.AI_MODE,
  promptVersion: PROMPT_VERSION,
  schemaVersion: '1',
  retrievalVersion: 'rrf-exact-1',
  embeddingRelease: embeddingRelease(),
  maxOutputTokens: settings.AI_MAX_OUTPUT_TOKENS,
};
const manifests = {
  triage: { ...manifest, promptVersion: PROMPT_VERSION },
  assistance: { ...manifest, promptVersion: WORKFLOW_VERSION },
};
const results = [];
const corpus = cases.some((c) => c.retrieval) ? createDatabase(process.env.DATABASE_URL) : null;
const knowledge = corpus ? new KnowledgeService({ db: corpus.db }, null) : null;
try {
  for (const c of cases) {
    const started = Date.now();
    let output = null,
      error = null;
    let sources = c.sources,
      actualRetrievedSourceIds = [];
    try {
      if (c.retrieval) {
        const scope = await corpus.db
          .selectFrom('regions')
          .select(['simulation', 'suspended'])
          .where('id', '=', c.retrieval.regionId)
          .executeTakeFirst();
        if (!scope || scope.simulation || scope.suspended)
          throw new Error('Active isolated staging corpus required.');
        const vector =
          prices.AI_EMBEDDING_MODE === 'compatible' ? await embedText(c.retrieval.query) : null;
        const retrieved = await knowledge.search(c.retrieval.regionId, c.retrieval.query, vector);
        actualRetrievedSourceIds = retrieved.map((s) => s.kind + ':' + s.id);
        sources = retrieved.map((s) => ({
          id: s.kind + ':' + s.id,
          entityId: s.entityId,
          kind: s.kind,
          version: s.version,
          title: s.title + ' / ' + s.section,
          text: s.text,
        }));
        if (sources.reduce((sum, s) => sum + s.text.length, 0) > MAX_CONTEXT_CHARACTERS)
          throw new Error('Corpus context exceeds policy.');
      }
      if (c.task === 'triage') output = await createAiAdapter().suggest(c.input);
      else
        output = (
          await generateAssistance(c.task, c.question, c.language, sources, settings.AI_MODEL)
        ).output;
    } catch {
      error = 'inference_or_validation_failed';
    }
    results.push({
      caseId: c.id,
      task: c.task,
      output,
      outputHash: digest(output),
      durationMs: Date.now() - started,
      error,
      actualRetrievedSourceIds,
      sourceSnapshotHash: digest(sources),
    });
    await new Promise((resolve) =>
      setTimeout(resolve, Number(process.env.AI_EVALUATION_INTERVAL_MS ?? 1000)),
    );
  }
} finally {
  await corpus?.db.destroy();
}
const artifact = {
  schemaVersion: '1',
  datasetHash: digest(raw),
  manifests,
  modelFingerprints: { triage: digest(manifests.triage), assistance: digest(manifests.assistance) },
  completedAt: new Date().toISOString(),
  conservativeReservationMicroUsd: reserve,
  results,
};
await writeFile(outputPath, JSON.stringify(artifact, null, 2), { mode: 0o600, flag: 'wx' });
console.info(
  JSON.stringify({
    caseCount: cases.length,
    validOutputs: results.filter((r) => r.output).length,
    artifactHash: digest(artifact),
    humanReviewRequired: true,
  }),
);
