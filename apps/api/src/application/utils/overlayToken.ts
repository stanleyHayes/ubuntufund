import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Generate a secret, unguessable overlay token (48 hex chars / 24 bytes of
 * entropy). Gates the public overlay + SSE reads for a live session; rotating
 * it instantly revokes every browser source still using the old value.
 */
export function generateOverlayToken(): string {
  return randomBytes(24).toString('hex');
}

/**
 * Constant-time check of a presented overlay token against the session's.
 * Hashing both sides first gives equal-length buffers, so a length mismatch
 * neither throws nor leaks through timing. An empty value never matches: a
 * moderation stop clears the stored token to '' to revoke every overlay link.
 */
export function overlayTokenMatches(expected: string | undefined, provided: string | undefined): boolean {
  if (!expected || !provided) return false;
  const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(expected), digest(provided));
}
