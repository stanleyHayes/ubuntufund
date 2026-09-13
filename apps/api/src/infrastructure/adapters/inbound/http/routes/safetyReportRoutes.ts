import { queuePageSize } from '../../middleware/queuePageSize.js';
import { isDonationContentApproved } from '../../../../../domain/entities/donationPublicContent.js';
import { isTipContentApproved } from '../../../../../domain/entities/tipPublicContent.js';
import { DonationModel } from '../../../../database/models/DonationModel.js';
import { createHash } from 'node:crypto';
import { CampaignUpdateModel } from '../../../../database/models/CampaignUpdateModel.js';
import { MongoUnitOfWork } from '../../../outbound/persistence/MongoUnitOfWork.js';
import { CampaignStatus } from '@ubuntu-fund/types';
import { AiUsageModel } from '../../../../database/models/AiUsageModel.js';
import { TipModel } from '../../../../database/models/TipModel.js';
import { UserBlockModel } from '../../../../database/models/UserBlockModel.js';
import { LiveSessionModel } from '../../../../database/models/LiveSessionModel.js';
import { CampaignModel } from '../../../../database/models/CampaignModel.js';
import { CreatorProfileModel } from '../../../../database/models/CreatorProfileModel.js';
import { safetyReportRateLimiter } from '../../middleware/rateLimiter.js';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { SafetyReportModel } from '../../../../database/models/SafetyReportModel.js';
import { ContentRestrictionModel } from '../../../../database/models/ContentRestrictionModel.js';
import { CampaignCommentModel } from '../../../../database/models/CampaignCommentModel.js';
import { UserModel } from '../../../../database/models/UserModel.js';
import { AuditLogModel } from '../../../../database/models/AuditLogModel.js';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import { validate } from '../../middleware/validate.js';
const reportSchema = z.object({
  targetType: z.enum(['comment', 'campaign_update', 'user', 'live', 'donation_message', 'tip_message', 'ai_output']), targetId: z.string().regex(/^[a-f0-9]{24}$/i),
  generatedText: z.string().min(1).max(16000).optional(),
  reason: z.enum(['harassment', 'hate', 'sexual_content', 'violence', 'child_safety', 'credible_threat', 'fraud', 'spam', 'other']),
  description: z.string().trim().min(10).max(2000),
});
const publicCampaignStates = [CampaignStatus.ACTIVE, CampaignStatus.FUNDED, CampaignStatus.EXPIRED];
function updateSnapshot(update: { title: string; content: string; mediaUrls: string[] }) {
  const full = JSON.stringify({ title: update.title, content: update.content, mediaUrls: update.mediaUrls });
  return { evidence: full.slice(0, 16000), digest: createHash('sha256').update(full).digest('hex') };
}
export function createSafetyReportRoutes(auth: RequestHandler) {
  const router = Router();
  router.post('/reports', auth, safetyReportRateLimiter, validate(reportSchema), async (req: AuthenticatedRequest, res, next) => {
    try {
      const input = reportSchema.parse(req.body);
      let targetUserId: string | undefined, campaignId: string | undefined, evidence: string, targetDigest: string | undefined;
      if (input.targetType === 'ai_output') {
        const usage = await AiUsageModel.findOne({ _id: input.targetId, userId: req.userId, status: 'success' }).select('+outputDigest');
        if (!usage || !input.generatedText || !usage.outputDigest || createHash('sha256').update(input.generatedText).digest('hex') !== usage.outputDigest) throw new AppError('Generated suggestion not found. Report the original suggestion from the writing assistant.', 404);
        evidence = input.generatedText;
      } else if (input.targetType === 'campaign_update') {
        const update = await CampaignUpdateModel.findOne({ _id: input.targetId, deletedAt: { $exists: false } });
        const campaign = update && await CampaignModel.findOne({ _id: update.campaignId, deletedAt: { $exists: false } });
        if (!update || !campaign || (!publicCampaignStates.includes(campaign.status) && campaign.creatorId !== req.userId && req.userRole !== 'admin')) throw new AppError('Campaign update not found', 404);
        const snapshot = updateSnapshot(update);
        evidence = snapshot.evidence; targetDigest = snapshot.digest;
        targetUserId = update.authorId; campaignId = update.campaignId;
      } else if (input.targetType === 'donation_message') {
        const donation = await DonationModel.findById(input.targetId);
        if (!donation?.message || donation.messageHiddenAt || !isDonationContentApproved(donation)) throw new AppError('Message not found', 404);
        targetUserId = donation.donorId === 'guest' ? undefined : donation.donorId;
        campaignId = donation.campaignId; evidence = donation.message;
      } else if (input.targetType === 'tip_message') {
        const tip = await TipModel.findOne({ _id: input.targetId, status: 'SUCCEEDED' });
        if (!tip?.message || tip.messageHiddenAt || !isTipContentApproved(tip)) throw new AppError('Message not found', 404);
        targetUserId = tip.supporterUserId; evidence = tip.message;
      } else if (input.targetType === 'live') {
        const live = await LiveSessionModel.findById(input.targetId);
        const campaign = live && await CampaignModel.findById(live.campaignId);
        if (!live || !campaign) throw new AppError('Broadcast not found', 404);
        targetUserId = campaign.creatorId; campaignId = live.campaignId; evidence = `Live session: ${live.title ?? campaign.title}\nStatus: ${live.status}\nStarted: ${live.startedAt.toISOString()}`;
      } else if (input.targetType === 'comment') {
        const comment = await CampaignCommentModel.findById(input.targetId);
        if (!comment) throw new AppError('Comment not found', 404);
        targetUserId = comment.authorId; campaignId = comment.campaignId;
        evidence = comment.authorName ? JSON.stringify({ authorName: comment.authorName, authorAvatarUrl: comment.authorAvatarUrl, comment: comment.content }) : comment.content;
      } else {
        const user = await UserModel.findOne({ _id: input.targetId, deletedAt: { $exists: false } });
        if (!user) throw new AppError('User not found', 404);
        const creator = await CreatorProfileModel.findOne({ userId: input.targetId });
        targetUserId = input.targetId; evidence = [user.name, creator?.displayName, creator?.tagline, creator?.bio].filter(Boolean).join('\n').slice(0, 12000);
      }
      if (targetUserId === req.userId) throw new AppError('You cannot report your own account or comment', 400);
      const key = { reporterId: req.userId!, targetType: input.targetType, targetId: input.targetId, status: 'pending' };
      let report;
      try {
        report = await SafetyReportModel.findOneAndUpdate(key, { $setOnInsert: { ...key, reason: input.reason, description: input.description, targetUserId, campaignId, evidence, targetDigest, priority: ['child_safety', 'credible_threat'].includes(input.reason) ? 'urgent' : 'normal' } }, { upsert: true, new: true });
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        report = await SafetyReportModel.findOne(key);
      }
      res.set('Cache-Control', 'no-store').status(201).json({ data: { id: report!.id, status: report!.status }, message: 'Report received for moderation review' });
    } catch (error) { next(error); }
  });
  return router;
}
const reviewSchema = z.object({ action: z.enum(['dismiss', 'resolve', 'hide_comment', 'hide_update', 'hide_message', 'restrict_user', 'stop_live']), notes: z.string().trim().min(20).max(2000) });
export function createAdminSafetyReportRoutes(auth: RequestHandler, admin: RequestHandler, stopLive: (id: string) => Promise<void>, retryLiveCleanup: () => Promise<void>) {
  const router = Router(); router.use(auth, admin);
  router.post('/live-cleanup/retry', async (_req, res, next) => {
    try { await retryLiveCleanup(); res.json({ data: null, message: 'Live cleanup retry completed; check remaining queue counts' }); } catch (error) { next(error); }
  });
  router.get('/', async (req, res, next) => {
    try {
      const parsed = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1), status: z.enum(['pending', 'resolved', 'dismissed']).default('pending') }).safeParse(req.query);
      if (!parsed.success) throw new AppError('Invalid report filters', 400);
      const { page, status } = parsed.data;
      const pageSize = queuePageSize(req.query.pageSize);
      const filter = { status };
      const [items, total] = await Promise.all([SafetyReportModel.find(filter).sort({ priority: -1, createdAt: 1 }).skip((page - 1) * pageSize).limit(pageSize).lean(), SafetyReportModel.countDocuments(filter)]);
      const pendingLiveCleanup = await LiveSessionModel.countDocuments({ providerStopPending: true }) + await UserBlockModel.countDocuments({ providerCleanupPending: true });
      res.set('Cache-Control', 'no-store').json({ data: { items, total, page, pageSize, pendingLiveCleanup } });
    } catch (error) { next(error); }
  });
  router.put('/:id/review', validate(reviewSchema), async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!/^[a-f0-9]{24}$/i.test(String(req.params.id))) throw new AppError('Invalid report', 400);
      let report = await SafetyReportModel.findById(req.params.id);
      if (!report) throw new AppError('Report not found', 404);
      if (report.status !== 'pending') throw new AppError('This report has already been reviewed', 409);
      const input = reviewSchema.parse(req.body);
      const action = input.action;
      if (action === 'restrict_user' && !report.targetUserId) throw new AppError('This report has no verified author account to restrict. Review the content and record the appropriate action.', 400);
      if (action === 'hide_message' && !['donation_message', 'tip_message'].includes(report.targetType)) throw new AppError('Choose a donor or supporter message report', 400);
      if (action === 'stop_live' && report.targetType !== 'live') throw new AppError('Choose a live-session report', 400);
      if (action === 'hide_comment' && report.targetType !== 'comment') throw new AppError('Choose a comment report', 400);
      if (action === 'hide_update' && report.targetType !== 'campaign_update') throw new AppError('Choose a campaign update report', 400);
      if (report.targetType === 'campaign_update' && ['hide_update', 'restrict_user'].includes(action)) {
        const reportId = report.id;
        await new MongoUnitOfWork().run(async () => {
          const currentReport = await SafetyReportModel.findById(reportId);
          if (!currentReport || currentReport.status !== 'pending' || (currentReport.reviewAction && currentReport.reviewAction !== action)) throw new AppError('A different review has already started. Refresh the queue.', 409);
          const update = await CampaignUpdateModel.findById(currentReport.targetId);
          if (update?.deletedAt && update.moderationReportId === reportId && currentReport.reviewAction === action) return;
          if (!update || update.deletedAt || updateSnapshot(update).digest !== currentReport.targetDigest) throw new AppError('This update changed or was removed after the report. Resolve or dismiss this report after reviewing the current content; do not hide an unreviewed version.', 409);
          await SafetyReportModel.updateOne({ _id: reportId, reviewAction: { $exists: false } }, { $set: { reviewAction: action, reviewNotes: input.notes, reviewedBy: req.userId, reviewStartedAt: new Date() } });
          const hidden = await CampaignUpdateModel.updateOne({ _id: update.id, updatedAt: update.updatedAt, deletedAt: { $exists: false } }, { $set: { deletedAt: new Date(), deletedBy: req.userId, moderationReportId: reportId } });
          if (hidden.matchedCount !== 1) throw new AppError('The update changed during review. Refresh before trying again.', 409);
        });
      }
      // Persist one immutable action before external effects. A retry may finish
      // that action, but another moderator cannot replace it mid-flight.
      const claimed = await SafetyReportModel.findOneAndUpdate({ _id: report.id, status: 'pending', reviewAction: { $exists: false } }, { $set: { reviewAction: action, reviewNotes: input.notes, reviewedBy: req.userId, reviewStartedAt: new Date() } }, { new: true });
      report = claimed ?? await SafetyReportModel.findById(report.id);
      if (!report || report.status !== 'pending' || report.reviewAction !== action) throw new AppError('A different review has already started. Refresh the queue.', 409);
      const notes = report.reviewNotes!;
      if (action === 'stop_live') {
        if (report.targetType !== 'live') throw new AppError('Choose a live-session report', 400);
        await stopLive(report.targetId);
      }
      if (action === 'restrict_user') {
        await ContentRestrictionModel.updateOne({ userId: report.targetUserId }, { $set: { reason: notes, restrictedBy: req.userId, reportId: report.id } }, { upsert: true });
        const campaigns = await CampaignModel.find({ creatorId: report.targetUserId }).select('_id');
        const active = await LiveSessionModel.find({ campaignId: { $in: campaigns.map(c => String(c._id)) }, $or: [{ status: 'active' }, { providerStopPending: true }] });
        for (const live of active) await stopLive(String(live._id));
      }
      if (action === 'hide_comment' || (action === 'restrict_user' && report.targetType === 'comment')) {
        if (report.targetType !== 'comment') throw new AppError('Choose a comment report to hide content', 400);
        await CampaignCommentModel.updateOne({ _id: report.targetId }, { $set: { deletedAt: new Date() } });
      }
      if ((action === 'hide_message' || action === 'restrict_user') && ['donation_message', 'tip_message'].includes(report.targetType)) {
        const update = {
          $set: { messageHiddenAt: new Date(), publicContentStatus: 'pending' },
          $unset: { message: 1, publicContentFingerprint: 1, publicReviewNotes: 1, publicReviewedAt: 1, publicReviewedBy: 1 },
        };
        if (report.targetType === 'donation_message') await DonationModel.updateOne({ _id: report.targetId }, update);
        else await TipModel.updateOne({ _id: report.targetId }, update);
      }
      await AuditLogModel.create({ actorId: req.userId, actorRole: req.userRole, action: `safety.${action}`, resource: `safety-report:${report.id}`, details: notes, method: 'PUT', path: req.originalUrl, statusCode: 200 });
      const status = action === 'dismiss' ? 'dismissed' : 'resolved';
      await SafetyReportModel.updateOne({ _id: report.id, status: 'pending', reviewAction: action }, { $set: { status, resolution: action, reviewedAt: new Date() } });
      res.set('Cache-Control', 'no-store').json({ data: { id: report.id, status } });
    } catch (error) { next(error); }
  });
  router.post('/restrictions/:userId/restore', validate(z.object({ notes: z.string().trim().min(20).max(2000) })), async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!/^[a-f0-9]{24}$/i.test(String(req.params.userId))) throw new AppError('Invalid user', 400);
      const { notes } = req.body as { notes: string };
      await AuditLogModel.create({ actorId: req.userId, actorRole: req.userRole, action: 'safety.restore_public_content', resource: `user:${req.params.userId}`, details: notes, method: 'POST', path: req.originalUrl, statusCode: 200 });
      await ContentRestrictionModel.deleteOne({ userId: req.params.userId });
      res.json({ data: null });
    } catch (error) { next(error); }
  });
  return router;
}
