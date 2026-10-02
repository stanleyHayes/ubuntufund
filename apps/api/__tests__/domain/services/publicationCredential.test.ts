import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { credentialDigest, credentialDigestMatches } from '../../../src/domain/services/publicationCredential.js';

const userId = '64b000000000000000000001';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

describe('credentialDigest', () => {
  it('is a stable SHA-256 of the purpose, scheme version, user and credential version', () => {
    const digest = credentialDigest(userId, 'b7a1f6c2-0d4e-4c55-9a43-1f0e8d2c6b11');
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).toBe(credentialDigest(userId, 'b7a1f6c2-0d4e-4c55-9a43-1f0e8d2c6b11'));
    // Pinned: digests already stored must keep matching after any refactor.
    expect(digest).toBe(sha256(JSON.stringify(['publication-credential', 1, userId, 'b7a1f6c2-0d4e-4c55-9a43-1f0e8d2c6b11'])));
  });

  it('changes when the credential version rotates, and differs between users', () => {
    expect(credentialDigest(userId, 'before-password-change')).not.toBe(credentialDigest(userId, 'after-password-change'));
    expect(credentialDigest(userId, 'same-version')).not.toBe(credentialDigest('64b000000000000000000002', 'same-version'));
  });

  it('treats an account that never rotated as the empty version, as the auth middleware does', () => {
    expect(credentialDigest(userId, undefined)).toBe(credentialDigest(userId, ''));
    expect(credentialDigest(userId, null)).toBe(credentialDigest(userId, ''));
  });

  it('matches no other hash of the same value', () => {
    const version = 'b7a1f6c2-0d4e-4c55-9a43-1f0e8d2c6b11';
    const digest = credentialDigest(userId, version);
    expect(digest).not.toBe(sha256(version));
    expect(digest).not.toBe(sha256(`${userId}${version}`));
    expect(digest).not.toBe(sha256(JSON.stringify([userId, version])));
    expect(digest).not.toContain(version.replace(/-/g, ''));
  });
});

describe('credentialDigestMatches', () => {
  it('matches only the same user and credential version', () => {
    const stored = credentialDigest(userId, 'current');
    expect(credentialDigestMatches(stored, userId, 'current')).toBe(true);
    expect(credentialDigestMatches(stored, userId, 'rotated')).toBe(false);
    expect(credentialDigestMatches(stored, '64b000000000000000000002', 'current')).toBe(false);
    expect(credentialDigestMatches(credentialDigest(userId, ''), userId, undefined)).toBe(true);
  });

  it('never matches a version submitted without a digest, or a malformed one', () => {
    for (const stored of [undefined, null, '', 'not-a-digest', 'A'.repeat(64), credentialDigest(userId, 'x').slice(1)]) {
      expect(credentialDigestMatches(stored, userId, 'x')).toBe(false);
    }
  });
});
