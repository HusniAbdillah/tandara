import { errorResponseSchema, systemInfoSchema } from '@tandara/contracts';
import type { SystemInfo } from '@tandara/contracts';

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
