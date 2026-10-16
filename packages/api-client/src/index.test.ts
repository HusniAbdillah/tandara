import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, createApiClient, request } from './index.js';

describe('API client', () => {
  it.each([
    [502, ''],
    [503, '<html>upstream unavailable</html>'],
    [500, '{"error":'],
  ])('turns non-JSON HTTP %s into a readable service error', async (status, body) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () => new Response(body, { status, headers: { 'X-Request-ID': 'proxy-1' } }),
      );
    vi.stubGlobal('fetch', fetcher);
    try {
      for (const action of [
        () => request('/auth/login', z.object({ ok: z.boolean() }), { method: 'POST', body: {} }),
        () => createApiClient({ fetch: fetcher }).getSystemInfo(),
      ]) {
        await expect(action()).rejects.toMatchObject({
          name: 'ApiError',
          status,
          requestId: 'proxy-1',
          message: 'Layanan sedang tidak tersedia. Tunggu sebentar lalu coba lagi.',
        });
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each(['', '{"user":', '<html>not an API response</html>'])(
    'handles incomplete successful responses without a JSON parser error',
    async (body) => {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
      await expect(createApiClient({ fetch: fetcher }).getSystemInfo()).rejects.toMatchObject({
        name: 'ApiError',
        code: 'INVALID_RESPONSE',
        message: 'Respons layanan belum lengkap. Silakan coba lagi.',
      });
    },
  );
  it('sends bodyless actions without a JSON content type while retaining security headers', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal('fetch', fetcher);
    try {
      await expect(
        request('/auth/logout', z.object({ ok: z.boolean() }), { method: 'POST' }),
      ).resolves.toEqual({ ok: true });
      const options = fetcher.mock.calls[0]?.[1];
      expect(options?.credentials).toBe('include');
      expect(options?.body).toBeUndefined();
      expect(options?.headers).not.toHaveProperty('Content-Type');
      expect(options?.headers).toMatchObject({ 'X-Tandara-Client': 'web', 'X-CSRF-Token': '' });
      fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
      await request('/notifications/preferences', z.object({ ok: z.boolean() }), {
        method: 'POST',
        body: { enabled: false },
      });
      expect(fetcher.mock.calls[1]?.[1]?.headers).toHaveProperty(
        'Content-Type',
        'application/json',
      );
      expect(fetcher.mock.calls[1]?.[1]?.body).toBe('{"enabled":false}');
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('includes cookie credentials and validates the public response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          name: 'Tandara',
          mode: 'simulation',
          stage: 'foundation',
        }),
      ),
    );
    const client = createApiClient({ fetch: fetcher });
    await expect(client.getSystemInfo()).resolves.toMatchObject({ stage: 'foundation' });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/system/info',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('preserves request ID on API failure', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'FORBIDDEN', message: 'Akses ditolak.', requestId: 'request-1' },
        }),
        { status: 403 },
      ),
    );
    await expect(createApiClient({ fetch: fetcher }).getSystemInfo()).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      code: 'FORBIDDEN',
      requestId: 'request-1',
    });
  });

  it('rejects an incompatible successful payload', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ name: 'Tandara', secret: 'unexpected' })));
    await expect(createApiClient({ fetch: fetcher }).getSystemInfo()).rejects.toThrow();
    expect(ApiError.prototype).toBeInstanceOf(Error);
  });
});
