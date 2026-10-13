import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AiInferenceError,
  CompatibleAdapter,
  HeuristicAdapter,
  createAiAdapter,
} from './adapters.js';

const input = {
  id: '40000000-0000-4000-8000-000000000099',
  description: 'Terlihat genangan di jalan dekat balai latihan.',
  landmarkText: 'Balai latihan',
  observationTime: null,
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function configured(provider = 'vikey') {
  vi.stubEnv('AI_MODE', 'compatible');
  vi.stubEnv('AI_PROVIDER', provider);
  vi.stubEnv('AI_BASE_URL', '');
  vi.stubEnv('AI_MODEL', 'test-model');
  vi.stubEnv('AI_API_KEY', 'test-key');
  vi.stubEnv('AI_TIMEOUT_MS', '30000');
  vi.stubEnv('AI_MAX_OUTPUT_TOKENS', '1024');
  return createAiAdapter()!;
}

describe('configured model inference', () => {
  it.each([
    ['vikey', 'https://api.vikey.ai/v1/chat/completions'],
    ['deepseek', 'https://api.deepseek.com/chat/completions'],
  ])('validates a real-format %s completion and records its provider', async (provider, url) => {
    const output = await new HeuristicAdapter().suggest(input);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(output) }, finish_reason: 'stop' }],
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const adapter = configured(provider);
    expect(await adapter.suggest(input)).toEqual(output);
    expect(adapter.provider).toBe(provider);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [requestedUrl, options] = fetchMock.mock.calls[0]!;
    expect(requestedUrl).toBe(url);
    expect(options.headers.Authorization).toBe('Bearer test-key');
    expect(options.redirect).toBe('error');
    const body = JSON.parse(options.body);
    expect(body.max_tokens).toBe(1024);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.stream).toBe(false);
    expect(body.messages[0].content).toContain('Example JSON');
    expect(body.messages[1].content).not.toContain('test-key');
    expect(body.thinking).toEqual(provider === 'deepseek' ? { type: 'disabled' } : undefined);
  });

  it.each([408, 429, 500, 502, 503, 504])(
    'classifies HTTP %i for outbox retry without leaking provider content',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response('private-key and private-provider-details', {
            status,
            headers: { 'Retry-After': '2' },
          }),
        ),
      );
      const adapter = configured();
      await expect(adapter.suggest(input)).rejects.toMatchObject({
        retryable: true,
        retryAfterMs: 2000,
        code: 'provider_unavailable',
      });
      await expect(adapter.suggest(input)).rejects.not.toThrow('private-key');
    },
  );

  it.each([400, 401, 403, 404, 402])(
    'does not retry rejected configuration, authentication or balance: HTTP %i',
    async (status) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status })));
      await expect(configured().suggest(input)).rejects.toMatchObject({
        retryable: false,
        code: 'provider_rejected',
      });
    },
  );

  it.each([
    { message: { content: '' }, finish_reason: 'stop' },
    { message: { content: '{' }, finish_reason: 'length' },
    { message: { content: '{}', refusal: 'Not available' }, finish_reason: 'stop' },
    { message: { content: '{"private":"untrusted"}' }, finish_reason: 'stop' },
  ])('rejects incomplete, refused and invalid-schema output', async (choice) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [choice] }))),
    );
    await expect(configured().suggest(input)).rejects.toMatchObject({
      retryable: false,
      code: 'invalid_output',
    });
  });

  it('retries network timeouts with sanitized errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('private network details', 'TimeoutError')),
    );
    await expect(configured().suggest(input)).rejects.toMatchObject({ retryable: true });
  });

  it('does not send placeholder credentials or call a provider in heuristic mode', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('AI_MODE', 'heuristic');
    vi.stubEnv('AI_MODEL', 'replace-with-model-id');
    vi.stubEnv('AI_API_KEY', 'replace-with-api-key');
    expect((await createAiAdapter()!.suggest(input)).needsHumanReview).toBe(true);
    vi.stubEnv('AI_MODE', 'compatible');
    vi.stubEnv('AI_PROVIDER', 'vikey');
    expect(() => createAiAdapter()).toThrow('AI configuration');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves the generic compatible adapter for approved custom backends', async () => {
    const adapter = new CompatibleAdapter('http://ollama:11434/v1', '', 'local-test-model');
    expect(adapter.provider).toBe('compatible');
    expect(adapter.key).toBe('');
    expect(new AiInferenceError('invalid_output', false).message).toBe(
      'AI inference failed: invalid_output',
    );
  });
});
