import type { Types } from 'mongoose';
import { MongoUnitOfWork } from './MongoUnitOfWork.js';
import {
  CLOSED_PUBLISH_STATES, OPEN_PUBLISH_STATES, canWithdrawPublication, hasCurrentLegalAcceptance,
  isAutoPublishAction, isCreateAction, isSingleItemAction, publicationOutcomeCopy,
} from '@ubuntu-fund/types';
import { UserModel } from '../../../database/models/UserModel.js';
import { ContentRestrictionModel } from '../../../database/models/ContentRestrictionModel.js';
import type { CampaignAdmission, CampaignAdmissionEvidence, CampaignChangeContext, PublicationAdmissionPort, PublicationConsumption, PublicationSubmission, PublicationTextScreener } from '../../../../domain/ports/outbound/PublicationAdmissionPort.js';
import { PublicationReviewModel } from '../../../database/models/PublicationReviewModel.js';
import { AuditLogModel } from '../../../database/models/AuditLogModel.js';
import { publicationFingerprint } from '../../../../domain/services/publicationFingerprint.js';
import { credentialDigest } from '../../../../domain/services/publicationCredential.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';
import { PublicationAlreadyPublished, publicationHeld } from '../../inbound/middleware/publicationErrors.js';
import { recordStaffDecisionNotice } from './MongoStaffDecisionNotices.js';
import { logger } from '../../../logging/logger.js';

/** How long an approval authorizes the exact reviewed version. */
const APPROVAL_TTL_MS = 7 * 86400000;
/** Private review records (and their drafts) are purged after this. */
const REVIEW_RETENTION_MS = 30 * 86400000;

const fingerprintOf = publicationFingerprint;

const declined = () => new AppError('This version was declined in safety review. Check Publication reviews, revise your draft, or contact support@ujimora.com to appeal.', 422);
const changedOrExpired = () => new AppError('The content approval changed or expired. Refresh publication reviews before retrying.', 409);

/** Where an author follows their reviews (the native app resolves it to Settings). */
const REVIEWS_PATH = '/settings#privacy';
/** Publish states after which this approval can never publish (again). */
const CLOSED_STATES: ReadonlySet<unknown> = new Set(CLOSED_PUBLISH_STATES);
const OPEN_STATES = [...OPEN_PUBLISH_STATES];

/**
 * The submission route of each publish-on-approval action, for the audits its
 * submissions write (a version it supersedes, a version its author publishes).
 */
const SUBMISSION_ROUTES: Readonly<Record<string, { method: string; path: string }>> = {
  'account.profile': { method: 'PUT', path: '/profile' },
  'creator.profile': { method: 'POST', path: '/creators/profile' },
  'organization.profile': { method: 'PUT', path: '/organization-team/:organizationId/profile' },
  'campaign.slug': { method: 'PATCH', path: '/campaigns/:id/slug' },
  'update.edit': { method: 'PUT', path: '/campaigns/:id/updates/:updateId' },
  'thank_you.send': { method: 'POST', path: '/campaigns/:id/thank-you/send' },
  'comment.create': { method: 'POST', path: '/campaigns/:id/comments' },
  'update.create': { method: 'POST', path: '/campaigns/:id/updates' },
};
const routeOf = (action: string) => SUBMISSION_ROUTES[action] ?? { method: 'POST', path: '/publication-reviews' };

/** The fields of a review record the admission decides on. */
interface ReviewState {
  _id: Types.ObjectId;
  action: string;
  status: string;
  reason?: string | null;
  approvalExpiresAt?: Date | null;
  publishOnApproval?: boolean | null;
  publishState?: string | null;
  publishedResourceId?: string | null;
}

type ReviewReason = 'staff_requested' | 'media' | 'screening' | 'flagged' | 'unavailable';

const isUnexpired = (review: ReviewState, now: Date) => !!review.approvalExpiresAt && review.approvalExpiresAt > now;

/**
 * A closed version that submitting it again opens for a fresh decision:
 * closed before a decision (superseded, withdrawn), an approval that was
 * superseded, withdrawn or expired without publishing, and, for the actions
 * that change an existing item, a version already published once (an
 * A→X→A→X round trip). A published create-type version is never reopened:
 * the same version would be posted twice.
 */
