import { MongoUnitOfWork } from './MongoUnitOfWork.js';
import { hasCurrentLegalAcceptance } from '@ubuntu-fund/types';
import { UserModel } from '../../../database/models/UserModel.js';
import { ContentRestrictionModel } from '../../../database/models/ContentRestrictionModel.js';
import type { CampaignAdmission, CampaignAdmissionEvidence, CampaignChangeContext, PublicationAdmissionPort, PublicationSubmission, PublicationTextScreener } from '../../../../domain/ports/outbound/PublicationAdmissionPort.js';
import { PublicationReviewModel } from '../../../database/models/PublicationReviewModel.js';
import { AuditLogModel } from '../../../database/models/AuditLogModel.js';
import { publicationFingerprint } from '../../../../domain/services/publicationFingerprint.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';
import { logger } from '../../../logging/logger.js';

/** How long an approval authorizes the exact reviewed version. */
const APPROVAL_TTL_MS = 7 * 86400000;
/** Private review records (and their drafts) are purged after this. */
const REVIEW_RETENTION_MS = 30 * 86400000;

const fingerprintOf = publicationFingerprint;

const declined = () => new AppError('This version was declined in safety review. Check Publication reviews, revise your draft, or contact support@ujimora.com to appeal.', 422);

export class MongoPublicationAdmission implements PublicationAdmissionPort {
  private readonly uow = new MongoUnitOfWork();
  constructor(private readonly screener: PublicationTextScreener) {}

  async assertCurrent(input: PublicationSubmission): Promise<void> {
    const result = await PublicationReviewModel.updateOne({ fingerprint: fingerprintOf(input), status: 'approved', approvalExpiresAt: { $gt: new Date() } }, { $inc: { consumptionWriteVersion: 1 } });
    if (!result.matchedCount) throw new AppError('The content approval changed or expired. Refresh publication reviews before retrying.', 409);
  }

  /** Queue insertion (and re-queueing) must serialize with closure, including teammate-owned organization drafts. */
  private async lockSubjects(input: PublicationSubmission): Promise<void> {
    const subjects = [...new Set([input.actorId, ...(input.action === 'organization.profile' ? [input.resourceId] : [])])].sort();
    for (const subjectId of subjects) {
      const subject = await UserModel.findOneAndUpdate({ _id: subjectId, deletedAt: null }, { $inc: { publicationWriteVersion: 1 } }, { new: true });
      if (!subject || (input.action === 'organization.profile' && subjectId === input.resourceId && subject.role !== 'organization')) throw new AppError('The publishing account is no longer available', 401);
    }
  }

  private assertWithinLimits(input: PublicationSubmission): void {
    if (!input.text.trim() || input.text.length > 12000 || input.mediaUrls.length > 10 || input.mediaUrls.some(url => url.length > 2000)) throw new AppError('Public content exceeds the review limits.', 400);
  }

  /** The author must still exist, be free to publish and have accepted the current terms. */
  private async assertMayPublish(actorId: string): Promise<void> {
    const user = await UserModel.findOne({ _id: actorId, deletedAt: null }).lean();
    if (!user) throw new AppError('Account is no longer available', 401);
    if (await ContentRestrictionModel.exists({ userId: actorId })) throw new AppError('Publishing is restricted. Contact support@ujimora.com to appeal.', 403);
    if (user.role !== 'admin' && !hasCurrentLegalAcceptance(user.legalAcceptance)) throw new AppError('Accept the current account agreement before publishing', 428);
  }

  /** A provider failure is 'unavailable', never an approval. */
  private async screenText(fingerprint: string, input: PublicationSubmission): Promise<'allowed' | 'flagged' | 'unavailable'> {
    try { return await this.screener.screen(input.text); }
    catch (error) {
      // Not silent: without a screener every opted-in submission waits for staff.
      logger.warn({ err: error, fingerprint, action: input.action }, 'Publication screener unavailable; routed to staff review');
      return 'unavailable';
    }
  }

