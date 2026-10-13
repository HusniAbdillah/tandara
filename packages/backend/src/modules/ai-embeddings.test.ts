import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { embedText, embeddingRelease } from './ai-embeddings.js';
describe('native Gemini embeddings', () => {
  beforeEach(() => {
    for (const [key, value] of Object.entries({
      AI_EMBEDDING_MODE: 'compatible',
      AI_EMBEDDING_PROVIDER: 'gemini',
      AI_EMBEDDING_BASE_URL: '',
      AI_EMBEDDING_MODEL: 'gemini-embedding-001',
      AI_EMBEDDING_API_KEY: 'fixture-google-secret',
      AI_EMBEDDING_DIMENSIONS: '128',
    }))
      vi.stubEnv(key, value);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  function mockResponse(body: unknown, status = 200) {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json', 'retry-after': '2' },
      }),
    );
    vi.stubGlobal('fetch', fetch);
    return fetch;
  }
  it.each(['document', 'query'] as const)(
    'uses native authentication, redacts input and distinguishes %s',
    async (purpose) => {
      const fetch = mockResponse({
        embedding: { values: [3, 4, ...Array(126).fill(0)] },
        usageMetadata: { promptTokenCount: 12 },
      });
      const usage = vi.fn();
      expect(
        await embedText('Kontak person@example.test. Dokumen latihan.', usage, purpose),
      ).toEqual([0.6, 0.8, ...Array(126).fill(0)]);
      expect(usage).toHaveBeenCalledWith(12);
      const [url, request] = fetch.mock.calls[0]!;
      expect(url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent',
      );
      expect(url).not.toContain('secret');
      expect(request.headers['x-goog-api-key']).toBe('fixture-google-secret');
      expect(request.headers.Authorization).toBeUndefined();
      expect(request.redirect).toBe('error');
      const body = JSON.parse(request.body);
      expect(body.content.parts[0].text).not.toContain('person@example.test');
      expect(body.outputDimensionality).toBe(128);
      expect(body.taskType).toBe(purpose === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT');
    },
  );
  it.each(['document', 'query'] as const)(
    'uses the Embeddings 2 retrieval prefix for %s without taskType',
    async (purpose) => {
      vi.stubEnv('AI_EMBEDDING_MODEL', 'gemini-embedding-2');
      const fetch = mockResponse({ embedding: { values: [1, ...Array(127).fill(0)] } });
      const usage = vi.fn();
      await embedText('latihan', usage, purpose);
      const body = JSON.parse(fetch.mock.calls[0]![1].body);
      expect(body.taskType).toBeUndefined();
      expect(body.content.parts[0].text).toBe(
        purpose === 'query'
          ? 'task: search result | query: latihan'
          : 'title: none | text: latihan',
      );
      expect(usage).not.toHaveBeenCalled();
    },
  );
  it.each([
    ['zero', Array(128).fill(0)],
    ['short', [1, 0]],
    ['long', Array(129).fill(1)],
    ['non-numeric', [null, ...Array(127).fill(0)]],
    ['overflow', Array(128).fill(1.7e308)],
  ])('rejects %s vectors', async (_label, values) => {
    mockResponse({ embedding: { values } });
    await expect(embedText('latihan')).rejects.toMatchObject({
      code: 'invalid_output',
      retryable: false,
    });
  });
  it.each([
    [429, 'provider_unavailable', true],
    [503, 'provider_unavailable', true],
    [400, 'provider_rejected', false],
    [403, 'provider_rejected', false],
  ])('sanitizes HTTP %s and retains retry classification', async (status, code, retryable) => {
    mockResponse({ error: { message: 'SECRET_PROVIDER_DETAILS' } }, Number(status));
    await expect(embedText('latihan')).rejects.toMatchObject({ code, retryable });
    try {
      await embedText('latihan');
    } catch (error) {
      expect(String(error)).not.toContain('SECRET_PROVIDER_DETAILS');
    }
  });
  it('keeps key rotation outside the vector profile and fences model/dimension changes', () => {
    const original = embeddingRelease();
    vi.stubEnv('AI_EMBEDDING_API_KEY', 'another-fixture-secret');
    expect(embeddingRelease()).toBe(original);
    vi.stubEnv('AI_EMBEDDING_DIMENSIONS', '768');
    expect(embeddingRelease()).not.toBe(original);
  });
  it('makes no request when disabled or when a Google key would go to another host', async () => {
    const fetch = mockResponse({ embedding: { values: [1, 0, 0] } });
    vi.stubEnv('AI_EMBEDDING_MODE', 'disabled');
    await expect(embedText('latihan')).rejects.toMatchObject({ code: 'provider_rejected' });
    vi.stubEnv('AI_EMBEDDING_MODE', 'compatible');
    vi.stubEnv('AI_EMBEDDING_BASE_URL', 'https://evil.example.test');
    await expect(embedText('latihan')).rejects.toThrow('AI_EMBEDDING_BASE_URL');
    expect(fetch).not.toHaveBeenCalled();
  });
});
