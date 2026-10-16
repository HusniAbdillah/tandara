import { z } from 'zod';
import { aiEnvironmentShape, validateAiSettings } from './ai.js';
import { aiOperationsShape } from './ai-operations.js';
import { validateAiEmbeddingSettings } from './ai-embedding.js';

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z
      .url()
      .refine((value) => ['postgres:', 'postgresql:'].includes(new URL(value).protocol)),
    REDIS_URL: z.url().refine((value) => ['redis:', 'rediss:'].includes(new URL(value).protocol)),
    API_HOST: z.string().min(1).default('127.0.0.1'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    WORKER_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    APP_MODE: z.enum(['simulation', 'production']).default('simulation'),
    ...aiEnvironmentShape,
    ...aiOperationsShape,
    DEMO_PASSWORD: z.string().optional(),
    SESSION_SECURE: z.enum(['true', 'false']).default('false'),
    TRUST_PROXY: z.enum(['true', 'false']).default('false'),
    ALLOW_LIVE_SOURCES: z.enum(['true', 'false']).default('false'),
    OBSERVATIONS_MODE: z.enum(['live', 'simulation', 'disabled']).default('live'),
    WEB_ORIGINS: z.string().default(''),
    MFA_ENCRYPTION_KEY: z.string().default(''),
    AI_DATA_PROCESSING_APPROVED: z.enum(['true', 'false']).default('false'),
  })
  .superRefine(validateAiSettings)
  .superRefine(validateAiEmbeddingSettings)
  .superRefine((value, ctx) => {
    if (value.APP_MODE !== 'production') return;
    const require = (valid: boolean, path: string) => {
      if (!valid)
        ctx.addIssue({ code: 'custom', path: [path], message: 'Required production control' });
    };
    require(value.NODE_ENV === 'production', 'NODE_ENV');
    require(value.SESSION_SECURE === 'true', 'SESSION_SECURE');
    require(value.TRUST_PROXY === 'true', 'TRUST_PROXY');
    require(/^[a-f0-9]{64}$/.test(value.MFA_ENCRYPTION_KEY), 'MFA_ENCRYPTION_KEY');
    require(value.WEB_ORIGINS.split(',').length === 2 &&
      new Set(value.WEB_ORIGINS.split(',')).size === 2 &&
      value.WEB_ORIGINS.split(',').every((s) => {
        try {
          const u = new URL(s);
          return (
            u.protocol === 'https:' &&
            !['localhost', '127.0.0.1'].includes(u.hostname) &&
            u.origin === s
          );
        } catch {
          return false;
        }
      }), 'WEB_ORIGINS');
    require(!value.DEMO_PASSWORD, 'DEMO_PASSWORD');
    require(value.OBSERVATIONS_MODE !== 'simulation', 'OBSERVATIONS_MODE');
    require(new URL(value.DATABASE_URL).searchParams.get('sslmode') ===
      'verify-full', 'DATABASE_URL');
    if (value.AI_EMBEDDING_MODE === 'compatible') {
      require(value.AI_DATA_PROCESSING_APPROVED === 'true', 'AI_DATA_PROCESSING_APPROVED');
      require(value.AI_EMBEDDING_PROVIDER !== 'custom', 'AI_EMBEDDING_PROVIDER');
    }
    if (value.AI_MODE === 'compatible') {
      require(value.AI_DATA_PROCESSING_APPROVED === 'true', 'AI_DATA_PROCESSING_APPROVED');
      require(value.AI_PROVIDER !== 'custom', 'AI_PROVIDER');
    }
  });

export type Environment = z.infer<typeof environmentSchema>;
export const ENVIRONMENT = Symbol('TANDARA_ENVIRONMENT');

export function parseEnvironment(input: Record<string, string | undefined>): Environment {
  if (
    ['true', '1'].includes(input['LANGSMITH_TRACING'] ?? '') ||
    ['true', '1'].includes(input['LANGCHAIN_TRACING_V2'] ?? '')
  )
    throw new Error('Invalid environment configuration: external model tracing');
  const result = environmentSchema.safeParse(input);
  if (!result.success) {
    // Do not print invalid environment values: URLs may contain passwords.
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Invalid environment configuration: ${fields.join(', ')}`);
  }
  if (
    result.data.APP_MODE === 'production' &&
    (result.data.AI_MODE === 'compatible' || result.data.AI_EMBEDDING_MODE === 'compatible')
  ) {
    const missing = [
      'AI_INPUT_MICRO_USD_PER_MILLION_TOKENS',
      'AI_OUTPUT_MICRO_USD_PER_MILLION_TOKENS',
      'AI_DAILY_BUDGET_MICRO_USD',
      'AI_ORG_DAILY_BUDGET_MICRO_USD',
      'AI_MONTHLY_BUDGET_MICRO_USD',
    ].filter((field) => !input[field]);
    if (
      result.data.AI_EMBEDDING_MODE === 'compatible' &&
      !input['AI_EMBEDDING_MICRO_USD_PER_MILLION_TOKENS']
    )
      missing.push('AI_EMBEDDING_MICRO_USD_PER_MILLION_TOKENS');
    if (missing.length) throw new Error('Invalid environment configuration: ' + missing.join(', '));
  }
  return result.data;
}
