import { MongoUnitOfWork } from './MongoUnitOfWork.js';
import { hasCurrentLegalAcceptance } from '@ubuntu-fund/types';
import { UserModel } from '../../../database/models/UserModel.js';
import { ContentRestrictionModel } from '../../../database/models/ContentRestrictionModel.js';
import { createHash } from 'node:crypto';
import type { PublicationAdmissionPort, PublicationSubmission, PublicationTextScreener } from '../../../../domain/ports/outbound/PublicationAdmissionPort.js';
import { PublicationReviewModel } from '../../../database/models/PublicationReviewModel.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';

function fingerprintOf(input: PublicationSubmission): string {
  return createHash('sha256').update(JSON.stringify([
    input.actorId, input.action, input.resourceId, input.baseVersion ?? '', input.text, input.mediaUrls,
  ])).digest('hex');
}

export class MongoPublicationAdmission implements PublicationAdmissionPort {
  private readonly uow = new MongoUnitOfWork();
  constructor(private readonly screener: PublicationTextScreener) {}

  async assertCurrent(input: PublicationSubmission): Promise<void> {
    const result = await PublicationReviewModel.updateOne({ fingerprint: fingerprintOf(input), status: 'approved', approvalExpiresAt: { $gt: new Date() } }, { $inc: { consumptionWriteVersion: 1 } });
    if (!result.matchedCount) throw new AppError('The content approval changed or expired. Refresh publication reviews before retrying.', 409);
  }

  async assertAllowed(input: PublicationSubmission): Promise<void> {
    if (!input.text.trim() || input.text.length > 12000 || input.mediaUrls.length > 10 || input.mediaUrls.some(url => url.length > 2000)) throw new AppError('Public content exceeds the review limits.', 400);
    const fingerprint = fingerprintOf(input);
    let review = await PublicationReviewModel.findOne({ fingerprint });
    if (!review) {
      const reason = input.mediaUrls.length ? 'media' : input.automatedReviewConsent === true ? 'screening' : 'staff_requested';
      let created = false;
      try {
        review = await this.uow.run(async () => {
          // Queue insertion must serialize with closure, including teammate-owned organization drafts.
          const subjects = [...new Set([input.actorId, ...(input.action === 'organization.profile' ? [input.resourceId] : [])])].sort();
          for (const subjectId of subjects) {
            const subject = await UserModel.findOneAndUpdate({ _id: subjectId, deletedAt: null }, { $inc: { publicationWriteVersion: 1 } }, { new: true });
            if (!subject || (input.action === 'organization.profile' && subjectId === input.resourceId && subject.role !== 'organization')) throw new AppError('The publishing account is no longer available', 401);
          }
          return PublicationReviewModel.create({
            actorId: input.actorId, action: input.action, resourceId: input.resourceId,
            baseVersion: input.baseVersion, text: input.text, mediaUrls: input.mediaUrls,
            fingerprint, reason, ...(input.automatedReviewConsent === true ? { automatedConsentAt: new Date() } : {}),
          });
        });
        created = true;
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        review = await PublicationReviewModel.findOne({ fingerprint });
      }
      if (created && reason === 'screening') {
        let outcome: 'allowed' | 'flagged' | 'unavailable';
        try { outcome = await this.screener.screen(input.text); }
        catch { outcome = 'unavailable'; }
        // A concurrent staff decision wins; screening may never overwrite it.
        await PublicationReviewModel.updateOne({ fingerprint, status: 'pending', reason: 'screening' }, {
          $set: outcome === 'allowed'
            ? { status: 'approved', reviewedBy: 'automated:openai', reviewedAt: new Date(), approvalExpiresAt: new Date(Date.now() + 7 * 86400000) }
            : { reason: outcome },
        });
        review = await PublicationReviewModel.findOne({ fingerprint });
      }
    }
    if (!review) throw new AppError('The safety review could not be saved. Please try again.', 503);
    if (review.status === 'approved' && review.approvalExpiresAt && review.approvalExpiresAt > new Date()) {
      // Screening may take seconds; authorization state must still be current afterwards.
      const user = await UserModel.findOne({ _id: input.actorId, deletedAt: null }).lean();
      if (!user) throw new AppError('Account is no longer available', 401);
      if (await ContentRestrictionModel.exists({ userId: input.actorId })) throw new AppError('Publishing is restricted. Contact support@ujimora.com to appeal.', 403);
      if (user.role !== 'admin' && !hasCurrentLegalAcceptance(user.legalAcceptance)) throw new AppError('Accept the current account agreement before publishing', 428);
      return;
    }
    if (review.status === 'approved') {
      // Expired approvals cannot silently authorize publication again.
      throw new AppError('This safety approval expired. Revise your draft or contact support@ujimora.com for another review.', 409);
    }
    if (review.status === 'rejected') throw new AppError('This version was declined in safety review. Check Publication reviews, revise your draft, or contact support@ujimora.com to appeal.', 422);
    throw new AppError('Saved privately for safety review. Your content has not been published. Keep your draft and check Publication reviews before submitting this same version again.', 409);
  }
}