  private async screen(fingerprint: string, input: PublicationSubmission): Promise<void> {
    const outcome = await this.screenText(fingerprint, input);
    // A concurrent staff decision wins; screening may never overwrite it.
    await PublicationReviewModel.updateOne({ fingerprint, status: 'pending', reason: 'screening' }, {
      $set: outcome === 'allowed'
        ? { status: 'approved', reviewedBy: 'automated:openai', reviewedAt: new Date(), approvalExpiresAt: new Date(Date.now() + APPROVAL_TTL_MS) }
        : { reason: outcome },
    });
  }

  async assertAllowed(input: PublicationSubmission): Promise<void> {
    this.assertWithinLimits(input);
    const fingerprint = fingerprintOf(input);
    const reason = input.mediaUrls.length ? 'media' : input.automatedReviewConsent === true ? 'screening' : 'staff_requested';
    let review = await PublicationReviewModel.findOne({ fingerprint });
    if (!review) {
      let created = false;
      try {
        review = await this.uow.run(async () => {
          await this.lockSubjects(input);
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
        await this.screen(fingerprint, input);
        review = await PublicationReviewModel.findOne({ fingerprint });
      }
    } else if (review.status === 'approved' && !(review.approvalExpiresAt && review.approvalExpiresAt > new Date())) {
      // An expired approval cannot silently authorize publication again, but
      // it must not block this exact version until the record is purged
      // either: the same weekly live title, say. Re-queue it for a fresh
      // decision (screening when consented, otherwise staff), atomically so
      // only one request re-queues it and a concurrent decision is never lost.
      const now = new Date();
      const requeued = await this.uow.run(async () => {
        await this.lockSubjects(input);
        return PublicationReviewModel.updateOne(
          { fingerprint, status: 'approved', $or: [{ approvalExpiresAt: { $lte: now } }, { approvalExpiresAt: null }] },
          {
            $set: { status: 'pending', reason, purgeAt: new Date(now.getTime() + REVIEW_RETENTION_MS), ...(input.automatedReviewConsent === true ? { automatedConsentAt: now } : {}) },
            $unset: { reviewedBy: 1, reviewedAt: 1, reviewNotes: 1, approvalExpiresAt: 1, ...(input.automatedReviewConsent === true ? {} : { automatedConsentAt: 1 }) },
          },
        );
      });
      if (requeued.modifiedCount && reason === 'screening') await this.screen(fingerprint, input);
      review = await PublicationReviewModel.findOne({ fingerprint });
    }
    if (!review) throw new AppError('The safety review could not be saved. Please try again.', 503);
    if (review.status === 'approved' && review.approvalExpiresAt && review.approvalExpiresAt > new Date()) {
      // Screening may take seconds; authorization state must still be current afterwards.
      await this.assertMayPublish(input.actorId);
      return;
    }
    if (review.status === 'rejected') throw declined();
    // `errors.publication` lets clients show this as a neutral "waiting for review" notice, not a failure.
    throw new AppError('Saved privately for safety review. Your content has not been published. Keep your draft and check Publication reviews before submitting this same version again.', 409, { publication: ['held'] });
  }

  /**
   * New campaigns are never held as private proposals: content a person must
   * check is created as a pending_review campaign for the campaign staff
   * review instead. Writes nothing; the checks run before any campaign exists
   * (or, for a beneficiary change, before the change is stored).
   */
  async admitCampaign(input: PublicationSubmission, options: { mediaReviewed?: boolean } = {}): Promise<CampaignAdmission> {
    if (input.action !== 'campaign.create') throw new AppError('Campaign admission only applies to new campaigns', 500);
    this.assertWithinLimits(input);
    await this.assertMayPublish(input.actorId);
    const fingerprint = fingerprintOf(input);
    const consented = input.automatedReviewConsent === true;
    const review = await PublicationReviewModel.findOne({ fingerprint }).lean();
    if (review?.status === 'rejected') throw declined();
    const evidence: CampaignAdmissionEvidence = {
      fingerprint,
      ...(consented ? { automatedConsentAt: new Date() } : {}),
      ...(review ? { priorReviewId: String(review._id), priorReviewReason: review.reason } : {}),
    };
    // Approved as a proposal before this flow existed, and not yet expired.
    if (review?.status === 'approved' && review.approvalExpiresAt && review.approvalExpiresAt > new Date()) return { outcome: 'approved', basis: 'prior_approval', evidence };
    // A proposal of this exact version that screening flagged under the earlier
    // flow, still waiting for staff: the flag goes to staff with the campaign.
    // It is never screened again, so a later answer cannot clear it.
    if (review?.status === 'pending' && review.reason === 'flagged') return { outcome: 'staff_review', reason: 'screening_flagged', evidence };
    // New media always needs a person; it is never sent to the text screener.
    // A changed campaign keeps media a person already checked: only its text is new.
    if (input.mediaUrls.length && !options.mediaReviewed) return { outcome: 'staff_review', reason: 'new_media', evidence };
    if (!consented) return { outcome: 'staff_review', reason: 'no_screening_consent', evidence };
    const outcome = await this.screenText(fingerprint, input);
    const screened: CampaignAdmissionEvidence = { ...evidence, screenedAt: new Date(), screener: this.screener.label ?? 'automated' };
    // Screening may take seconds; authorization state must still be current afterwards.
    await this.assertMayPublish(input.actorId);
    if (outcome === 'allowed') return { outcome: 'approved', basis: 'screening', evidence: screened };
    return { outcome: 'staff_review', reason: outcome === 'flagged' ? 'screening_flagged' : 'screening_unavailable', evidence: screened };
  }

  async commitCampaign(input: PublicationSubmission, admission: CampaignAdmission, campaignId: string, change?: CampaignChangeContext): Promise<void> {
    const fingerprint = fingerprintOf(input);
    // Staff may have declined this exact version since the admission read it.
    if (await PublicationReviewModel.exists({ fingerprint, status: 'rejected' })) throw declined();
    if (admission.outcome === 'approved' && admission.basis === 'prior_approval') {
      // The earlier approval must still be current; the write serializes with
      // a concurrent decision on it, as for every other approved publication.
      await this.assertCurrent(input);
    } else {
      // A proposal for this version still waiting from the old flow would ask
      // staff to review the same content twice; the campaign now carries it,
      // with its id and reason in the admission evidence.
      await PublicationReviewModel.deleteOne({ fingerprint, status: 'pending' });
    }
    const { evidence } = admission;
    // The evidence a later investigation needs: how the content was admitted,
    // whether the organizer consented to screening, and what screened it.
    const subject = change ? 'Changed beneficiary details' : 'Content';
    await AuditLogModel.create({
      actorId: change?.actorId ?? input.actorId, action: 'campaign.content_admission', resource: campaignId,
      details: admission.outcome === 'approved'
        ? admission.basis === 'screening' ? `${subject} admitted by automated screening, which the organizer consented to` : `${subject} admitted under an earlier publication-review approval of this exact version`
        : `${subject} held for the campaign staff review: ${admission.reason}`,
      changes: [
        ...(change ? [{ field: 'contentAdmission.trigger', before: null, after: 'beneficiary_change' }] : []),
        { field: 'contentAdmission.basis', before: null, after: admission.outcome === 'approved' ? admission.basis : 'staff_review' },
        ...(admission.outcome === 'staff_review' ? [{ field: 'contentReviewReason', before: null, after: admission.reason }] : []),
        { field: 'contentAdmission.fingerprint', before: null, after: evidence.fingerprint },
        ...(evidence.automatedConsentAt ? [{ field: 'contentAdmission.automatedConsentAt', before: null, after: evidence.automatedConsentAt }] : []),
        ...(evidence.screenedAt ? [{ field: 'contentAdmission.screenedAt', before: null, after: evidence.screenedAt }, { field: 'contentAdmission.screener', before: null, after: evidence.screener }] : []),
        ...(evidence.priorReviewId ? [{ field: 'contentAdmission.priorReviewId', before: null, after: evidence.priorReviewId }] : []),
      ],
      severity: admission.outcome === 'approved' ? 'info' : 'warning',
      ...(change ? { method: 'PUT', path: '/campaigns/:id/beneficiary', statusCode: 200 } : { method: 'POST', path: '/campaigns', statusCode: 201 }),
    });
  }
}
