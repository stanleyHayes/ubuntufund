import { createHash } from 'node:crypto';
import type { PublicationSubmission } from '../ports/outbound/PublicationAdmissionPort.js';

/**
 * The exact-version identity of a proposed publication: actor, action,
 * resource, base version, text and ordered media. An approval authorizes only
 * this fingerprint. Published comments/updates keep it so moderation can
 * revoke the approval when it removes the content.
 */
export function publicationFingerprint(input: PublicationSubmission): string {
  return createHash('sha256').update(JSON.stringify([
    input.actorId, input.action, input.resourceId, input.baseVersion ?? '', input.text, input.mediaUrls,
  ])).digest('hex');
}
