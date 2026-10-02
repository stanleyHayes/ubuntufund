import { queuePageSize } from '../../middleware/queuePageSize.js';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import { PublicationReviewModel } from '../../../../database/models/PublicationReviewModel.js';
import { UserModel } from '../../../../database/models/UserModel.js';
import { CampaignModel } from '../../../../database/models/CampaignModel.js';
import { CampaignUpdateModel } from '../../../../database/models/CampaignUpdateModel.js';
import { STAFF_REVIEW_GOAL_GHS } from '../../../../../domain/services/campaignApproval.js';
import { canWithdrawPublication, isPublicationOutcomeReason } from '@ubuntu-fund/types';
import { withdrawPublicationReview } from '../../../outbound/persistence/MongoPublicationAdmission.js';
import { MongoPublicationReviewDecision } from '../../../outbound/persistence/MongoPublicationReviewDecision.js';
import { publicationProgressOf } from '../../../outbound/persistence/MongoPublicationApplyStore.js';

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const AUTOMATED_REVIEWER = 'automated:openai';
/** Actions whose resourceId is the campaign; update.edit reaches its campaign through the update. */
const CAMPAIGN_ACTIONS = new Set(['comment.create', 'update.create', 'live.start', 'campaign.slug', 'thank_you.send']);
const PROFILE_ACTIONS = new Set(['account.profile', 'creator.profile', 'organization.profile']);
/** Fixture and legacy ids such as 'fixture' are not ObjectIds; dropping them first avoids CastErrors. */
const ids = (values: unknown[]) => [...new Set(values.filter((value): value is string => typeof value === 'string' && OBJECT_ID.test(value)))];

type ReviewRow = { action: string; actorId: string; resourceId: string; reviewedBy?: string | null };

/**
 * Staff-only context for one page of reviews: the author, the account whose profile a teammate is changing, the
 * campaign the action targets and the reviewer. At most three batched queries, whatever the page size. A key is
 * absent when it does not apply to the action; null means it applies but the record was not found.
 */
async function adminContext(rows: ReviewRow[]) {
  const profileOf = (row: ReviewRow) => PROFILE_ACTIONS.has(row.action) && row.resourceId !== row.actorId;
  const campaignScoped = (row: ReviewRow) => row.action === 'update.edit' || CAMPAIGN_ACTIONS.has(row.action);
  const userIds = ids(rows.flatMap(row => [row.actorId, row.reviewedBy === AUTOMATED_REVIEWER ? null : row.reviewedBy, profileOf(row) ? row.resourceId : null]));
  const updateIds = ids(rows.filter(row => row.action === 'update.edit').map(row => row.resourceId));
  const [users, updates] = await Promise.all([
    userIds.length ? UserModel.find({ _id: { $in: userIds } }).select('_id name email role organizationName verificationLevel emailVerified deletedAt').lean() : [],
    updateIds.length ? CampaignUpdateModel.find({ _id: { $in: updateIds } }).select('_id campaignId').lean() : [],
  ]);
  const updateCampaigns = new Map(updates.map(update => [String(update._id), update.campaignId]));
  const campaignOf = (row: ReviewRow) => row.action === 'update.edit' ? updateCampaigns.get(row.resourceId) : row.resourceId;
  const campaignIds = ids(rows.filter(campaignScoped).map(campaignOf));
  const campaigns = campaignIds.length ? await CampaignModel.find({ _id: { $in: campaignIds } }).select('_id title slug status creatorId deletedAt').lean() : [];
  // Absent legacy fields read as their schema defaults, so every summary has the same shape.
  const accounts = new Map(users.map(user => [String(user._id), {
    id: String(user._id), name: user.name, email: user.email, accountType: user.role ?? 'user',
    ...(user.organizationName ? { organizationName: user.organizationName } : {}),
    verificationLevel: user.verificationLevel ?? 0, emailVerified: user.emailVerified === true, closed: !!user.deletedAt,
  }]));
  const campaignSummaries = new Map(campaigns.map(campaign => [String(campaign._id), {
    id: String(campaign._id), title: campaign.title, ...(campaign.slug ? { slug: campaign.slug } : {}),
    status: campaign.status, creatorId: campaign.creatorId, deleted: !!campaign.deletedAt,
  }]));
  const reviewerOf = (reviewedBy: string) => {
    if (reviewedBy === AUTOMATED_REVIEWER) return { id: reviewedBy, automated: true };
    const reviewer = accounts.get(reviewedBy);
    return reviewer ? { id: reviewer.id, name: reviewer.name, automated: false } : null;
  };
  return (row: ReviewRow) => {
    const campaignId = campaignScoped(row) ? campaignOf(row) : undefined;
    return {
      author: accounts.get(row.actorId) ?? null,
      ...(profileOf(row) ? { profileAccount: accounts.get(row.resourceId) ?? null } : {}),
      ...(campaignScoped(row) ? { campaign: (campaignId && campaignSummaries.get(campaignId)) || null } : {}),
      ...(row.reviewedBy ? { reviewer: reviewerOf(row.reviewedBy) } : {}),
    };
  };
}

