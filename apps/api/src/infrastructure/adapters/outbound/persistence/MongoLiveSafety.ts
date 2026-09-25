import { isObjectIdOrHexString } from 'mongoose';
import type { UserBlockRepositoryPort } from '../../../../domain/ports/outbound/UserBlockRepositoryPort.js';
import { isPublicCampaign } from '../../../../domain/services/campaignVisibility.js';
import { CampaignModel } from '../../../database/models/CampaignModel.js';
import { LiveSessionModel } from '../../../database/models/LiveSessionModel.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { UserBlockModel } from '../../../database/models/UserBlockModel.js';
import { ContentRestrictionModel } from '../../../database/models/ContentRestrictionModel.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';
import { logger } from '../../../logging/logger.js';
interface VideoSafety { enabled?: boolean; removeIdentity(sessionId: string, identity: string): Promise<void>; closeRoom(sessionId: string): Promise<void> }
export class MongoLiveSafety {
  constructor(private readonly blocks: UserBlockRepositoryPort) {}
  async recordHostToken(sessionId: string): Promise<void> {
    await LiveSessionModel.updateOne({ _id: sessionId }, { $set: { providerRoomIssuedAt: new Date() } });
  }
  async assertOwnerVisible(ownerId: string, viewerId?: string): Promise<void> {
    if (!await UserModel.exists({ _id: ownerId, deletedAt: { $exists: false } }) || await ContentRestrictionModel.exists({ userId: ownerId }) || (viewerId && await this.blocks.isBlocked(ownerId, viewerId))) throw new AppError('Broadcast unavailable', 404);
  }
  async assertCampaignVisible(campaignId: string, viewerId?: string): Promise<void> {
    // A malformed id is just another unknown broadcast (404), not a 400 CastError.
    if (!isObjectIdOrHexString(campaignId)) throw new AppError('Broadcast unavailable', 404);
    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign || campaign.deletedAt || !isPublicCampaign(campaign.status)) throw new AppError('Broadcast unavailable', 404);
    await this.assertOwnerVisible(campaign.creatorId, viewerId);
  }
  async assertSessionVisible(sessionId: string, viewerId?: string): Promise<void> {
    if (!isObjectIdOrHexString(sessionId)) throw new AppError('Broadcast unavailable', 404);
    const session = await LiveSessionModel.findById(sessionId);
    if (!session || session.moderationStoppedAt) throw new AppError('Broadcast unavailable', 404);
    await this.assertCampaignVisible(session.campaignId, viewerId);
  }
  async stop(sessionId: string, video: VideoSafety): Promise<void> {
    const session = await LiveSessionModel.findById(sessionId);
    if (!session) throw new AppError('Broadcast not found', 404);
    // Stop new token issuance before provider calls. A crash leaves durable work.
    await LiveSessionModel.updateOne({ _id: sessionId }, { $set: { status: 'ended', endedAt: new Date(), moderationStoppedAt: session.moderationStoppedAt ?? new Date(), providerStopPending: true, overlayToken: '', privacyMode: true } });
    await this.finishStop(sessionId, video);
  }
  private async finishStop(sessionId: string, video: VideoSafety): Promise<void> {
    const session = await LiveSessionModel.findById(sessionId);
    if (!session) return;
    if (session.providerRoomIssuedAt && video.enabled === false) throw new AppError('Restore video provider access to finish stopping this broadcast', 503);
    const campaign = await CampaignModel.findById(session.campaignId);
    if (campaign) await video.removeIdentity(sessionId, `host-${campaign.creatorId}`);
    await video.closeRoom(sessionId);
    await LiveSessionModel.updateOne({ _id: sessionId }, { $set: { providerStopPending: false } });
  }
  async enforceBlock(first: string, second: string, video: VideoSafety): Promise<void> {
    const campaigns = await CampaignModel.find({ creatorId: { $in: [first, second] } }).select('_id creatorId');
    for (const campaign of campaigns) {
      const viewer = campaign.creatorId === first ? second : first;
      const sessions = await LiveSessionModel.find({ campaignId: String(campaign._id), status: 'active' }).select('_id providerRoomIssuedAt');
      for (const session of sessions) {
        if (session.providerRoomIssuedAt && video.enabled === false) throw new AppError('Video provider cleanup is pending configuration recovery', 503);
        await video.removeIdentity(String(session._id), `viewer-${viewer}`);
      }
    }
    await UserBlockModel.updateOne({ userId: first, blockedUserId: second }, { $set: { providerCleanupPending: false } });
  }
  async reconcile(video: VideoSafety): Promise<void> {
    for (const session of await LiveSessionModel.find({ providerStopPending: true }).limit(50)) {
      try { await this.finishStop(String(session._id), video); } catch (error) { logger.error({ err: error, sessionId: session.id }, 'Live moderation stop pending provider retry'); }
    }
    for (const block of await UserBlockModel.find({ providerCleanupPending: true }).limit(50)) {
      try { await this.enforceBlock(block.userId, block.blockedUserId, video); } catch (error) { logger.error({ err: error, blockId: block.id }, 'Live block pending provider retry'); }
    }
  }
}
