import { createHash } from 'node:crypto';
import { currentCampaignAllowance } from '../../../../domain/services/currentCampaignAllowance.js';
import { MongoKYCRepository } from './MongoKYCRepository.js';
import { LiveSessionModel } from '../../../database/models/LiveSessionModel.js';
import { CampaignStatus, hasCurrentLegalAcceptance, type CampaignContentReviewReason } from '@ubuntu-fund/types';
import type { CampaignReviewPort, ReviewCampaignInput } from '../../../../domain/ports/outbound/CampaignReviewPort.js';
import type { ReviewQueueAlertPort } from '../../../../domain/ports/outbound/ReviewQueueAlertPort.js';
import { campaignReviewSnapshot, campaignReviewVersion } from '../../../../domain/services/campaignReviewVersion.js';
import { campaignCreationSubmission, storedCampaignVersion } from '../../../../domain/services/campaignCreationSubmission.js';
import { publicationFingerprint } from '../../../../domain/services/publicationFingerprint.js';
import type { CampaignEntity } from '../../../../domain/entities/Campaign.js';
import { CampaignModel } from '../../../database/models/CampaignModel.js';
import { CampaignReviewModel } from '../../../database/models/CampaignReviewModel.js';
import { CampaignBeneficiaryInvitationModel } from '../../../database/models/CampaignBeneficiaryInvitationModel.js';
import { PublicationReviewModel } from '../../../database/models/PublicationReviewModel.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { ContentRestrictionModel } from '../../../database/models/ContentRestrictionModel.js';
import { AuditLogModel } from '../../../database/models/AuditLogModel.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';
import { MongoCampaignRepository } from './MongoCampaignRepository.js';
import { MongoUnitOfWork } from './MongoUnitOfWork.js';
import { campaignDecisionNotice, recordStaffDecisionNotice } from './MongoStaffDecisionNotices.js';
import { announceHeldCollaborations } from './MongoHeldCollaborations.js';
import { dropHeldInvitations } from './MongoOnBehalfCampaigns.js';
import { awaitsBeneficiary, consentPublishes, staffAreNext } from './onBehalfPublication.js';
import { logger } from '../../../logging/logger.js';

/** Sends a beneficiary invitation that waited for the content check. */
export interface HeldInvitationRelease {
  releaseHeldInvitation(campaignId: string): Promise<boolean>;
}

/** The publication-review reason that matches why the content waited, for the decline record. */
const DECLINE_REASON: Record<CampaignContentReviewReason, 'media' | 'staff_requested' | 'flagged' | 'unavailable'> = {
  new_media: 'media', no_screening_consent: 'staff_requested', screening_flagged: 'flagged', screening_unavailable: 'unavailable',
};
/** Author-visible in Settings → Publication reviews. Staff decision notes stay internal. */
const DECLINED_NOTE = 'Declined in the campaign review. This exact version cannot be submitted again; revise it to create a new campaign. Contact support@ujimora.com for details or to appeal.';
const NO_HELD_INVITATION = 'No beneficiary invitation is waiting to be sent: its address was removed when the campaign was declined. Ask the organizer to change the beneficiary, then review again.';

const emailHash = (email: string) => createHash('sha256').update(email.trim().toLowerCase()).digest('hex');

/** The exact version staff saw, as a new campaign would submit it (see campaignCreationSubmission). */
function reviewedFingerprint(campaign: CampaignEntity) {
  const p = campaign.toPlain();
  const submission = campaignCreationSubmission(storedCampaignVersion({
    title: p.title, description: p.description, category: p.category, priority: p.priority, beneficiaries: p.beneficiaries,
    goalAmount: p.goalAmount.amount, currency: p.goalAmount.currency, endDate: p.endDate, imageUrls: p.imageUrls,
    ...(campaign.creationMode === 'on_behalf' && p.onBehalf ? { onBehalf: p.onBehalf } : {}),
  }), p.creatorId);
  return { submission, fingerprint: publicationFingerprint(submission) };
}

export class MongoCampaignReview implements CampaignReviewPort {
  /**
   * `invitations`: required to approve an on-behalf campaign whose content waited for staff.
   * `alerts`: tells the review team when a campaign returned to review waits for them.
   */
  constructor(private readonly invitations?: HeldInvitationRelease, private readonly alerts?: ReviewQueueAlertPort) {}

