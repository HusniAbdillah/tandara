import { describe, expect, it } from 'vitest';
import { parseEnvironment } from './environment.js';

const input = { DATABASE_URL: 'postgres://test:test@localhost/tandara', REDIS_URL: 'redis://localhost:6379' };

describe('server configuration', () => {
  it('does not interpret the string false as true', () => {
    expect(parseEnvironment({ ...input, WORKER_ENABLED: 'false' }).WORKER_ENABLED).toBe(false);
  });

  it('fails closed on invalid URLs without leaking credentials', () => {
    expect(() => parseEnvironment({ ...input, DATABASE_URL: 'https://user:private-password@example.com' })).toThrow('DATABASE_URL');
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
