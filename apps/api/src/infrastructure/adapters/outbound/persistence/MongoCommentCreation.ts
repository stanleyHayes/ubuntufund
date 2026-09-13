import type { CommentCreationPort } from '../../../../domain/ports/outbound/CommentCreationPort.js';
import { MongoCampaignCreation } from './MongoCampaignCreation.js';
import { CampaignModel } from '../../../database/models/CampaignModel.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';

export class MongoCommentCreation implements CommentCreationPort {
  async run<T>(authorId: string, authVersion: string, campaignId: string, ownerId: string, work: () => Promise<T>): Promise<T> {
    return new MongoCampaignCreation().run(authorId, authVersion, async () => {
      const result = await CampaignModel.updateOne({ _id: campaignId, creatorId: ownerId, deletedAt: null,
        ...(authorId === ownerId ? {} : { status: { $in: ['active', 'funded', 'expired'] } }),
      }, { $inc: { commentCreationWriteVersion: 1 } }, { timestamps: false });
      if (!result.matchedCount) throw new AppError('The campaign is no longer available for this comment.', 409);
      return work();
    });
  }
}
