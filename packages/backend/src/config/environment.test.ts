import { describe, expect, it } from 'vitest';
import { parseEnvironment } from './environment.js';

const input = {
  DATABASE_URL: 'postgres://test:test@localhost/tandara',
  REDIS_URL: 'redis://localhost:6379',
};
const production = {
  ...input,
  NODE_ENV: 'production',
  APP_MODE: 'production',
  AI_MODE: 'disabled',
  SESSION_SECURE: 'true',
  TRUST_PROXY: 'true',
  WEB_ORIGINS: 'https://warga.example.test,https://posko.example.test',
  MFA_ENCRYPTION_KEY: 'ab'.repeat(32),
  DATABASE_URL: 'postgres://service:private-password@db.example.test/tandara?sslmode=verify-full',
};

describe('server configuration', () => {
  it('requires isolated production identity, HTTPS and verified database TLS', () => {
    expect(parseEnvironment(production).APP_MODE).toBe('production');
    for (const patch of [
      { DEMO_PASSWORD: 'simulation-only' },
      { MFA_ENCRYPTION_KEY: '' },
      { SESSION_SECURE: 'false' },
      { WEB_ORIGINS: 'http://localhost' },
      { DATABASE_URL: input.DATABASE_URL },
    ])
      expect(() => parseEnvironment({ ...production, ...patch })).toThrow();
  });
  it('forbids external content tracing and unapproved paid inference in production', () => {
    expect(() => parseEnvironment({ ...input, LANGSMITH_TRACING: 'true' })).toThrow(
      'external model tracing',
    );
    expect(() =>
      parseEnvironment({
        ...production,
        AI_MODE: 'compatible',
        AI_PROVIDER: 'vikey',
        AI_MODEL: 'candidate-version',
        AI_API_KEY: 'test-only-secret',
      }),
    ).toThrow('AI_DATA_PROCESSING_APPROVED');
  });
  it('requires valid model configuration and strict permission flags', () => {
    expect(() => parseEnvironment({ ...input, AI_MODE: 'compatible' })).toThrow('AI_BASE_URL');
    expect(() => parseEnvironment({ ...input, AI_MODE: 'pretend-live' })).toThrow('AI_MODE');
    expect(() => parseEnvironment({ ...input, ALLOW_LIVE_SOURCES: 'yes' })).toThrow(
      'ALLOW_LIVE_SOURCES',
    );
    expect(parseEnvironment({ ...input, AI_MODE: 'disabled' }).AI_MODE).toBe('disabled');
  });
  it('does not interpret the string false as true', () => {
    expect(parseEnvironment({ ...input, WORKER_ENABLED: 'false' }).WORKER_ENABLED).toBe(false);
  });

  it('fails closed on invalid URLs without leaking credentials', () => {
    expect(() =>
      parseEnvironment({ ...input, DATABASE_URL: 'https://user:private-password@example.com' }),
    ).toThrow('DATABASE_URL');
    try {
      parseEnvironment({ ...input, DATABASE_URL: 'https://user:private-password@example.com' });
    } catch (error) {
      expect(String(error)).not.toContain('private-password');
    }
  });

  it('does not enable unsupported production incident mode', () => {
    expect(() => parseEnvironment({ ...input, APP_MODE: 'live' })).toThrow('APP_MODE');
  });
});
