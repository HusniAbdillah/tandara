import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './index.js';

describe('API client', () => {
  it('includes cookie credentials and validates the public response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      name: 'Tandara', mode: 'simulation', stage: 'foundation',
    })));
    const client = createApiClient({ fetch: fetcher });
    await expect(client.getSystemInfo()).resolves.toMatchObject({ stage: 'foundation' });
    expect(fetcher).toHaveBeenCalledWith('/api/v1/system/info', expect.objectContaining({ credentials: 'include' }));
  });

  it('preserves request ID on API failure', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'FORBIDDEN', message: 'Akses ditolak.', requestId: 'request-1' },
    }), { status: 403 }));
    await expect(createApiClient({ fetch: fetcher }).getSystemInfo()).rejects.toMatchObject({
      name: 'ApiError', status: 403, code: 'FORBIDDEN', requestId: 'request-1',
    });
  });

  it('rejects an incompatible successful payload', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ name: 'Tandara', secret: 'unexpected' })));
    await expect(createApiClient({ fetch: fetcher }).getSystemInfo()).rejects.toThrow();
    expect(ApiError.prototype).toBeInstanceOf(Error);
  });
});
