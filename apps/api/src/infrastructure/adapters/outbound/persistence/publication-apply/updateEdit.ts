import type { PublicationApplyHandler, PublicationApplyReview } from '../../../../../domain/ports/outbound/PublicationApplyPort.js';
import { PublicationApplyRefusal } from '../../../inbound/middleware/publicationErrors.js';
import { MongoCampaignContentWrite } from '../MongoCampaignContentWrite.js';
import type { PublicationApplyDeps } from './deps.js';
import { approvedFingerprint, notPublished, parseUpdateContent, type UpdateContentProposal } from './campaignContent.js';

interface EditProposal extends UpdateContentProposal {
  /** The update's `updatedAt` the edit was proposed against. */
  baseVersion: Date;
}

/** The update changed (edited, pinned, hidden) since this version was proposed against it. */
const editedSince = () => new PublicationApplyRefusal('superseded', 'edited_since_submitted');

/**
 * update.edit: applies the approved edit onto the exact version of the update
 * it was proposed against, through the campaign content writer
 * (MongoCampaignContentWrite), design §4.3, as the author's own request does
 * (UpdateCampaignUpdateUseCase): the update's author or the campaign's owner,
 * with the same account, organization, restriction and campaign checks. The
 * write is a compare-and-set on the update's `updatedAt`: if anything changed
 * it since (an edit, a pin, a staff hide), the version is superseded. The
 * update keeps its current pin.
 */
export function updateEditHandler(deps: PublicationApplyDeps): PublicationApplyHandler<EditProposal> {
  /** The update and its campaign as they are now; refuses either being gone, or an author who may no longer edit it. */
  async function locate(review: PublicationApplyReview) {
    const update = await deps.campaignUpdateRepo.findById(review.resourceId);
    if (!update) throw notPublished('item_unavailable');
    const campaign = await deps.campaignRepo.findById(update.campaignId);
    if (!campaign) throw notPublished('item_unavailable');
    if (update.authorId !== review.actorId && campaign.creatorId !== review.actorId) throw notPublished('permission_changed');
    return { update, campaignId: update.campaignId, ownerId: campaign.creatorId };
  }

  return {
    action: 'update.edit',
    parse: review => {
      const content = parseUpdateContent(review);
      const baseVersion = review.baseVersion ? new Date(review.baseVersion) : null;
      if (!content || !baseVersion || Number.isNaN(baseVersion.getTime())) return null;
      return { ...content, baseVersion };
    },
    precheck: async ({ review, proposal }) => {
      const { update } = await locate(review);
      if (update.updatedAt.getTime() !== proposal.baseVersion.getTime()) throw editedSince();
    },
    commit: async (context) => {
      const { review, proposal, author } = context;
      const { campaignId, ownerId } = await locate(review);
      await new MongoCampaignContentWrite().run(author.id, author.authVersion, campaignId, ownerId, async () => {
        // The update as this transaction sees it; the campaign fence above has just confirmed its owner.
        const update = await deps.campaignUpdateRepo.findById(review.resourceId);
        if (!update || update.campaignId !== campaignId) throw notPublished('item_unavailable');
        if (update.authorId !== author.id && ownerId !== author.id) throw notPublished('permission_changed');
        update.applyEdits({ title: proposal.title, content: proposal.content, type: proposal.type, mediaUrls: proposal.mediaUrls });
        // A miss is `stale_version`: edited since it was submitted.
        await deps.campaignUpdateRepo.update(update, proposal.baseVersion, { publicationFingerprint: approvedFingerprint(review) });
        await context.publish(review.resourceId, { path: `/campaigns/${campaignId}` });
      });
    },
  };
}
