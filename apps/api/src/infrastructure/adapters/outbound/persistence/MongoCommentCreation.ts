import type { CommentCreationPort } from '../../../../domain/ports/outbound/CommentCreationPort.js';
import { MongoCampaignCreation } from './MongoCampaignCreation.js';
import { CampaignModel } from '../../../database/models/CampaignModel.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';

/**
 * The comment writer: the publisher fence, then the campaign fence (same
 * owner, not deleted, and public unless the author owns it), then `work`, in
 * one transaction. Used by the comment route and by publishing on approval.
 */
export class MongoCommentCreation implements CommentCreationPort {
  async run<T>(authorId: string, authVersion: string, campaignId: string, ownerId: string, work: () => Promise<T>): Promise<T> {
    return new MongoCampaignCreation().run(authorId, authVersion, async () => {
      const result = await CampaignModel.updateOne({ _id: campaignId, creatorId: ownerId, deletedAt: null,
        ...(authorId === ownerId ? {} : { status: { $in: ['active', 'funded', 'expired'] } }),
      }, { $inc: { commentCreationWriteVersion: 1 } }, { timestamps: false });
      if (!result.matchedCount) throw new AppError('The campaign is no longer available for this comment.', 409, undefined, 'campaign_unavailable');
      return work();
    });
  }
}
