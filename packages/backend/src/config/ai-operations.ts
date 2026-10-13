import { z } from 'zod';
import { readAiSettings } from './ai.js';

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
  AI_EMBEDDING_MODE: z.enum(['disabled', 'compatible']).default('disabled'),
  AI_EMBEDDING_PROVIDER: z.enum(['vikey', 'deepseek', 'custom']).default('vikey'),
  AI_EMBEDDING_BASE_URL: z.string().default(''),
  AI_EMBEDDING_MODEL: z.string().max(200).default(''),
  AI_EMBEDDING_API_KEY: z.string().max(4096).default(''),
  AI_EMBEDDING_DIMENSIONS: z.coerce.number().int().min(2).max(4096).default(1536),
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
  if (settings.AI_EMBEDDING_MODE === 'compatible')
    readAiSettings({
      AI_MODE: 'compatible',
      AI_PROVIDER: settings.AI_EMBEDDING_PROVIDER,
      AI_BASE_URL: settings.AI_EMBEDDING_BASE_URL,
      AI_MODEL: settings.AI_EMBEDDING_MODEL,
      AI_API_KEY: settings.AI_EMBEDDING_API_KEY,
    });
  return settings;
}
