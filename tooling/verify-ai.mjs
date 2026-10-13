import 'reflect-metadata';
import { createAiAdapter } from '../packages/backend/dist/index.js';
import { readAiEmbeddingSettings } from '../packages/backend/dist/config/ai-embedding.js';
import { aiOperationsSettings } from '../packages/backend/dist/config/ai-operations.js';
import { readAiSettings } from '../packages/backend/dist/config/ai.js';
import { embedText } from '../packages/backend/dist/modules/ai-embeddings.js';

// Explicit operator command: one synthetic chat call and, when enabled, two embedding calls.
try {
  if (
    ['LANGSMITH_TRACING', 'LANGCHAIN_TRACING_V2'].some((key) =>
      ['true', '1'].includes(process.env[key] ?? ''),
    )
  )
    throw new Error('External model content tracing is prohibited.');
  if (process.env.AI_MODE !== 'compatible')
    throw new Error('Set AI_MODE=compatible and replace AI_MODEL/AI_API_KEY before verification.');
  const embedding = readAiEmbeddingSettings(process.env);
  const settings = readAiSettings(process.env);
  const prices = aiOperationsSettings();
  const worst = Math.ceil(
    (12000 * prices.AI_INPUT_MICRO_USD_PER_MILLION_TOKENS +
      settings.AI_MAX_OUTPUT_TOKENS * prices.AI_OUTPUT_MICRO_USD_PER_MILLION_TOKENS +
      (embedding.AI_EMBEDDING_MODE === 'compatible'
        ? 512 * prices.AI_EMBEDDING_MICRO_USD_PER_MILLION_TOKENS
        : 0)) /
      1000000,
  );
  if (worst > prices.AI_RUN_MAX_MICRO_USD)
    throw new Error('Synthetic verification exceeds the per-run funding cap.');
  const adapter = createAiAdapter();
  if (!adapter) throw new Error('Model inference is disabled.');
  const started = Date.now();
  const output = await adapter.suggest({
    id: '40000000-0000-4000-8000-000000000099',
    description:
      'SIMULASI PENGUJIAN: terlihat genangan di jalan dekat balai latihan. Bukan kejadian nyata.',
    landmarkText: 'Balai latihan',
    observationTime: null,
  });
  let embeddings = null;
  if (embedding.AI_EMBEDDING_MODE === 'compatible') {
    const document = await embedText(
      'SIMULASI: siapkan dokumen penting dalam tas latihan.',
      undefined,
      'document',
    );
    const query = await embedText('Dokumen apa yang disiapkan dalam latihan?', undefined, 'query');
    embeddings = {
      valid: true,
      provider: embedding.AI_EMBEDDING_PROVIDER,
      model: embedding.AI_EMBEDDING_MODEL,
      dimensions: document.length,
      queryDimensions: query.length,
    };
  }
  console.info(
    JSON.stringify({
      valid: true,
      provider: adapter.provider,
      model: adapter.model,
      needsHumanReview: output.needsHumanReview,
      embeddings,
      durationMs: Date.now() - started,
    }),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : 'AI verification failed.');
  process.exitCode = 1;
}
