import type { PublicationApplyContext, PublicationApplyHandler } from '../../../../../domain/ports/outbound/PublicationApplyPort.js';
import { UserModel } from '../../../../database/models/UserModel.js';
import { MongoCommentCreation } from '../MongoCommentCreation.js';
import type { PublicationApplyDeps } from './deps.js';
import {
  COMMENTABLE_STATUSES, approvedFingerprint, commentAvatarOf, notPublished, parseCommentProposal, type CommentProposal,
} from './campaignContent.js';

type Context = PublicationApplyContext<CommentProposal>;

/**
 * comment.create: posts the approved comment through the comment writer
 * (MongoCommentCreation), design §4.1, as the author's own request does
 * (CampaignCommentUseCases.create): the author's account, session, agreement
 * and restrictions, then the campaign (same owner, not deleted, public unless
 * the author owns it), in one transaction with the comment and its
 * publication. The comment carries the attribution that was reviewed: if the
 * author's public name or photo changed since, it is not published.
 */
export function commentCreateHandler(deps: PublicationApplyDeps): PublicationApplyHandler<CommentProposal> {
  /** The campaign as the author's request finds it; refuses one that is gone or no longer public to them. */
  async function campaignOf(review: Context['review']): Promise<{ ownerId: string }> {
    const campaign = await deps.campaignRepo.findById(review.resourceId);
    if (!campaign || (!COMMENTABLE_STATUSES.includes(campaign.status) && campaign.creatorId !== review.actorId)) throw notPublished('item_unavailable');
    return { ownerId: campaign.creatorId };
  }

  return {
    action: 'comment.create',
    parse: parseCommentProposal,
    precheck: async ({ review }) => {
      const { ownerId } = await campaignOf(review);
      if (await deps.userBlocks.isBlocked(review.actorId, ownerId)) throw notPublished('blocked');
    },
    commit: async (context) => {
      const { review, proposal, author } = context;
      const { ownerId } = await campaignOf(review);
      const avatarUrl = commentAvatarOf(review, proposal);
      await new MongoCommentCreation().run(author.id, author.authVersion, review.resourceId, ownerId, async () => {
        // Read in the transaction, after the author's account write.
        const current = await UserModel.findOne({ _id: author.id, deletedAt: null }).select('name avatarUrl').lean();
        if (!current) throw notPublished('account_unavailable');
        if (current.name !== proposal.authorName || (current.avatarUrl ?? '') !== avatarUrl) throw notPublished('identity_changed');
        if (await deps.userBlocks.isBlocked(author.id, ownerId)) throw notPublished('blocked');
        const comment = await deps.commentRepo.create(review.resourceId, author.id, proposal.comment, {
          authorName: proposal.authorName, ...(avatarUrl ? { authorAvatarUrl: avatarUrl } : {}), publicationFingerprint: approvedFingerprint(review),
        });
        await context.publish(comment.id);
      });
    },
  };
}