function isReopenable(review: ReviewState, now: Date): boolean {
  if (review.status === 'superseded' || review.status === 'withdrawn') return true;
  if (review.status !== 'approved') return false;
  if (review.publishState === 'superseded' || review.publishState === 'withdrawn') return true;
  if (review.publishState === 'published') return isAutoPublishAction(review.action) && !isCreateAction(review.action);
  return !isUnexpired(review, now);
}

/** The same states as isReopenable, as one atomic filter, so only one request reopens a version and a concurrent decision is never lost. */
function reopenFilter(fingerprint: string, action: string, now: Date) {
  return {
    fingerprint,
    $or: [
      { status: { $in: ['superseded', 'withdrawn'] } },
      { status: 'approved', publishState: { $in: ['superseded', 'withdrawn'] } },
      { status: 'approved', publishState: { $ne: 'published' }, $or: [{ approvalExpiresAt: { $lte: now } }, { approvalExpiresAt: null }] },
      ...(isAutoPublishAction(action) && !isCreateAction(action) ? [{ status: 'approved', publishState: 'published' }] : []),
    ],
  };
}

/** update.create only: how its approval publishes it (latest submission wins). */
const applyOptionsOf = (input: PublicationSubmission) =>
  input.action === 'update.create' && input.applyOptions ? { isPinned: input.applyOptions.isPinned === true } : undefined;

/** Everything a publication attempt or an earlier decision left on a version that is opened again. */
const PUBLICATION_FIELDS = {
  publishState: 1, publishReason: 1, publishStateAt: 1, publishedVia: 1, publishedResourceId: 1, publishAttempts: 1,
  publishNextAt: 1, publishLeaseUntil: 1, publishLeaseToken: 1, supersededBy: 1, closedAt: 1,
} as const;

/** An earlier version of the item a newer submission replaces. */
interface EarlierVersion { _id: Types.ObjectId; actorId: string; action: string; status: string; publishState?: string | null }

/**
 * Closes a version still waiting for a decision, or stops an approved one not
 * yet published; false when it changed meanwhile. A publishing attempt in
 * progress loses its lease, so its own publish step can no longer match.
 */
async function closeAsSuperseded(version: EarlierVersion, newerId: string, now: Date): Promise<boolean> {
  const changed = version.status === 'pending'
    ? await PublicationReviewModel.updateOne({ _id: version._id, status: 'pending' }, { $set: { status: 'superseded', supersededBy: newerId, closedAt: now } })
    : await PublicationReviewModel.updateOne({ _id: version._id, status: 'approved', publishState: { $in: OPEN_STATES } }, {
      $set: { publishState: 'superseded', publishReason: 'newer_version_submitted', publishStateAt: now, supersededBy: newerId },
      $unset: { publishNextAt: 1, publishLeaseUntil: 1, publishLeaseToken: 1 },
    });
  return changed.modifiedCount > 0;
}

/**
 * An approval superseded, or another author's version superseded, is
 * audited; another author is told in the app. Neither carries the content.
 */
async function reportSupersession(input: PublicationSubmission, version: EarlierVersion, newerId: string, actorRole: string | undefined, now: Date): Promise<void> {
  const id = String(version._id);
  const beforeDecision = version.status === 'pending';
  const otherAuthor = version.actorId !== input.actorId;
  if (otherAuthor || !beforeDecision) {
    const route = routeOf(input.action);
    await AuditLogModel.create({
      actorId: input.actorId, ...(actorRole ? { actorRole } : {}), action: 'publication.superseded', resource: id,
      details: beforeDecision ? 'A newer version of the same item replaced this one before a decision' : 'A newer version of the same item replaced this approved version before it was published',
      changes: [
        beforeDecision ? { field: 'status', before: 'pending', after: 'superseded' } : { field: 'publishState', before: version.publishState ?? null, after: 'superseded' },
        { field: 'supersededBy', before: null, after: newerId },
      ],
      // 202: the newer version was accepted for review.
      severity: 'info', method: route.method, path: route.path, statusCode: 202,
    });
  }
  if (otherAuthor) {
    const copy = publicationOutcomeCopy({ action: version.action, state: 'superseded', reason: 'newer_version_submitted' });
    // `now` is fixed outside the transaction: a retried callback writes the same notice once.
    await recordStaffDecisionNotice({ key: `publication-review:${id}:${newerId}:${now.getTime()}:superseded`, userId: version.actorId, title: copy.title, body: copy.body, path: REVIEWS_PATH });
  }
}

