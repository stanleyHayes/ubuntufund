import type { AutoPublishAction } from '@ubuntu-fund/types';
import type { PublicationApplyHandler } from '../../../../../domain/ports/outbound/PublicationApplyPort.js';
import { PublicationApplyRefusal } from '../../../inbound/middleware/publicationErrors.js';

/**
 * The handler of an action whose publishing on approval is not built yet. It
 * refuses before anything is written, so nothing is half-published: the
 * attempt ends as `not_published/unavailable`, the author is told, and the
 * approved version still publishes when the author submits it again.
 */
export function notBuiltYet(action: AutoPublishAction): PublicationApplyHandler<string> {
  return {
    action,
    parse: review => review.text,
    commit: async () => {
      throw new PublicationApplyRefusal('not_published', 'unavailable');
    },
  };
}
