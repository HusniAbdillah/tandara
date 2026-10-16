import { errorResponseSchema, systemInfoSchema } from '@tandara/contracts';
import type { SystemInfo } from '@tandara/contracts';
import type { z } from 'zod';

export async function request<S extends z.ZodType>(
  path: string,
  schema: S,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  } = {},
): Promise<z.infer<S>> {
  const csrf =
    typeof document === 'undefined'
      ? ''
      : (document.cookie
          .split('; ')
          .find((v) => v.startsWith('tandara_csrf='))
          ?.split('=')[1] ?? '');
  const response = await fetch('/api/v1' + path, {
    credentials: 'include',
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      'X-Tandara-Client': 'web',
      'X-CSRF-Token': csrf,
      ...options.headers,
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    signal: options.signal ?? AbortSignal.timeout(20000),
  });
  if (response.status === 401 && typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent('tandara:unauthorized', { detail: { path } }));
  return parseResponse(response, schema);
}

async function parseResponse<S extends z.ZodType>(
  response: Response,
  schema: S,
): Promise<z.infer<S>> {
  let body: unknown;
  try {
    const text = await response.text();
    body = text.trim() ? JSON.parse(text) : undefined;
  } catch {
    // Proxies can return an empty, HTML, or truncated response during a restart.
    // Never expose response bodies or JSON parser diagnostics to the user.
    body = undefined;
  }
  const requestId = response.headers.get('x-request-id') ?? undefined;
  if (!response.ok) {
    const parsed = errorResponseSchema.safeParse(body);
    const fallback =
      response.status >= 500
        ? 'Layanan sedang tidak tersedia. Tunggu sebentar lalu coba lagi.'
        : response.status === 429
          ? 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.'
          : 'Permintaan belum berhasil. Silakan coba lagi.';
    throw new ApiError(
      response.status,
      parsed.success ? parsed.data.error.code : 'HTTP_ERROR',
      parsed.success ? parsed.data.error.requestId : requestId,
      parsed.success ? parsed.data.error.message : fallback,
    );
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      requestId,
      'Respons layanan belum lengkap. Silakan coba lagi.',
    );
  return parsed.data;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly requestId: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function createApiClient(options: { baseUrl?: string; fetch?: typeof fetch } = {}) {
  const baseUrl = (options.baseUrl ?? '/api/v1').replace(/\/$/, '');
  const fetcher = options.fetch ?? globalThis.fetch;

  return {
    async getSystemInfo(signal?: AbortSignal): Promise<SystemInfo> {
      const response = await fetcher(`${baseUrl}/system/info`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
        ...(signal ? { signal } : {}),
      });
      return parseResponse(response, systemInfoSchema);
    },
  };
}
