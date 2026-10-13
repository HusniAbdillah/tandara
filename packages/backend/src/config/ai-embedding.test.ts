import { describe, expect, it } from 'vitest';
import { readAiEmbeddingSettings, GEMINI_EMBEDDING_BASE_URL } from './ai-embedding.js';
import { parseEnvironment } from './environment.js';
const profile = {
  AI_EMBEDDING_MODE: 'compatible',
  AI_EMBEDDING_PROVIDER: 'gemini',
  AI_EMBEDDING_MODEL: 'gemini-embedding-001',
  AI_EMBEDDING_API_KEY: 'fixture-google-secret',
};
describe('Gemini embedding configuration', () => {
  it('resolves a separate Google endpoint and canonical model resource at startup', () => {
    const settings = readAiEmbeddingSettings({
      ...profile,
      AI_EMBEDDING_MODEL: 'models/gemini-embedding-001',
    });
    expect(settings.AI_EMBEDDING_BASE_URL).toBe(GEMINI_EMBEDDING_BASE_URL);
    expect(settings.AI_EMBEDDING_MODEL).toBe('gemini-embedding-001');
    expect(settings.AI_EMBEDDING_DIMENSIONS).toBe(1536);
    expect(
      parseEnvironment({
        ...profile,
        DATABASE_URL: 'postgres://test:test@localhost/test',
        REDIS_URL: 'redis://localhost:6379',
      }).AI_EMBEDDING_PROVIDER,
    ).toBe('gemini');
  });
  it.each([
    { AI_EMBEDDING_BASE_URL: 'https://generativelanguage.googleapis.com.evil.test/v1beta' },
    {
      AI_EMBEDDING_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta?key=private-secret',
    },
    {
      AI_EMBEDDING_BASE_URL: 'https://user:private-secret@generativelanguage.googleapis.com/v1beta',
    },
    { AI_EMBEDDING_BASE_URL: 'http://generativelanguage.googleapis.com/v1beta' },
    { AI_EMBEDDING_MODEL: 'deepseek/deepseek-v4-flash' },
    { AI_EMBEDDING_MODEL: '../gemini-embedding-001:generateContent' },
    { AI_EMBEDDING_API_KEY: 'replace-with-gemini-api-key' },
    { AI_EMBEDDING_API_KEY: 'private-secret\nInjected: header' },
    { AI_EMBEDDING_DIMENSIONS: '4096' },
    { AI_EMBEDDING_DIMENSIONS: '127' },
  ])('rejects invalid embedding profiles without printing values: %j', (patch) => {
    expect(() => readAiEmbeddingSettings({ ...profile, ...patch })).toThrow();
    try {
      readAiEmbeddingSettings({ ...profile, ...patch });
    } catch (error) {
      expect(String(error)).not.toContain('private-secret');
    }
  });
  it('allows placeholders only while disabled and never treats enabled as a valid mode', () => {
    expect(
      readAiEmbeddingSettings({
        ...profile,
        AI_EMBEDDING_MODE: 'disabled',
        AI_EMBEDDING_API_KEY: '',
      }).AI_EMBEDDING_MODE,
    ).toBe('disabled');
    expect(() => readAiEmbeddingSettings({ ...profile, AI_EMBEDDING_MODE: 'enabled' })).toThrow(
      'AI_EMBEDDING_MODE',
    );
  });
});
