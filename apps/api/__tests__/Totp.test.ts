import { describe, it, expect } from 'vitest';
import { TotpCipher, matchTotp, newTotpSecret, recoveryDigest, totpAtCounter } from '../src/application/services/Totp.js';
describe('RFC 6238 authenticator primitives', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  it('matches the RFC SHA-1 vectors with six-digit truncation and clock tolerance', () => {
    for (const [seconds, expected] of [[59, '287082'], [1111111109, '081804'], [1111111111, '050471'], [1234567890, '005924'], [2000000000, '279037'], [20000000000, '353130']] as const) {
      expect(totpAtCounter(secret, Math.floor(seconds / 30))).toBe(expected);
      expect(matchTotp(secret, expected, seconds * 1000)).toBe(Math.floor(seconds / 30));
    }
    expect(matchTotp(secret, '287082', 120_000)).toBeNull();
    expect(matchTotp(secret, 'invalid')).toBeNull();
  });
  it('generates separate secrets, binds encrypted secrets to accounts and rejects wrong keys/tampering', () => {
    const cipher = new TotpCipher(Buffer.alloc(32, 1).toString('base64'));
    const first = newTotpSecret();
    expect(first).toMatch(/^[A-Z2-7]{32}$/);
    expect(newTotpSecret()).not.toBe(first);
    const encrypted = cipher.encrypt(first, 'account-a');
    expect(encrypted).not.toContain(first);
    expect(cipher.decrypt(encrypted, 'account-a')).toBe(first);
    expect(() => cipher.decrypt(encrypted, 'account-b')).toThrow();
    expect(() => new TotpCipher(Buffer.alloc(32, 2).toString('base64')).decrypt(encrypted, 'account-a')).toThrow();
    expect(new TotpCipher('').configured).toBe(false);
    expect(recoveryDigest('ABCD-1234')).toBe(recoveryDigest('abcd1234'));
  });
});
