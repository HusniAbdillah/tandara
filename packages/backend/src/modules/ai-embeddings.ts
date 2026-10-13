import { z } from 'zod';
import { aiOperationsSettings } from '../config/ai-operations.js';
import { readAiSettings } from '../config/ai.js';
import { AiInferenceError, ProviderHttpError, fetchJson } from './adapters.js';
import { redactAiText } from './ai-policy.js';
import { hash } from './shared.js';

export type EmbeddingPurpose = 'document' | 'query';
// Version the task formatting/normalization along with the model. Old vectors cannot mix with new ones.
const GEMINI_EMBEDDING_PROTOCOL = 'gemini-native-retrieval-normalized-1';
export async function embedText(
  text: string,
  onUsage?: (tokens: number) => void,
  purpose: EmbeddingPurpose = 'document',
): Promise<number[]> {
  const ops = aiOperationsSettings();
  if (ops.AI_EMBEDDING_MODE !== 'compatible')
    throw new AiInferenceError('provider_rejected', false);
  const gemini = ops.AI_EMBEDDING_PROVIDER === 'gemini';
  let response: unknown;
  try {
    if (gemini) {
      const newer = ops.AI_EMBEDDING_MODEL === 'gemini-embedding-2';
      const content = newer
        ? (purpose === 'query' ? 'task: search result | query: ' : 'title: none | text: ') +
          redactAiText(text)
        : redactAiText(text);
      response = await fetchJson(
        ops.AI_EMBEDDING_BASE_URL + '/models/' + ops.AI_EMBEDDING_MODEL + ':embedContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': ops.AI_EMBEDDING_API_KEY,
          },
          body: JSON.stringify({
            model: 'models/' + ops.AI_EMBEDDING_MODEL,
            content: { parts: [{ text: content }] },
            outputDimensionality: ops.AI_EMBEDDING_DIMENSIONS,
            ...(!newer
              ? { taskType: purpose === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT' }
              : {}),
            embedContentConfig: { autoTruncate: false },
          }),
        },
        30000,
      );
    } else {
      const settings = readAiSettings({
        AI_MODE: 'compatible',
        AI_PROVIDER: ops.AI_EMBEDDING_PROVIDER,
        AI_BASE_URL: ops.AI_EMBEDDING_BASE_URL,
        AI_API_KEY: ops.AI_EMBEDDING_API_KEY,
        AI_MODEL: ops.AI_EMBEDDING_MODEL,
      });
      response = await fetchJson(
        settings.AI_BASE_URL.replace(/\/+$/, '') + '/embeddings',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + settings.AI_API_KEY,
          },
          body: JSON.stringify({
            model: settings.AI_MODEL,
            input: redactAiText(text),
            encoding_format: 'float',
          }),
        },
        30000,
      );
    }
  } catch (error) {
    if (error instanceof ProviderHttpError && [408, 429, 500, 502, 503, 504].includes(error.status))
      throw new AiInferenceError('provider_unavailable', true, error.retryAfterMs);
    if (
      error instanceof TypeError ||
      (error instanceof DOMException && ['TimeoutError', 'AbortError'].includes(error.name))
    )
      throw new AiInferenceError('provider_unavailable', true);
    throw new AiInferenceError('provider_rejected', false);
  }
  try {
    const vectors = z.array(z.number().finite()).length(ops.AI_EMBEDDING_DIMENSIONS);
    const parsed = gemini
      ? z
          .object({
            embedding: z.object({ values: vectors }),
            usageMetadata: z
              .object({ promptTokenCount: z.number().int().nonnegative() })
              .optional(),
          })
          .parse(response)
      : z
          .object({
            data: z.array(z.object({ embedding: vectors })).length(1),
            usage: z.object({ total_tokens: z.number().int().nonnegative() }).optional(),
          })
          .parse(response);
    const value = 'embedding' in parsed ? parsed.embedding.values : parsed.data[0]!.embedding;
    const norm = Math.hypot(...value);
    if (!Number.isFinite(norm) || norm === 0) throw new Error('Invalid embedding');
    const tokens =
      'embedding' in parsed ? parsed.usageMetadata?.promptTokenCount : parsed.usage?.total_tokens;
    if (tokens !== undefined) onUsage?.(tokens);
    return gemini ? value.map((n) => n / norm) : value;
  } catch {
    throw new AiInferenceError('invalid_output', false);
  }
}
export function embeddingRelease(): string {
  const s = aiOperationsSettings();
  const profile = [
    s.AI_EMBEDDING_MODE,
    s.AI_EMBEDDING_PROVIDER,
    s.AI_EMBEDDING_BASE_URL,
    s.AI_EMBEDDING_MODEL,
    s.AI_EMBEDDING_DIMENSIONS,
  ];
  if (s.AI_EMBEDDING_PROVIDER === 'gemini') profile.push(GEMINI_EMBEDDING_PROTOCOL);
  return hash(JSON.stringify(profile));
}