/** The review a version starts with: media always needs a person; consented text is screened. */
const reviewReasonOf = (input: PublicationSubmission): ReviewReason => {
  if (input.mediaUrls.length) return 'media';
  return input.automatedReviewConsent === true ? 'screening' : 'staff_requested';
};

export interface PublicationAdmissionOptions {
  /**
   * Whether publishing on approval is switched on (PUBLISH_ON_APPROVAL_ENABLED),
   * read on every submission. Off by default: versions held while it is off
   * keep "approve, then the author submits again" for good.
   */
  publishOnApproval?: () => boolean;
}

export class MongoPublicationAdmission implements PublicationAdmissionPort {
  private readonly uow = new MongoUnitOfWork();
  private readonly publishOnApproval: () => boolean;
  constructor(private readonly screener: PublicationTextScreener, options: PublicationAdmissionOptions = {}) {
    this.publishOnApproval = options.publishOnApproval ?? (() => false);
  }

  /**
   * Inside the caller's transaction. Live sessions and campaign proposals
   * keep reusable approvals until they expire. The publish-on-approval
   * actions consume theirs: the version is recorded as published by the
   * author, and audited, unless it was published, superseded or withdrawn
   * meanwhile.
   */
  async assertCurrent(input: PublicationSubmission, consumption: PublicationConsumption = {}): Promise<void> {
    const fingerprint = fingerprintOf(input);
    const now = new Date();
    if (!isAutoPublishAction(input.action)) {
      const result = await PublicationReviewModel.updateOne({ fingerprint, status: 'approved', approvalExpiresAt: { $gt: now } }, { $inc: { consumptionWriteVersion: 1 } });
      if (!result.matchedCount) throw changedOrExpired();
      return;
    }
    const { publishedResourceId } = consumption;
    // The record as it was, for the audit.
    const before = await PublicationReviewModel.findOneAndUpdate(
      { fingerprint, status: 'approved', approvalExpiresAt: { $gt: now }, publishState: { $nin: [...CLOSED_PUBLISH_STATES] } },
      {
        $set: { publishState: 'published', publishedVia: 'author', publishStateAt: now, ...(publishedResourceId ? { publishedResourceId } : {}) },
        $unset: { publishReason: 1, publishNextAt: 1, publishLeaseUntil: 1, publishLeaseToken: 1 },
        $inc: { consumptionWriteVersion: 1 },
      },
      { new: false },
    ).select('_id publishState').lean();
    if (before) {
      // In the caller's transaction, with what it published: ids only, never the content.
      const route = routeOf(input.action);
      await AuditLogModel.create({
        actorId: input.actorId, action: 'publication.published', resource: String(before._id),
        details: `Published by its author: the approved ${input.action} was submitted again${publishedResourceId ? ` (published resource ${publishedResourceId})` : ''}`,
        changes: [
          { field: 'publishState', before: before.publishState ?? null, after: 'published' },
          { field: 'publishedVia', before: null, after: 'author' },
          ...(publishedResourceId ? [{ field: 'publishedResourceId', before: null, after: publishedResourceId }] : []),
        ],
        severity: 'info', method: route.method, path: route.path, statusCode: isCreateAction(input.action) ? 201 : 200,
      });
      return;
    }
    const current = await PublicationReviewModel.findOne({ fingerprint }).select('status publishState publishedResourceId').lean();
    if (current?.status === 'approved' && current.publishState === 'published') throw new PublicationAlreadyPublished(current.publishedResourceId ?? undefined);
    throw changedOrExpired();
  }

  /**
   * Queue insertion (and re-queueing) must serialize with closure, including
   * teammate-owned organization drafts. Returns the author's current role.
   */
  private async lockSubjects(input: PublicationSubmission): Promise<{ actorRole?: string }> {
    const subjects = [...new Set([input.actorId, ...(input.action === 'organization.profile' ? [input.resourceId] : [])])].sort();
    let actorRole: string | undefined;
    for (const subjectId of subjects) {
      const subject = await UserModel.findOneAndUpdate({ _id: subjectId, deletedAt: null }, { $inc: { publicationWriteVersion: 1 } }, { new: true });
      if (!subject || (input.action === 'organization.profile' && subjectId === input.resourceId && subject.role !== 'organization')) throw new AppError('The publishing account is no longer available', 401, undefined, 'account_session');
      if (subjectId === input.actorId) actorRole = subject.role;
    }
    return { actorRole };
  }

