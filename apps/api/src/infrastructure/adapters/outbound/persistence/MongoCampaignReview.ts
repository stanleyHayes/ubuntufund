import { currentCampaignAllowance } from '../../../../domain/services/currentCampaignAllowance.js';
import { MongoKYCRepository } from './MongoKYCRepository.js';
import { LiveSessionModel } from '../../../database/models/LiveSessionModel.js';
import { CampaignStatus, hasCurrentLegalAcceptance } from '@ubuntu-fund/types';
import type { CampaignReviewPort, ReviewCampaignInput } from '../../../../domain/ports/outbound/CampaignReviewPort.js';
import { campaignReviewSnapshot, campaignReviewVersion } from '../../../../domain/services/campaignReviewVersion.js';
import { CampaignModel } from '../../../database/models/CampaignModel.js';
import { CampaignReviewModel } from '../../../database/models/CampaignReviewModel.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { ContentRestrictionModel } from '../../../database/models/ContentRestrictionModel.js';
import { AuditLogModel } from '../../../database/models/AuditLogModel.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';
import { MongoCampaignRepository } from './MongoCampaignRepository.js';
import { MongoUnitOfWork } from './MongoUnitOfWork.js';

export class MongoCampaignReview implements CampaignReviewPort {
  async decide(input: ReviewCampaignInput) {
    return new MongoUnitOfWork().run(async () => {
      // A real write serializes concurrent credential/role changes with this decision.
      const staff = await UserModel.findOneAndUpdate({ _id: input.actorId, role: 'admin', deletedAt: null,
        ...(input.authVersion ? { authVersion: input.authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] }),
      }, { $inc: { staffActionVersion: 1 } }, { new: true });
      if (!staff) throw new AppError('Current administrator access is required', 403);
      const repo = new MongoCampaignRepository();
      const campaign = await repo.findById(input.campaignId);
      if (!campaign) throw new AppError('Campaign not found', 404);
      if (campaign.creatorId === input.actorId) throw new AppError('Another administrator must review your campaign', 403);
      const prior = await CampaignReviewModel.findOne({ campaignId: input.campaignId, version: input.expectedVersion });
      if (prior) {
        if (prior.actorId === input.actorId && prior.action === input.action && prior.reason === input.reason &&
          !!prior.contentReviewed === !!input.contentReviewed && !!prior.fundraisingReviewed === !!input.fundraisingReviewed) return campaign;
        throw new AppError('A different final decision already exists for this campaign version', 409);
      }
      if (campaignReviewVersion(campaign) !== input.expectedVersion) throw new AppError('The campaign changed. Reload and review the current version.', 409);
      let afterStatus: CampaignStatus;
      if (input.action === 'approve') {
        if (campaign.status !== CampaignStatus.PENDING_REVIEW) throw new AppError('Only pending campaigns can be approved', 409);
        if (!input.contentReviewed || !input.fundraisingReviewed) throw new AppError('Confirm review of the complete public content, media and fundraising evidence', 400);
        if (campaign.goalAmount.currency !== 'GHS' || !Number.isFinite(campaign.goalAmount.amount) || campaign.goalAmount.amount <= 0) throw new AppError('A valid positive GHS goal is required before approval', 409);
        if (campaign.isExpired()) throw new AppError('An expired campaign cannot be approved', 409);
        const owner = await UserModel.findOneAndUpdate({ _id: campaign.creatorId, deletedAt: null }, { $inc: { publicationWriteVersion: 1 } }, { new: true });
        if (!owner || await ContentRestrictionModel.exists({ userId: campaign.creatorId })) throw new AppError('The organizer is unavailable or publishing is restricted', 409);
        if (owner.role !== 'admin' && !hasCurrentLegalAcceptance(owner.legalAcceptance)) throw new AppError('The organizer must accept the current account agreement first', 409);
        if (owner.verificationLevel === 0 || (owner.complianceApprovedCampaignLimit != null && owner.complianceApprovedCampaignLimit >= 0 && campaign.goalAmount.amount > owner.complianceApprovedCampaignLimit)) throw new AppError('Current organizer verification or compliance limits do not permit approval', 409);
        const allowance = currentCampaignAllowance(owner, await new MongoKYCRepository().findByUserId(campaign.creatorId));
        const campaignCount = await repo.countByCreatorId(campaign.creatorId);
        if (campaignCount > allowance) throw new AppError('Current verification evidence does not support this campaign allowance. Renew verification before approval.', 409);
        afterStatus = campaign.isFunded() ? CampaignStatus.FUNDED : CampaignStatus.ACTIVE;
      } else if (input.action === 'reopen') {
        if (campaign.status !== CampaignStatus.BLOCKED) throw new AppError('Only blocked campaigns can return to review', 409);
        afterStatus = CampaignStatus.PENDING_REVIEW;
      } else {
        if (input.action === 'reject' && campaign.status !== CampaignStatus.PENDING_REVIEW) throw new AppError('Only pending campaigns can be rejected', 409);
        if (campaign.status === CampaignStatus.BLOCKED) throw new AppError('The campaign is already blocked', 409);
        afterStatus = CampaignStatus.BLOCKED;
      }
      const snapshot = campaignReviewSnapshot(campaign);
      // Transactions retry on concurrent document writes. Re-read/version validation
      // then prevents stale content approval; this update never replaces balances.
      await CampaignModel.updateOne({ _id: campaign.id }, { $set: { status: afterStatus }, $inc: { reviewRevision: 1 } });
      if (afterStatus === CampaignStatus.BLOCKED) {
        await LiveSessionModel.updateMany({ campaignId: campaign.id, status: 'active' }, { $set: {
          status: 'ended', endedAt: new Date(), moderationStoppedAt: new Date(), providerStopPending: true, overlayToken: '', privacyMode: true,
        } });
      }
      await CampaignReviewModel.create({ campaignId: campaign.id, ownerId: campaign.creatorId, version: input.expectedVersion,
        actorId: input.actorId, action: input.action, reason: input.reason,
        contentReviewed: !!input.contentReviewed, fundraisingReviewed: !!input.fundraisingReviewed,
        beforeStatus: campaign.status, afterStatus, snapshot });
      await AuditLogModel.create({ actorId: input.actorId, actorRole: 'admin', action: `campaign.${input.action}`, resource: campaign.id,
        details: `Campaign version ${input.expectedVersion} reviewed`, reason: input.reason,
        changes: [{ field: 'status', before: campaign.status, after: afterStatus }],
        severity: input.action === 'approve' ? 'info' : 'warning', method: 'PUT', path: '/campaigns/:id/review', statusCode: 200 });
      return (await repo.findById(campaign.id))!;
    });
  }
}
