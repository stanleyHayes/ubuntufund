import { isPublicationOutcomeReason, type PublicationOutcomeReason } from '@ubuntu-fund/types';
import { AppError } from '../../../inbound/middleware/errorHandler.js';
import { PublicationApplyRefusal } from '../../../inbound/middleware/publicationErrors.js';

/**
 * A writer shared with the author's own request refuses with an AppError,
 * for the HTTP answer, tagged with a code. Its publication fence codes are
 * mapped by the applier itself; a code that is one of the action's own
 * not-published `reasons` ends the attempt with that reason. Anything else is
 * returned unchanged (and retried).
 */
export function asNotPublished(error: unknown, reasons: ReadonlySet<PublicationOutcomeReason>): unknown {
  if (error instanceof AppError && isPublicationOutcomeReason(error.code) && reasons.has(error.code)) {
    return new PublicationApplyRefusal('not_published', error.code);
  }
  return error;
}