  private assertWithinLimits(input: PublicationSubmission): void {
    if (!input.text.trim() || input.text.length > 12000 || input.mediaUrls.length > 10 || input.mediaUrls.some(url => url.length > 2000)) throw new AppError('Public content exceeds the review limits.', 400);
  }

  /** The author must still exist, be free to publish and have accepted the current terms. */
  private async assertMayPublish(actorId: string): Promise<void> {
    const user = await UserModel.findOne({ _id: actorId, deletedAt: null }).lean();
    if (!user) throw new AppError('Account is no longer available', 401, undefined, 'account_session');
    if (await ContentRestrictionModel.exists({ userId: actorId })) throw new AppError('Publishing is restricted. Contact support@ujimora.com to appeal.', 403, undefined, 'publishing_restricted');
    if (user.role !== 'admin' && !hasCurrentLegalAcceptance(user.legalAcceptance)) throw new AppError('Accept the current account agreement before publishing', 428, undefined, 'terms_required');
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
    await PublicationReviewModel.updateOne({ fingerprint, status: 'pending', reason: 'screening' }, outcome === 'allowed'
      ? {
        $set: { status: 'approved', reviewedBy: 'automated:openai', reviewedAt: new Date(), approvalExpiresAt: new Date(Date.now() + APPROVAL_TTL_MS) },
        // The author's own request publishes it; nothing on it claims to publish by itself.
        $unset: { publishOnApproval: 1, credentialDigest: 1 },
      }
      : { $set: { reason: outcome } });
  }

  /**
   * A held version of a publish-on-approval action is published by its
   * approval only when it was submitted with publishing on approval switched
   * on and with the request's verified credential version.
   */
  private publishesOnApproval(input: PublicationSubmission): boolean {
    return isAutoPublishAction(input.action) && typeof input.authVersion === 'string' && this.publishOnApproval();
  }

  /** What a submission records about how its approval publishes it. */
  private publicationIntent(input: PublicationSubmission) {
    const publishes = this.publishesOnApproval(input);
    return {
      publishes,
      ...(publishes ? { digest: credentialDigest(input.actorId, input.authVersion) } : {}),
      applyOptions: applyOptionsOf(input),
    };
  }

  private read(fingerprint: string): Promise<ReviewState | null> {
    return PublicationReviewModel.findOne({ fingerprint }).select('action status reason approvalExpiresAt publishOnApproval publishState publishedResourceId').lean();
  }

  /**
   * Submitting a version that is still waiting renews the author's intent:
   * the latest credential version and options win, and a version held before
   * publishing on approval is upgraded to it (or downgraded while it is off).
   * Returns whether anything changed.
   */
  private async refreshPending(review: ReviewState, input: PublicationSubmission): Promise<boolean> {
    const { publishes, digest, applyOptions } = this.publicationIntent(input);
    if (!publishes && review.publishOnApproval !== true && !applyOptions) return false;
    const result = await PublicationReviewModel.updateOne({ _id: review._id, status: 'pending' }, {
      ...(publishes || applyOptions ? { $set: { ...(publishes ? { publishOnApproval: true, credentialDigest: digest } : {}), ...(applyOptions ? { applyOptions } : {}) } } : {}),
      ...(publishes ? {} : { $unset: { publishOnApproval: 1, credentialDigest: 1 } }),
    });
    return result.modifiedCount > 0;
  }

  /**
   * One current version per item (SINGLE_ITEM_ACTIONS): a newer submission
   * closes every earlier version of the same item that is still waiting for
   * a decision, and stops every approved one that is not published yet, by
   * whoever submitted it. Runs in the transaction that inserts or reopens the
   * newer version.
   */
  private async supersedeEarlierVersions(input: PublicationSubmission, newerId: string, actorRole: string | undefined, now: Date): Promise<void> {
    if (!isSingleItemAction(input.action)) return;
    const earlier = await PublicationReviewModel.find({
      action: input.action, resourceId: input.resourceId, _id: { $ne: newerId },
      $or: [{ status: 'pending' }, { status: 'approved', publishState: { $in: OPEN_STATES } }],
    }).select('_id actorId action status publishState').lean();
    // Sequential: each write belongs to the one transaction.
    for (const version of earlier) {
      if (await closeAsSuperseded(version, newerId, now)) await reportSupersession(input, version, newerId, actorRole, now);
    }
  }

