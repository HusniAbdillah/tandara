import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { TOTP, Secret } from 'otpauth';
export function encryptMfa(secret: string): string {
  const key = process.env['MFA_ENCRYPTION_KEY'];
  if (!key || !/^[a-f0-9]{64}$/.test(key)) throw new Error('MFA encryption key required');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(
    ':',
  );
}
export function decryptMfa(value: string): string {
  const key = process.env['MFA_ENCRYPTION_KEY'];
  if (!key || !/^[a-f0-9]{64}$/.test(key)) throw new Error('MFA encryption key required');
  const [iv, tag, content] = value.split(':');
  if (!iv || !tag || !content) throw new Error('Invalid MFA record');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(content, 'hex')), decipher.final()]).toString(
    'utf8',
  );
}
export function newMfa(email: string) {
  const totp = new TOTP({ issuer: 'Tandara', label: email, secret: new Secret({ size: 20 }) });
  return { secret: totp.secret.base32, uri: totp.toString() };
}
export function verifyMfa(encrypted: string, token: string): number | null {
  if (!/^\d{6}$/.test(token)) return null;
  const totp = new TOTP({ secret: decryptMfa(encrypted) });
  const now = Date.now();
  const delta = totp.validate({ token, window: 1, timestamp: now });
  return delta === null ? null : Math.floor(now / 30000) + delta;
}
