import { describe, expect, it } from 'vitest';
import { readAiSettings } from './ai.js';
import { parseEnvironment } from './environment.js';

const model = { AI_MODE: 'compatible', AI_MODEL: 'test-model', AI_API_KEY: 'test-key' };
describe('AI provider configuration', () => {
  it.each([
    ['vikey', 'https://api.vikey.ai/v1'],
    ['deepseek', 'https://api.deepseek.com'],
  ])('resolves %s without changing application contracts', (provider, url) => {
    const value = readAiSettings({ ...model, AI_PROVIDER: provider });
    expect(value.AI_BASE_URL).toBe(url);
    expect(value.AI_TIMEOUT_MS).toBe(30000);
    expect(value.AI_MAX_OUTPUT_TOKENS).toBe(2048);
  });

  it('allows placeholders only when no inference can run', () => {
    const placeholders = {
      AI_PROVIDER: 'vikey',
      AI_MODEL: 'replace-with-model-id',
      AI_API_KEY: 'replace-with-api-key',
    };
    expect(readAiSettings(placeholders).AI_MODE).toBe('heuristic');
    expect(() => readAiSettings({ ...placeholders, AI_MODE: 'compatible' })).toThrow('AI_MODEL');
    expect(() => readAiSettings({ ...model, AI_PROVIDER: 'deepseek', AI_API_KEY: '' })).toThrow(
      'AI_API_KEY',
    );
  });

  it.each([
    'https://api.vikey.ai.evil.test/v1',
    'https://api.vikey.ai/v1?token=private-key',
    'https://secret:private-key@api.vikey.ai/v1',
    'https://api.vikey.ai/v1/chat/completions',
    'http://api.vikey.ai/v1',
  ])('rejects a named provider override without leaking credentials: %s', (url) => {
    expect(() => readAiSettings({ ...model, AI_PROVIDER: 'vikey', AI_BASE_URL: url })).toThrow(
      'AI_BASE_URL',
    );
    try {
      readAiSettings({ ...model, AI_PROVIDER: 'vikey', AI_BASE_URL: url });
    } catch (error) {
      expect(String(error)).not.toContain('private-key');
    }
  });

  it('uses the same local endpoint policy at startup and inference', () => {
    const value = {
      ...model,
      AI_PROVIDER: 'custom',
      AI_BASE_URL: 'http://ollama:11434/v1',
      AI_API_KEY: '',
    };
    expect(readAiSettings(value).AI_BASE_URL).toBe(value.AI_BASE_URL);
    expect(
      parseEnvironment({
        ...value,
        DATABASE_URL: 'postgres://test:test@localhost/test',
        REDIS_URL: 'redis://localhost:6379',
      }).AI_MODEL,
    ).toBe('test-model');
    expect(() => readAiSettings({ ...value, AI_BASE_URL: 'http://remote.test/v1' })).toThrow(
      'AI_BASE_URL',
    );
  });

  it('bounds latency and output tokens', () => {
    expect(() =>
      readAiSettings({ ...model, AI_PROVIDER: 'vikey', AI_TIMEOUT_MS: '120000' }),
    ).toThrow('AI_TIMEOUT_MS');
    expect(() =>
      readAiSettings({ ...model, AI_PROVIDER: 'vikey', AI_MAX_OUTPUT_TOKENS: '999999' }),
    ).toThrow('AI_MAX_OUTPUT_TOKENS');
  });
});
