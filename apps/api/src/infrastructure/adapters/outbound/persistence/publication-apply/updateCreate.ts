import type { PublicationApplyHandler, PublicationApplyReview } from '../../../../../domain/ports/outbound/PublicationApplyPort.js';
import { CampaignUpdateEntity } from '../../../../../domain/entities/CampaignUpdate.js';
import { MongoCampaignContentWrite } from '../MongoCampaignContentWrite.js';
import type { PublicationApplyDeps } from './deps.js';
import { approvedFingerprint, notPublished, parseUpdateContent, type UpdateContentProposal } from './campaignContent.js';

/**
 * update.create: posts the approved campaign update through the campaign
 * content writer (MongoCampaignContentWrite), design §4.2, as the author's
 * own request does: the owner's route when the author owns the campaign, the
 * organization's route otherwise (the organization open, the author still an
 * active admin or editor, neither restricted). Pinned as the author last
 * asked (`applyOptions`). The campaign's status is not checked, as today.
 */
export function updateCreateHandler(deps: PublicationApplyDeps): PublicationApplyHandler<UpdateContentProposal> {
  /** The campaign's owner; refuses a campaign that is gone. */
  async function ownerOf(review: PublicationApplyReview): Promise<string> {
    const campaign = await deps.campaignRepo.findById(review.resourceId);
    if (!campaign) throw notPublished('item_unavailable');
    return campaign.creatorId;
  }

  return {
    action: 'update.create',
    parse: parseUpdateContent,
    precheck: async ({ review }) => { await ownerOf(review); },
    commit: async (context) => {
      const { review, proposal, author } = context;
      const ownerId = await ownerOf(review);
      await new MongoCampaignContentWrite().run(author.id, author.authVersion, review.resourceId, ownerId, async () => {
        const now = new Date();
        const update = await deps.campaignUpdateRepo.save(new CampaignUpdateEntity({
          id: '', campaignId: review.resourceId, authorId: author.id,
          title: proposal.title, content: proposal.content, type: proposal.type, mediaUrls: proposal.mediaUrls,
          isPinned: review.applyOptions?.isPinned === true, createdAt: now, updatedAt: now,
        }), { publicationFingerprint: approvedFingerprint(review) });
        await context.publish(update.id);
      });
    },
  };
}