/** The publication lifecycle fields of a review record the projections read. */
type PublicationFields = {
  action: string; status: string; publishOnApproval?: boolean | null; publishState?: string | null; publishReason?: string | null;
  publishStateAt?: Date | null; publishedVia?: string | null; publishedResourceId?: string | null; publishAttempts?: number | null;
  publishNextAt?: Date | null; applyOptions?: { isPinned?: boolean | null } | null; supersededBy?: string | null; closedAt?: Date | null;
};

/**
 * The author's view of publishing on approval: whether an approval publishes
 * the version by itself, where that stands, and whether they can still
 * withdraw it. While publishing on approval is switched off, an approval
 * still waiting to publish reads as a plain approval (the author publishes it
 * by submitting it again), and nothing promises to publish by itself.
 * Withdrawing is offered while it is on; while it is off, only for a version
 * submitted while it was on (its approval may still publish it once it is
 * back on), so lists read as before the switch for everything else.
 */
function authorPublication(item: PublicationFields, switchedOn: boolean) {
  const progress = publicationProgressOf(item);
  const shown = progress && !(progress.state === 'publishing' && !switchedOn) ? progress : null;
  return {
    publishOnApproval: switchedOn && item.publishOnApproval === true,
    ...(shown ? { publication: shown } : {}),
    canWithdraw: canWithdrawPublication(item) && (switchedOn || item.publishOnApproval === true),
  };
}

/**
 * The staff view: the raw publication state and its attempts. Never the
 * credential digest or the lease (neither is ever read here).
 */
function adminPublication(item: PublicationFields, switchedOn: boolean) {
  return {
    publishOnApproval: switchedOn && item.publishOnApproval === true,
    ...(item.publishState ? { publication: {
      state: item.publishState,
      ...(isPublicationOutcomeReason(item.publishReason) ? { reason: item.publishReason } : {}),
      ...(item.publishStateAt ? { at: item.publishStateAt } : {}),
      ...(item.publishedVia ? { via: item.publishedVia } : {}),
      ...(typeof item.publishAttempts === 'number' ? { attempts: item.publishAttempts } : {}),
      ...(item.publishNextAt ? { nextAttemptAt: item.publishNextAt } : {}),
      ...(item.publishedResourceId ? { resourceId: item.publishedResourceId } : {}),
    } } : {}),
    ...(item.applyOptions ? { applyOptions: { isPinned: item.applyOptions.isPinned === true } } : {}),
    ...(item.supersededBy ? { supersededBy: item.supersededBy } : {}),
  };
}

/** `publishing` covers both queued and running attempts. */
const PUBLISH_STATE_FILTERS = ['publishing', 'queued', 'applying', 'published', 'not_published', 'superseded', 'withdrawn'] as const;

