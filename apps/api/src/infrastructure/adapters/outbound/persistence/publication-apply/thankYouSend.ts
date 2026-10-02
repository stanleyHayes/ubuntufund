import type { DonorThankYouContent, PublicationOutcomeReason } from '@ubuntu-fund/types';
import type { PublicationApplyHandler, PublicationApplyReview } from '../../../../../domain/ports/outbound/PublicationApplyPort.js';
import type { PublicationApplyDeps } from './deps.js';
import { asNotPublished } from './writerRefusal.js';

/** Why the queueing writer refuses an approved message besides its fences (MongoDonorThankYous REASON_CODES). */
const REFUSALS: ReadonlySet<PublicationOutcomeReason> = new Set<PublicationOutcomeReason>([
  'thank_you_disabled', 'thank_you_limit_reached', 'thank_you_no_donors', 'thank_you_not_eligible',
]);

/**
 * thank_you.send's stored text: the message exactly as it was reviewed,
 * `{ subject, body, signature }` (MongoDonorThankYous.submit). Null when the
 * text is not such a message.
 */
function parseThankYouProposal(review: PublicationApplyReview): DonorThankYouContent | null {
  if (review.mediaUrls.length) return null;
  let value: unknown;
  try { value = JSON.parse(review.text); } catch { return null; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { subject, body, signature } = value as Record<string, unknown>;
  if (typeof subject !== 'string' || !subject || typeof body !== 'string' || !body) return null;
  if (signature !== undefined && typeof signature !== 'string') return null;
  return { subject, body, signature: typeof signature === 'string' ? signature : '' };
}

/**
 * thank_you.send: queues the approved thank-you message once, design §4.7,
 * through the writer the author's own Send uses (MongoDonorThankYous
 * .queueInTransaction inside the publisher fence): the author's account,
 * session, agreement and restrictions; the campaign; the author's role now
 * (owner, an active admin or editor of its organization, or its consenting
 * beneficiary); a restriction on the campaign's organizer; eligibility; the
 * draft still holding exactly this message (otherwise it was edited since:
 * superseded); and the send limit. The publication is recorded in the same
 * transaction. The approval only queues the message: the delivery worker
 * emails each donor once, skipping those refunded or unsubscribed by then.
 */
export function thankYouSendHandler(deps: PublicationApplyDeps): PublicationApplyHandler<DonorThankYouContent> {
  return {
    action: 'thank_you.send',
    parse: parseThankYouProposal,
    commit: async (context) => {
      const { review, proposal, author } = context;
      const settings = await deps.thankYouConfig.resolveThankYouConfig();
      try {
        await deps.donorThankYous.queueApproved({
          reviewId: review.id, actorId: author.id, authVersion: author.authVersion, campaignId: review.resourceId,
          content: proposal, settings, publish: thankYouId => context.publish(thankYouId),
        });
      } catch (error) {
        throw asNotPublished(error, REFUSALS);
      }
    },
  };
}
