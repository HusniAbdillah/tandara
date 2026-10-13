import { z } from 'zod';
import { aiEmbeddingEnvironmentShape, readAiEmbeddingSettings } from './ai-embedding.js';

export const aiOperationsShape = {
  AI_DAILY_BUDGET_MICRO_USD: z.coerce.number().int().min(0).max(1000000000).default(5000000),
  AI_MONTHLY_BUDGET_MICRO_USD: z.coerce.number().int().min(0).max(10000000000).default(100000000),
  AI_ORG_DAILY_BUDGET_MICRO_USD: z.coerce.number().int().min(0).max(1000000000).default(1000000),
  AI_RUN_MAX_MICRO_USD: z.coerce.number().int().min(1).max(10000000).default(1500000),
  AI_INPUT_MICRO_USD_PER_MILLION_TOKENS: z.coerce
    .number()
    .int()
    .min(1)
    .max(1000000000)
    .default(1000000),
  AI_OUTPUT_MICRO_USD_PER_MILLION_TOKENS: z.coerce
    .number()
    .int()
    .min(1)
    .max(1000000000)
    .default(3000000),
  AI_MAX_PENDING_PER_REGION: z.coerce.number().int().min(1).max(10000).default(100),
  AI_MAX_CONCURRENT: z.coerce.number().int().min(1).max(100).default(4),
  ...aiEmbeddingEnvironmentShape,
  AI_EMBEDDING_MICRO_USD_PER_MILLION_TOKENS: z.coerce.number().int().min(1).default(10000000),
};
const schema = z.object(aiOperationsShape);
export function aiOperationsSettings() {
  const result = schema.safeParse(process.env);
  if (!result.success)
    throw new Error(
      'Invalid AI operations configuration: ' +
        result.error.issues.map((i) => i.path.join('.')).join(', '),
    );
  const settings = result.data;
  return { ...settings, ...readAiEmbeddingSettings(process.env) };
}