export interface PublicationReviewRouteOptions {
  /** The staff decision (admin mount). */
  decisions?: MongoPublicationReviewDecision;
  /** PUBLISH_ON_APPROVAL_ENABLED. */
  publishOnApproval?: () => boolean;
}

export function createPublicationReviewRoutes(auth: RequestHandler, admin?: RequestHandler, options: PublicationReviewRouteOptions = {}) {
  const switchedOn = options.publishOnApproval ?? (() => false);
  const router = Router();
  router.use(auth, (_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  if (admin) router.use(admin);
  router.get('/', async (req: AuthenticatedRequest, res, next) => {
    try {
      const pageSize = queuePageSize(req.query.pageSize);
      const page = Math.max(1, Math.min(10000, Math.floor(Number(req.query.page)) || 1));
      const status = z.enum(['pending', 'approved', 'rejected']).catch('pending').parse(req.query.status);
      // Staff may narrow the queue to one kind of content (new campaign proposals, say); an invalid value is ignored like status.
      const action = admin ? z.string().max(40).regex(/^[a-z_]+\.[a-z_]+$/).optional().catch(undefined).parse(req.query.action) : undefined;
      // …or to where approved versions stand on their way to publication.
      const publishState = admin ? z.enum(PUBLISH_STATE_FILTERS).optional().catch(undefined).parse(req.query.publishState) : undefined;
      const filter = admin ? {
        status, ...(action ? { action } : {}),
        ...(publishState ? { publishState: publishState === 'publishing' ? { $in: ['queued', 'applying'] } : publishState } : {}),
      } : { actorId: req.userId };
      const [items, total] = await Promise.all([
        PublicationReviewModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
        PublicationReviewModel.countDocuments(filter),
      ]);
      const context = admin ? await adminContext(items) : null;
      const on = switchedOn();
      res.json({ data: { total, items: items.map(item => ({
        id: String(item._id), action: item.action, resourceId: item.resourceId, text: item.text,
        mediaUrls: item.mediaUrls, status: item.status, reason: item.reason, createdAt: item.createdAt,
        reviewNotes: item.reviewNotes, approvalExpiresAt: item.approvalExpiresAt,
        ...(context ? {
          actorId: item.actorId, reviewedBy: item.reviewedBy, baseVersion: item.baseVersion,
          reviewedAt: item.reviewedAt, purgeAt: item.purgeAt, ...context(item), ...adminPublication(item, on),
        } : authorPublication(item, on)),
      })), ...(admin ? { campaignReviewGoalGhs: STAFF_REVIEW_GOAL_GHS } : {}) } });
    } catch (error) { next(error); }
  });
  // The author takes back a version that is waiting, or approved and not yet published (author mount only).
  if (!admin) router.post('/:id/withdraw', async (req: AuthenticatedRequest, res, next) => {
    try {
      res.json({ data: await withdrawPublicationReview(String(req.params.id), req.userId!) });
    } catch (error) { next(error); }
  });
  if (admin) {
    // The decision, its audit and notice, and any publication it starts (MongoPublicationReviewDecision).
    const decisions = options.decisions ?? new MongoPublicationReviewDecision({ publishOnApproval: switchedOn });
    router.put('/:id/review', async (req: AuthenticatedRequest, res, next) => {
      try {
        const input = z.object({ decision: z.enum(['approved', 'rejected']), notes: z.string().trim().min(20).max(2000) }).parse(req.body);
        const result = await decisions.decide({ reviewId: String(req.params.id), staffId: req.userId!, authVersion: req.authVersion, decision: input.decision, notes: input.notes });
        res.json({ data: result });
      } catch (error) { next(error instanceof z.ZodError ? new AppError('Choose a decision and enter at least 20 characters of review notes', 400) : error); }
    });
  }
  return router;
}