  async decide(input: ReviewCampaignInput) {
    const decided = await new MongoUnitOfWork().run(async () => {
      // A real write serializes concurrent credential/role changes with this decision.
      const staff = await UserModel.findOneAndUpdate({ _id: input.actorId, role: 'admin', deletedAt: null,
        ...(input.authVersion ? { authVersion: input.authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] }),
      }, { $inc: { staffActionVersion: 1 } }, { new: true });
      if (!staff) throw new AppError('Current administrator access is required', 403);
      const repo = new MongoCampaignRepository();
      const campaign = await repo.findById(input.campaignId);
      if (!campaign) throw new AppError('Campaign not found', 404);
      // Nobody reviews a campaign they run or benefit from, including one whose
      // beneficiary invitation (held or sent, not yet answered) is addressed to them.
      if (campaign.creatorId === input.actorId || campaign.onBehalf?.beneficiaryUserId === input.actorId ||
        (campaign.creationMode === 'on_behalf' && await CampaignBeneficiaryInvitationModel.exists({ campaignId: campaign.id, status: { $in: ['held', 'pending'] }, emailHash: emailHash(staff.email) })))
        throw new AppError('Another administrator must review your campaign', 403);
      const prior = await CampaignReviewModel.findOne({ campaignId: input.campaignId, version: input.expectedVersion });
      if (prior) {
        if (prior.actorId === input.actorId && prior.action === input.action && prior.reason === input.reason &&
          !!prior.contentReviewed === !!input.contentReviewed && !!prior.fundraisingReviewed === !!input.fundraisingReviewed) return { campaign, retried: true };
        throw new AppError('A different final decision already exists for this campaign version', 409);
      }
      if (campaignReviewVersion(campaign) !== input.expectedVersion) throw new AppError('The campaign changed. Reload and review the current version.', 409);
      // New content waiting for a person (see CreateCampaignUseCase and a
      // beneficiary change that reopened the check): until this review clears
      // it, nothing about it has left the organizer and staff.
      const contentOutstanding = campaign.contentCheckOutstanding;
      const onBehalf = campaign.creationMode === 'on_behalf' ? campaign.onBehalf : undefined;
      const awaitingConsent = !!onBehalf?.publicationRequiresConsent && onBehalf.consentStatus !== 'accepted';
      let afterStatus: CampaignStatus;
      if (input.action === 'approve') {
        if (campaign.status !== CampaignStatus.PENDING_REVIEW) throw new AppError('Only pending campaigns can be approved', 409);
        if (!input.contentReviewed || !input.fundraisingReviewed) throw new AppError('Confirm review of the complete public content, media and fundraising evidence', 400);
        if (campaign.goalAmount.currency !== 'GHS' || !Number.isFinite(campaign.goalAmount.amount) || campaign.goalAmount.amount <= 0) throw new AppError('A valid positive GHS goal is required before approval', 409);
        if (campaign.isExpired()) throw new AppError('An expired campaign cannot be approved', 409);
        // Locked on at creation: a campaign run on someone's behalf is published
        // only after they accept. Content that waited for staff is the exception
        // to approving first: its invitation is sent only once staff clear the
        // content, so this approval clears it and the campaign stays in review
        // until the beneficiary accepts.
        if (awaitingConsent && !contentOutstanding)
          throw new AppError('The beneficiary has not accepted this campaign yet. It can be approved once they do.', 409);
        const owner = await UserModel.findOneAndUpdate({ _id: campaign.creatorId, deletedAt: null }, { $inc: { publicationWriteVersion: 1 } }, { new: true });
        if (!owner || await ContentRestrictionModel.exists({ userId: campaign.creatorId })) throw new AppError('The organizer is unavailable or publishing is restricted', 409);
        if (owner.role !== 'admin' && !hasCurrentLegalAcceptance(owner.legalAcceptance)) throw new AppError('The organizer must accept the current account agreement first', 409);
        if (owner.verificationLevel === 0 || (owner.complianceApprovedCampaignLimit != null && owner.complianceApprovedCampaignLimit >= 0 && campaign.goalAmount.amount > owner.complianceApprovedCampaignLimit)) throw new AppError('Current organizer verification or compliance limits do not permit approval', 409);
        const allowance = currentCampaignAllowance(owner, await new MongoKYCRepository().findByUserId(campaign.creatorId));
        const campaignCount = await repo.countTowardCampaignAllowance(campaign.creatorId);
        if (campaignCount > allowance) throw new AppError('Current verification evidence does not support this campaign allowance. Renew verification before approval.', 409);
        if (contentOutstanding && onBehalf && !this.invitations) throw new AppError('Beneficiary invitations are unavailable right now. Try again later.', 503);
        afterStatus = awaitingConsent ? CampaignStatus.PENDING_REVIEW : campaign.isFunded() ? CampaignStatus.FUNDED : CampaignStatus.ACTIVE;
      } else if (input.action === 'reopen') {
        if (campaign.status !== CampaignStatus.BLOCKED) throw new AppError('Only blocked campaigns can return to review', 409);
        afterStatus = CampaignStatus.PENDING_REVIEW;
      } else {
        if (input.action === 'reject' && campaign.status !== CampaignStatus.PENDING_REVIEW) throw new AppError('Only pending campaigns can be rejected', 409);
        if (campaign.status === CampaignStatus.BLOCKED) throw new AppError('The campaign is already blocked', 409);
        afterStatus = CampaignStatus.BLOCKED;
      }
      const now = new Date();
      const clearsContent = input.action === 'approve' && contentOutstanding;
      const declinesContent = (input.action === 'reject' || input.action === 'block') && contentOutstanding;
      // After a rejection or block, only a new staff approval publishes the
      // campaign, never consent alone. Applied when it is blocked and again
      // when it returns to review, so a campaign blocked before the block
      // switched this off follows the same rule.
      const consentStops = !!onBehalf && (afterStatus === CampaignStatus.BLOCKED || input.action === 'reopen');
      const snapshot = campaignReviewSnapshot(campaign);
      // Transactions retry on concurrent document writes. Re-read/version validation
      // then prevents stale content approval; this update never replaces balances.
      await CampaignModel.updateOne({ _id: campaign.id }, {
        $set: {
          status: afterStatus,
          ...(clearsContent ? { contentReviewClearedAt: now, contentReviewClearedBy: input.actorId } : {}),
          // Cleared content falls back to the consent rule creation (or the beneficiary change) would have applied.
          ...(clearsContent && awaitingConsent ? { 'onBehalf.autoPublishOnConsent': !!onBehalf?.autoPublishAfterContentCheck } : {}),
          ...(consentStops ? { 'onBehalf.autoPublishOnConsent': false, ...(onBehalf?.autoPublishAfterContentCheck !== undefined ? { 'onBehalf.autoPublishAfterContentCheck': false } : {}) } : {}),
        },
        ...(clearsContent && onBehalf ? { $unset: { 'onBehalf.autoPublishAfterContentCheck': 1 } } : {}),
        $inc: { reviewRevision: 1 },
      });
      if (afterStatus === CampaignStatus.BLOCKED) {
        await LiveSessionModel.updateMany({ campaignId: campaign.id, status: 'active' }, { $set: {
          status: 'ended', endedAt: new Date(), moderationStoppedAt: new Date(), providerStopPending: true, overlayToken: '', privacyMode: true,
        } });
      }
      let publishesOnConsent = false;
      if (clearsContent || declinesContent) {
        const { submission, fingerprint } = reviewedFingerprint(campaign);
        // The version staff saw, and the version as it was submitted when its
        // admission recorded it (they differ only where a stored value was
        // normalized, so the identical request is bound too).
        const fingerprints = [...new Set([fingerprint, campaign.contentAdmission?.fingerprint].filter((value): value is string => !!value))];
        if (declinesContent) {
          // The declined version stays declined: creating it again, even with
          // automated screening, answers 422 like a version declined in
          // Publication reviews. Writing the owner serializes this with a
          // creation of the same version already in flight.
          await UserModel.updateOne({ _id: campaign.creatorId }, { $inc: { publicationWriteVersion: 1 } });
          for (const declined of fingerprints) {
            await PublicationReviewModel.updateOne({ fingerprint: declined }, {
              $set: { status: 'rejected', reviewedBy: input.actorId, reviewedAt: now, reviewNotes: DECLINED_NOTE, campaignId: campaign.id },
              $unset: { approvalExpiresAt: 1 },
              $setOnInsert: { actorId: campaign.creatorId, action: 'campaign.create', resourceId: campaign.creatorId, text: submission.text,
                mediaUrls: submission.mediaUrls, reason: DECLINE_REASON[campaign.contentReviewReason!] },
            }, { upsert: true });
          }
          // The invitation that waited for this content will never be sent: its address goes.
          if (onBehalf) await dropHeldInvitations([campaign.id]);
        } else {
          // Approved after all (reopened): this version is no longer declined.
          await PublicationReviewModel.deleteMany({ fingerprint: { $in: fingerprints }, status: 'rejected', campaignId: campaign.id });
          // Only now may anything about the campaign reach anyone else.
          if (onBehalf) {
            const released = await this.invitations!.releaseHeldInvitation(campaign.id);
            if (!released && onBehalf.consentStatus === 'pending') throw new AppError(NO_HELD_INVITATION, 409);
            if (awaitingConsent) {
              const cleared = await CampaignModel.findById(campaign.id);
              publishesOnConsent = !!cleared && await consentPublishes(cleared);
            }
          }
          await announceHeldCollaborations(campaign.id, campaign.title);
        }
      }
      // Back in review with its invitation withdrawn (see dropHeldInvitations):
      // nobody is left to invite, so the organizer names the beneficiary again
      // before staff can approve it, and the notice says so.
      const beneficiaryNeeded = input.action === 'reopen' && await awaitsBeneficiary({ _id: campaign.id, contentReviewReason: campaign.contentReviewReason, contentReviewClearedAt: campaign.contentReviewClearedAt, onBehalf });
      await CampaignReviewModel.create({ campaignId: campaign.id, ownerId: campaign.creatorId, version: input.expectedVersion,
        actorId: input.actorId, action: input.action, reason: input.reason,
        contentReviewed: !!input.contentReviewed, fundraisingReviewed: !!input.fundraisingReviewed,
        beforeStatus: campaign.status, afterStatus, snapshot });
      await AuditLogModel.create({ actorId: input.actorId, actorRole: 'admin', action: `campaign.${input.action}`, resource: campaign.id,
        details: `Campaign version ${input.expectedVersion} reviewed${clearsContent ? '; content check cleared' : declinesContent ? '; content declined' : ''}`, reason: input.reason,
        changes: [
          { field: 'status', before: campaign.status, after: afterStatus },
          ...(clearsContent ? [{ field: 'contentReviewClearedAt', before: null, after: now }] : []),
          ...(declinesContent ? [{ field: 'contentReview', before: 'outstanding', after: 'declined' }] : []),
        ],
        severity: input.action === 'approve' ? 'info' : 'warning', method: 'PUT', path: '/campaigns/:id/review', statusCode: 200 });
      // Tell the organizer in the same transaction, so a rolled-back decision sends nothing.
      await recordStaffDecisionNotice(campaignDecisionNotice({ campaignId: campaign.id, title: campaign.title, ownerId: campaign.creatorId,
        version: input.expectedVersion, action: input.action,
        ...(clearsContent && awaitingConsent && onBehalf ? { contentCleared: { beneficiaryName: onBehalf.beneficiaryName, publishesOnConsent } } : {}),
        ...(declinesContent ? { contentDeclined: true } : {}), ...(beneficiaryNeeded ? { beneficiaryNeeded: true } : {}) }));
      return { campaign: (await repo.findById(campaign.id))!, retried: false };
    });
    // Back in review with staff to act next (its content waits, with someone
    // to invite once it is cleared, or no consent does) and before its end
    // date: the team is told, as for a new campaign. Not on a retried
    // decision. When the organizer must name the beneficiary again first, the
    // team is told once they have (see MongoOnBehalfCampaigns).
    if (input.action === 'reopen' && !decided.retried && this.alerts) {
      const reopened = await CampaignModel.findById(decided.campaign.id);
      if (reopened && await staffAreNext(reopened)) {
        try {
          await this.alerts.campaignPendingReview({
            campaignId: decided.campaign.id, title: reopened.title, goalAmount: reopened.goalAmount, currency: reopened.currency, tier: reopened.tier ?? 0,
            ...(decided.campaign.contentCheckOutstanding ? { contentReviewReason: reopened.contentReviewReason, contentReviewTrigger: reopened.contentReviewTrigger } : {}),
            occasion: { kind: 'returned_to_review', ref: input.expectedVersion },
          });
        } catch (error) {
          logger.warn({ err: error, campaignId: decided.campaign.id }, 'campaign review alert failed');
        }
      }
    }
    return decided.campaign;
  }
}