  /** Saves a version submitted for the first time; false when a concurrent request saved it first. */
  private async insertVersion(input: PublicationSubmission, fingerprint: string, reason: ReviewReason, now: Date): Promise<boolean> {
    const { publishes, digest, applyOptions } = this.publicationIntent(input);
    try {
      await this.uow.run(async () => {
        const { actorRole } = await this.lockSubjects(input);
        const row = await PublicationReviewModel.create({
          actorId: input.actorId, action: input.action, resourceId: input.resourceId,
          baseVersion: input.baseVersion, text: input.text, mediaUrls: input.mediaUrls,
          fingerprint, reason, ...(input.automatedReviewConsent === true ? { automatedConsentAt: now } : {}),
          ...(publishes ? { publishOnApproval: true, credentialDigest: digest } : {}),
          ...(applyOptions ? { applyOptions } : {}),
        });
        await this.supersedeEarlierVersions(input, String(row._id), actorRole, now);
      });
      return true;
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      return false;
    }
  }

  /**
   * An expired, superseded or withdrawn version cannot silently authorize
   * publication, but it must not block this exact version until the record is
   * purged either: the same weekly live title, say. Submitting it again opens
   * it for a fresh decision (screening when consented, otherwise staff), with
   * a fresh retention period and the author's current credential version. A
   * flag screening raised before any decision stays: the version goes to
   * staff and is never screened again, so a later answer cannot clear it.
   * Returns the reason it was reopened with, or null when a concurrent
   * request changed it first.
   */
  private async reopenVersion(input: PublicationSubmission, fingerprint: string, review: ReviewState, reason: ReviewReason, now: Date): Promise<ReviewReason | null> {
    const { publishes, digest, applyOptions } = this.publicationIntent(input);
    const consented = input.automatedReviewConsent === true;
    const closedBeforeDecision = review.status === 'superseded' || review.status === 'withdrawn';
    const nextReason: ReviewReason = closedBeforeDecision && review.reason === 'flagged' ? 'flagged' : reason;
    const reviewId = String(review._id);
    const reopened = await this.uow.run(async () => {
      const { actorRole } = await this.lockSubjects(input);
      const result = await PublicationReviewModel.updateOne(reopenFilter(fingerprint, input.action, now), {
        $set: {
          status: 'pending', reason: nextReason, purgeAt: new Date(now.getTime() + REVIEW_RETENTION_MS),
          ...(consented ? { automatedConsentAt: now } : {}),
          ...(publishes ? { publishOnApproval: true, credentialDigest: digest } : {}),
          ...(applyOptions ? { applyOptions } : {}),
        },
        $unset: {
          reviewedBy: 1, reviewedAt: 1, reviewNotes: 1, approvalExpiresAt: 1, ...PUBLICATION_FIELDS,
          ...(consented ? {} : { automatedConsentAt: 1 }),
          ...(publishes ? {} : { publishOnApproval: 1, credentialDigest: 1 }),
          ...(applyOptions ? {} : { applyOptions: 1 }),
        },
      });
      if (result.modifiedCount) await this.supersedeEarlierVersions(input, reviewId, actorRole, now);
      return result.modifiedCount > 0;
    });
    return reopened ? nextReason : null;
  }

  /**
   * Records this submission on its exact version (new, reopened, or a
   * pending one renewed) and returns the version as it now stands. A
   * concurrent request can change the version between the read and a write;
   * the writes are conditional, so on a miss it decides again from the
   * current state.
   */
  private async recordSubmission(input: PublicationSubmission, fingerprint: string): Promise<ReviewState | null> {
    const reason = reviewReasonOf(input);
    let review = await this.read(fingerprint);
    for (let attempt = 0; attempt < 3; attempt++) {
      const now = new Date();
      if (!review) {
        if (await this.insertVersion(input, fingerprint, reason, now) && reason === 'screening') await this.screen(fingerprint, input);
        return this.read(fingerprint);
      }
      if (!isReopenable(review, now)) {
        if (review.status === 'pending' && isAutoPublishAction(input.action) && await this.refreshPending(review, input)) return this.read(fingerprint);
        return review;
      }
      const reopenedAs = await this.reopenVersion(input, fingerprint, review, reason, now);
      if (reopenedAs === 'screening') await this.screen(fingerprint, input);
      review = await this.read(fingerprint);
      if (reopenedAs) return review;
    }
    return review;
  }

