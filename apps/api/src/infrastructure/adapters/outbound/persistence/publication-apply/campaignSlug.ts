import type { PublicationOutcomeReason } from '@ubuntu-fund/types';
import type { PublicationApplyHandler, PublicationApplyReview } from '../../../../../domain/ports/outbound/PublicationApplyPort.js';
import { slugify } from '../../../../../application/utils/slug.js';
import { MongoCampaignSlugWrite } from '../MongoCampaignSlugWrite.js';
import type { PublicationApplyDeps } from './deps.js';
import { asNotPublished } from './writerRefusal.js';

interface SlugProposal {
  /** The approved address. */
  slug: string;
  /** The address it was proposed against ('' when the campaign had none). */
  expectedSlug: string;
}

/** Why the slug writer refuses an approved address besides its fences (MongoCampaignSlugWrite). */
const REFUSALS: ReadonlySet<PublicationOutcomeReason> = new Set<PublicationOutcomeReason>(['item_unavailable', 'address_taken']);

/** campaign.slug's stored version: the new address as text, the old one as its base. Null when the text is no address. */
function parseSlugProposal(review: PublicationApplyReview): SlugProposal | null {
  const slug = review.text;
  if (review.mediaUrls.length || !slug || slugify(slug) !== slug) return null;
  return { slug, expectedSlug: review.baseVersion ?? '' };
}

/**
 * campaign.slug: moves the campaign to the approved web address, design
 * §4.8, through the writer the owner's own request uses
 * (MongoCampaignSlugWrite, inside the publisher fence): the author's
 * account, session, agreement and restriction; the campaign (not deleted);
 * the author still its owner or a platform administrator; the address still
 * valid, unreserved and not held, now or before, by another campaign; and a
 * compare-and-set on the address it was proposed against (otherwise it
 * changed since: superseded). The old address keeps working. The
 * publication is recorded in the same transaction.
 */
export function campaignSlugHandler(deps: PublicationApplyDeps): PublicationApplyHandler<SlugProposal> {
  const writer = new MongoCampaignSlugWrite(deps.campaignRepo);
  return {
    action: 'campaign.slug',
    parse: parseSlugProposal,
    commit: async (context) => {
      const { review, proposal, author } = context;
      try {
        await writer.write({
          actorId: author.id, authVersion: author.authVersion, campaignId: review.resourceId,
          expectedSlug: proposal.expectedSlug, slug: proposal.slug, reviewId: review.id,
          recordPublication: () => context.publish(review.resourceId),
        });
      } catch (error) {
        throw asNotPublished(error, REFUSALS);
      }
    },
  };
}
