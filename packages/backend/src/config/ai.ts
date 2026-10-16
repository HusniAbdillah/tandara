import { z } from 'zod';

export const aiEnvironmentShape = {
  AI_MODE: z.enum(['disabled', 'heuristic', 'compatible']).default('heuristic'),
  AI_PROVIDER: z.enum(['vikey', 'deepseek', 'custom']).default('custom'),
  AI_BASE_URL: z.string().trim().default(''),
  AI_MODEL: z.string().trim().max(200).default(''),
  AI_API_KEY: z.string().trim().max(4096).default(''),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(90000).default(30000),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(256).max(8192).default(2048),
};

export const aiProviderUrls = {
  vikey: 'https://api.vikey.ai/v1',
  deepseek: 'https://api.deepseek.com',
  custom: '',
} as const;

type AiSettings = z.infer<ReturnType<typeof aiSchema>>;
export function chatThinkingOptions(provider: AiSettings['AI_PROVIDER'], model: string) {
  // Vikey routes hybrid DeepSeek models too; their default reasoning can consume
  // the entire bounded completion allowance before any structured answer exists.
  return provider === 'deepseek' ||
    (provider === 'vikey' && /^deepseek\/deepseek-v(?:3\.[12]|4)(?:-|$)/i.test(model))
    ? { thinking: { type: 'disabled' as const } }
    : {};
}
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]', 'ollama']);
const placeholder = /^(replace[-_ ]with|your[-_ ]|<|changeme$)/i;

export function validateAiSettings(
  value: z.infer<z.ZodObject<typeof aiEnvironmentShape>>,
  context: z.RefinementCtx,
) {
  if (value.AI_MODE !== 'compatible') return;
  let local = false;
  try {
    const base = new URL(value.AI_BASE_URL || aiProviderUrls[value.AI_PROVIDER]);
    local = base.protocol === 'http:' && localHosts.has(base.hostname);
    if (
      (base.protocol !== 'https:' && !local) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      base.pathname.endsWith('/chat/completions') ||
      (value.AI_PROVIDER !== 'custom' &&
        base.href.replace(/\/+$/, '') !== aiProviderUrls[value.AI_PROVIDER])
    )
      throw new Error('Invalid AI endpoint');
  } catch {
    context.addIssue({
      code: 'custom',
      path: ['AI_BASE_URL'],
      message: 'Invalid provider base URL',
    });
  }
  if (!value.AI_MODEL || placeholder.test(value.AI_MODEL))
    context.addIssue({
      code: 'custom',
      path: ['AI_MODEL'],
      message: 'Replace the model placeholder',
    });
  if (
    (!local && !value.AI_API_KEY) ||
    placeholder.test(value.AI_API_KEY) ||
    /[\r\n]/.test(value.AI_API_KEY)
  )
    context.addIssue({
      code: 'custom',
      path: ['AI_API_KEY'],
      message: 'Replace the API key placeholder',
    });
}

function aiSchema() {
  return z.object(aiEnvironmentShape).superRefine(validateAiSettings);
}

export function readAiSettings(input: Record<string, string | undefined>): AiSettings {
  const result = aiSchema().safeParse(input);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Invalid AI configuration: ${fields.join(', ')}`);
  }
  return {
    ...result.data,
    AI_BASE_URL: result.data.AI_BASE_URL || aiProviderUrls[result.data.AI_PROVIDER],
  };
}
