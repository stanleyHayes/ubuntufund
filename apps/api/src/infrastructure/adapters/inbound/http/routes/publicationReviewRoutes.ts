import { queuePageSize } from '../../middleware/queuePageSize.js';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import { PublicationReviewModel } from '../../../../database/models/PublicationReviewModel.js';
import { AuditLogModel } from '../../../../database/models/AuditLogModel.js';
import { UserModel } from '../../../../database/models/UserModel.js';
import { CampaignModel } from '../../../../database/models/CampaignModel.js';
import { CampaignUpdateModel } from '../../../../database/models/CampaignUpdateModel.js';
import { STAFF_REVIEW_GOAL_GHS } from '../../../../../domain/services/campaignApproval.js';
import { MongoUnitOfWork } from '../../../outbound/persistence/MongoUnitOfWork.js';

const OBJECT_ID = /^[a-f0-9]{24}$/i;
/** Why a decision was refused with 409, for the admin card's title (`errors.review`). */
const DECIDED = { review: ['decided'] };
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

export function createPublicationReviewRoutes(auth: RequestHandler, admin?: RequestHandler) {
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
      const filter = admin ? { status, ...(action ? { action } : {}) } : { actorId: req.userId };
      const [items, total] = await Promise.all([
        PublicationReviewModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
        PublicationReviewModel.countDocuments(filter),
      ]);
      const context = admin ? await adminContext(items) : null;
      res.json({ data: { total, items: items.map(item => ({
        id: String(item._id), action: item.action, resourceId: item.resourceId, text: item.text,
        mediaUrls: item.mediaUrls, status: item.status, reason: item.reason, createdAt: item.createdAt,
        reviewNotes: item.reviewNotes, approvalExpiresAt: item.approvalExpiresAt,
        ...(context ? {
          actorId: item.actorId, reviewedBy: item.reviewedBy, baseVersion: item.baseVersion,
          reviewedAt: item.reviewedAt, purgeAt: item.purgeAt, ...context(item),
        } : {}),
      })), ...(admin ? { campaignReviewGoalGhs: STAFF_REVIEW_GOAL_GHS } : {}) } });
    } catch (error) { next(error); }
  });
  if (admin) router.put('/:id/review', async (req: AuthenticatedRequest, res, next) => {
    try {
      const input = z.object({ decision: z.enum(['approved', 'rejected']), notes: z.string().trim().min(20).max(2000) }).parse(req.body);
      await new MongoUnitOfWork().run(async () => {
        const current = await PublicationReviewModel.findById(req.params.id);
        if (!current) throw new AppError('Publication review not found', 404);
        if (current.actorId === req.userId) throw new AppError('Another administrator must review your content', 403);
        if (current.status !== 'pending') {
          if (current.status === input.decision && current.reviewedBy === req.userId && current.reviewNotes === input.notes) return;
          throw new AppError('A final decision already exists for this version', 409, DECIDED);
        }
        const changed = await PublicationReviewModel.updateOne({ _id: current._id, status: 'pending' }, { $set: {
          status: input.decision, reviewedBy: req.userId, reviewedAt: new Date(), reviewNotes: input.notes,
          ...(input.decision === 'approved' ? { approvalExpiresAt: new Date(Date.now() + 7 * 86400000) } : {}),
        } });
        if (!changed.modifiedCount) throw new AppError('Another reviewer already decided this submission', 409, DECIDED);
        await AuditLogModel.create({ actorId: req.userId, actorRole: 'admin', action: `publication.${input.decision}`, resource: String(current._id), details: 'Publication version reviewed', reason: input.notes, severity: 'info', method: 'PUT', path: '/admin/publication-reviews/:id/review', statusCode: 200 });
      });
      res.json({ data: { reviewed: true } });
    } catch (error) { next(error instanceof z.ZodError ? new AppError('Choose a decision and enter at least 20 characters of review notes', 400) : error); }
  });
  return router;
}
