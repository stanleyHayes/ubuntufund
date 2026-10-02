import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * A one-way digest of the credential version (`authVersion`) an author
 * submitted a held version with. `authVersion` rotates only on a genuine
 * security event (password change or reset, two-step verification enabled,
 * disabled or its recovery codes regenerated), never on sign-in or token
 * refresh. Publishing on approval refuses a version whose author's
 * credentials changed since they submitted it, so content queued by whoever
 * held the old password cannot publish after the owner secured the account.
 *
 * Kept instead of the raw version: the digest answers "unchanged?" and
 * nothing else. It is bound to the user and to this purpose, so it matches no
 * other hash of the same value. An account that never rotated has the empty
 * version, as the auth middleware treats it.
 */
export function credentialDigest(userId: string, authVersion: string | null | undefined): string {
  return createHash('sha256').update(JSON.stringify(['publication-credential', 1, userId, authVersion ?? ''])).digest('hex');
}

/**
 * True when `stored` is the digest of this user's `authVersion`. A missing
 * digest (a version submitted before publishing on approval) never matches.
 */
export function credentialDigestMatches(stored: string | null | undefined, userId: string, authVersion: string | null | undefined): boolean {
  if (typeof stored !== 'string' || !/^[a-f0-9]{64}$/.test(stored)) return false;
  return timingSafeEqual(Buffer.from(stored, 'hex'), Buffer.from(credentialDigest(userId, authVersion), 'hex'));
}
