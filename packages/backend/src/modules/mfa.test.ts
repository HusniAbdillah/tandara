import { afterEach, describe, expect, it, vi } from 'vitest';
import { TOTP } from 'otpauth';
import { encryptMfa, decryptMfa, newMfa, verifyMfa } from './mfa.js';
const key = 'ab'.repeat(32);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
describe('MFA secret storage and verification', () => {
  it('uses authenticated randomized encryption and rejects tampering or another key', () => {
    vi.stubEnv('MFA_ENCRYPTION_KEY', key);
    const secret = newMfa('test@example.test').secret;
    const a = encryptMfa(secret);
    expect(a).not.toContain(secret);
    expect(encryptMfa(secret)).not.toBe(a);
    expect(decryptMfa(a)).toBe(secret);
    expect(() => decryptMfa(a.slice(0, -2) + 'ff')).toThrow();
    vi.stubEnv('MFA_ENCRYPTION_KEY', 'cd'.repeat(32));
    expect(() => decryptMfa(a)).toThrow();
  });
  it('accepts the current TOTP counter with one interval drift and rejects expired or malformed codes', () => {
    vi.stubEnv('MFA_ENCRYPTION_KEY', key);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-13T01:00:00Z'));
    const secret = newMfa('test@example.test').secret;
    const encrypted = encryptMfa(secret);
    const totp = new TOTP({ secret });
    expect(verifyMfa(encrypted, totp.generate())).toBe(Math.floor(Date.now() / 30000));
    const old = totp.generate({ timestamp: Date.now() - 60000 });
    expect(verifyMfa(encrypted, old)).toBeNull();
    expect(verifyMfa(encrypted, 'bad')).toBeNull();
  });
});
