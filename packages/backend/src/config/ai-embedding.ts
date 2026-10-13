import { z } from 'zod';
import { readAiSettings } from './ai.js';

export const GEMINI_EMBEDDING_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
export const aiEmbeddingEnvironmentShape = {
  AI_EMBEDDING_MODE: z.enum(['disabled', 'compatible']).default('disabled'),
  AI_EMBEDDING_PROVIDER: z.enum(['vikey', 'deepseek', 'gemini', 'custom']).default('vikey'),
  AI_EMBEDDING_BASE_URL: z.string().trim().default(''),
  AI_EMBEDDING_MODEL: z.string().trim().max(200).default(''),
  AI_EMBEDDING_API_KEY: z.string().trim().max(4096).default(''),
  AI_EMBEDDING_DIMENSIONS: z.coerce.number().int().min(2).max(4096).default(1536),
};
type Settings = z.infer<z.ZodObject<typeof aiEmbeddingEnvironmentShape>>;
export function validateAiEmbeddingSettings(value: Settings, ctx: z.RefinementCtx) {
  if (value.AI_EMBEDDING_MODE !== 'compatible') return;
  if (value.AI_EMBEDDING_PROVIDER !== 'gemini') {
    try {
      readAiSettings({
        AI_MODE: 'compatible',
        AI_PROVIDER: value.AI_EMBEDDING_PROVIDER,
        AI_BASE_URL: value.AI_EMBEDDING_BASE_URL,
        AI_MODEL: value.AI_EMBEDDING_MODEL,
        AI_API_KEY: value.AI_EMBEDDING_API_KEY,
      });
    } catch {
      ctx.addIssue({
        code: 'custom',
        path: ['AI_EMBEDDING_BASE_URL'],
        message: 'Invalid embedding provider profile',
      });
    }
    return;
  }
  if (
    value.AI_EMBEDDING_BASE_URL &&
    value.AI_EMBEDDING_BASE_URL.replace(/\/+$/, '') !== GEMINI_EMBEDDING_BASE_URL
  )
    ctx.addIssue({
      code: 'custom',
      path: ['AI_EMBEDDING_BASE_URL'],
      message: 'Use the official Gemini embedding endpoint',
    });
  if (!/^(models\/)?gemini-embedding-(001|2)$/.test(value.AI_EMBEDDING_MODEL))
    ctx.addIssue({
      code: 'custom',
      path: ['AI_EMBEDDING_MODEL'],
      message: 'Supported Gemini embedding model required',
    });
  if (
    !value.AI_EMBEDDING_API_KEY ||
    /^(replace[-_ ]with|your[-_ ]|<|changeme$)/i.test(value.AI_EMBEDDING_API_KEY) ||
    /[\r\n]/.test(value.AI_EMBEDDING_API_KEY)
  )
    ctx.addIssue({
      code: 'custom',
      path: ['AI_EMBEDDING_API_KEY'],
      message: 'Gemini API key required',
    });
  if (value.AI_EMBEDDING_DIMENSIONS < 128 || value.AI_EMBEDDING_DIMENSIONS > 3072)
    ctx.addIssue({
      code: 'custom',
      path: ['AI_EMBEDDING_DIMENSIONS'],
      message: 'Gemini supports 128 to 3072 dimensions',
    });
}
const schema = z.object(aiEmbeddingEnvironmentShape).superRefine(validateAiEmbeddingSettings);
export function readAiEmbeddingSettings(input: Record<string, string | undefined>) {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new Error(
      'Invalid embedding configuration: ' +
        [...new Set(result.error.issues.map((i) => i.path.join('.')))].join(', '),
    );
  const settings = result.data;
  if (settings.AI_EMBEDDING_PROVIDER === 'gemini')
    return {
      ...settings,
      AI_EMBEDDING_BASE_URL: GEMINI_EMBEDDING_BASE_URL,
      AI_EMBEDDING_MODEL: settings.AI_EMBEDDING_MODEL.replace(/^models\//, ''),
    };
  return settings;
}
