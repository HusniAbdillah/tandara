import { z } from 'zod';
import { aiEnvironmentShape, validateAiSettings } from './ai.js';

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
    APP_MODE: z.literal('simulation').default('simulation'),
    ...aiEnvironmentShape,
    SESSION_SECURE: z.enum(['true', 'false']).default('false'),
    TRUST_PROXY: z.enum(['true', 'false']).default('false'),
    ALLOW_LIVE_SOURCES: z.enum(['true', 'false']).default('false'),
  })
  .superRefine(validateAiSettings);

export type Environment = z.infer<typeof environmentSchema>;
export const ENVIRONMENT = Symbol('TANDARA_ENVIRONMENT');

export function parseEnvironment(input: Record<string, string | undefined>): Environment {
  const result = environmentSchema.safeParse(input);
  if (!result.success) {
    // Do not print invalid environment values: URLs may contain passwords.
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Invalid environment configuration: ${fields.join(', ')}`);
  }
  return result.data;
}