  async assertAllowed(input: PublicationSubmission): Promise<void> {
    this.assertWithinLimits(input);
    const review = await this.recordSubmission(input, fingerprintOf(input));
    if (!review) throw new AppError('The safety review could not be saved. Please try again.', 503);
    if (review.status === 'approved') {
      const auto = isAutoPublishAction(review.action);
      // Approvals of these actions are single-use: the identical post again is the same post.
      if (auto && review.publishState === 'published' && isCreateAction(review.action)) throw new PublicationAlreadyPublished(review.publishedResourceId ?? undefined);
      // Approved and not published, superseded or withdrawn: the author's own request publishes it.
      if (isUnexpired(review, new Date()) && !(auto && CLOSED_STATES.has(review.publishState))) {
        // Screening may take seconds; authorization state must still be current afterwards.
        await this.assertMayPublish(input.actorId);
        return;
      }
    }
    if (review.status === 'rejected') throw declined();
    // `errors.publication` lets clients show this as a neutral "waiting for review" notice, not a failure.
    throw publicationHeld(review.publishOnApproval === true);
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

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/**
 * `POST /publication-reviews/:id/withdraw`: the author takes back a version
 * that is waiting for a decision, or approved and not yet published, so its
 * approval never publishes it. Only the author's own versions of the
 * publish-on-approval actions; no restriction or agreement gate, since
 * withdrawing publishes nothing. Idempotent; loses to a publication already
 * committed. Audited in the same transaction.
 */
export async function withdrawPublicationReview(reviewId: string, actorId: string): Promise<{ withdrawn: true }> {
  if (!OBJECT_ID.test(reviewId)) throw new AppError('Publication review not found', 404);
  return new MongoUnitOfWork().run(async () => {
    const review = await PublicationReviewModel.findOne({ _id: reviewId, actorId }).select('action status publishState').lean();
    if (!review) throw new AppError('Publication review not found', 404);
    if (review.status === 'withdrawn' || (review.status === 'approved' && review.publishState === 'withdrawn')) return { withdrawn: true as const };
    if (review.status === 'rejected') throw new AppError("Declined versions can't be withdrawn.", 409, { publication: ['declined'] });
    if (review.status === 'superseded' || review.publishState === 'superseded') throw new AppError('You already replaced this version.', 409, { publication: ['superseded'] });
    if (review.publishState === 'published') throw new AppError('Already published. Delete or change it instead.', 409, { publication: ['published'] });
    if (!canWithdrawPublication(review)) throw new AppError("This version can't be withdrawn.", 409);
    const now = new Date();
    const changed = review.status === 'pending'
      ? await PublicationReviewModel.updateOne({ _id: reviewId, actorId, status: 'pending' }, { $set: { status: 'withdrawn', closedAt: now } })
      : await PublicationReviewModel.updateOne({ _id: reviewId, actorId, status: 'approved', publishState: { $in: OPEN_STATES } }, {
        // An attempt in progress loses its lease: its own publish step can no longer match.
        $set: { publishState: 'withdrawn', publishReason: 'withdrawn_by_author', publishStateAt: now },
        $unset: { publishNextAt: 1, publishLeaseUntil: 1, publishLeaseToken: 1 },
      });
    if (!changed.modifiedCount) throw new AppError('This version changed. Refresh Publication reviews and try again.', 409);
    await AuditLogModel.create({
      actorId, action: 'publication.withdrawn', resource: reviewId,
      details: review.status === 'pending' ? 'The author withdrew this version before a decision' : 'The author withdrew this approved version before it was published',
      changes: [review.status === 'pending'
        ? { field: 'status', before: 'pending', after: 'withdrawn' }
        : { field: 'publishState', before: review.publishState ?? null, after: 'withdrawn' }],
      severity: 'info', method: 'POST', path: '/publication-reviews/:id/withdraw', statusCode: 200,
    });
    return { withdrawn: true as const };
  });
}
