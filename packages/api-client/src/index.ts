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
      'Content-Type': 'application/json',
      'X-Tandara-Client': 'web',
      'X-CSRF-Token': csrf,
      ...options.headers,
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    signal: options.signal ?? AbortSignal.timeout(20000),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const parsed = errorResponseSchema.safeParse(body);
    throw new ApiError(
      response.status,
      parsed.success ? parsed.data.error.code : 'HTTP_ERROR',
      parsed.success ? parsed.data.error.requestId : undefined,
      parsed.success ? parsed.data.error.message : 'Permintaan tidak berhasil.',
    );
  }
  return schema.parse(body);
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
      const body: unknown = await response.json();
      if (!response.ok) {
        const parsed = errorResponseSchema.safeParse(body);
        throw new ApiError(
          response.status,
          parsed.success ? parsed.data.error.code : 'HTTP_ERROR',
          parsed.success ? parsed.data.error.requestId : undefined,
          parsed.success ? parsed.data.error.message : 'Permintaan tidak berhasil.',
        );
      }
      return systemInfoSchema.parse(body);
    },
  };
}
