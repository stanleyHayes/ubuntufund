import { randomBytes } from 'node:crypto';

/**
 * Generate a secret, unguessable overlay token (48 hex chars / 24 bytes of
 * entropy). Gates the public overlay + SSE reads for a live session; rotating
 * it instantly revokes every browser source still using the old value.
 */
export function generateOverlayToken(): string {
  return randomBytes(24).toString('hex');
}
