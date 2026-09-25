import { queuePageSize } from '../../middleware/queuePageSize.js';
import { isDonationContentApproved } from '../../../../../domain/entities/donationPublicContent.js';
import { isTipContentApproved } from '../../../../../domain/entities/tipPublicContent.js';
import { DonationModel } from '../../../../database/models/DonationModel.js';
import { createHash } from 'node:crypto';
import { CampaignUpdateModel } from '../../../../database/models/CampaignUpdateModel.js';
import { MongoUnitOfWork } from '../../../outbound/persistence/MongoUnitOfWork.js';
import { recordStaffDecisionNotice, safetyReportNotices } from '../../../outbound/persistence/MongoStaffDecisionNotices.js';
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
import { ContentRestrictionEventModel } from '../../../../database/models/ContentRestrictionEventModel.js';
import { PublicationReviewModel } from '../../../../database/models/PublicationReviewModel.js';
import { CampaignCommentModel } from '../../../../database/models/CampaignCommentModel.js';
import { UserModel } from '../../../../database/models/UserModel.js';
import { AuditLogModel } from '../../../../database/models/AuditLogModel.js';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import { validate } from '../../middleware/validate.js';
const reportSchema = z.object({
  targetType: z.enum(['comment', 'campaign_update', 'user', 'live', 'donation_message', 'tip_message', 'ai_output']), targetId: z.string().regex(/^[a-f0-9]{24}$/i),
  generatedText: z.string().min(1).max(16000).optional(),
  reason: z.enum(['harassment', 'hate', 'sexual_content', 'violence', 'child_safety', 'credible_threat', 'fraud', 'spam', 'intellectual_property', 'privacy', 'other']),
  description: z.string().trim().min(10).max(2000),
});
const publicCampaignStates = [CampaignStatus.ACTIVE, CampaignStatus.FUNDED, CampaignStatus.EXPIRED];
function updateSnapshot(update: { title: string; content: string; mediaUrls: string[] }) {
  const full = JSON.stringify({ title: update.title, content: update.content, mediaUrls: update.mediaUrls });
  return { evidence: full.slice(0, 16000), digest: createHash('sha256').update(full).digest('hex') };
}
/**
 * Removing content must also withdraw the approval that published it, or the
 * author could repost the identical text for the rest of the approval window.
 * The declined version then answers 422 on resubmission.
 */
async function revokePublicationApproval(fingerprint: string | undefined, reportId: string, reviewerId: string | undefined) {
  if (!fingerprint) return;
  await PublicationReviewModel.updateOne({ fingerprint, status: 'approved' }, {
    $set: { status: 'rejected', reviewNotes: `Removed after safety report ${reportId}`, reviewedBy: reviewerId, reviewedAt: new Date() },
    $unset: { approvalExpiresAt: 1 },
  });
}
/** Single active restriction for enforcement, plus an append-only history entry. */
async function recordRestriction(userId: string, reason: string, actorId: string, reportId?: string) {
  await new MongoUnitOfWork().run(async () => {
    await ContentRestrictionModel.updateOne({ userId }, { $set: { reason, restrictedBy: actorId, ...(reportId ? { reportId } : {}) }, ...(reportId ? {} : { $unset: { reportId: 1 } }) }, { upsert: true });
    if (reportId) await ContentRestrictionEventModel.updateOne({ reportId, action: 'restrict' }, { $setOnInsert: { userId, action: 'restrict', reason, actorId, reportId } }, { upsert: true });
    else await ContentRestrictionEventModel.create({ userId, action: 'restrict', reason, actorId });
  });
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
        // Already-removed comments, and comments on campaigns the reporter
        // cannot see, are not reportable (as for campaign updates).
        const comment = await CampaignCommentModel.findOne({ _id: input.targetId, deletedAt: null });
        const campaign = comment && await CampaignModel.findOne({ _id: comment.campaignId, deletedAt: { $exists: false } });
        if (!comment || !campaign || (!publicCampaignStates.includes(campaign.status) && campaign.creatorId !== req.userId && req.userRole !== 'admin')) throw new AppError('Comment not found', 404);
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
  async function restrictAndStopLive(userId: string, reason: string, actorId: string, reportId?: string) {
    await recordRestriction(userId, reason, actorId, reportId);
    const campaigns = await CampaignModel.find({ creatorId: userId }).select('_id');
    const active = await LiveSessionModel.find({ campaignId: { $in: campaigns.map(c => String(c._id)) }, $or: [{ status: 'active' }, { providerStopPending: true }] });
    for (const live of active) await stopLive(String(live._id));
  }
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
      // Four eyes: never the reporter, the reported author, or the owner of
      // the campaign the content sits on.
      const interested = [report.reporterId, report.targetUserId];
      if (report.campaignId && ['comment', 'campaign_update', 'live', 'donation_message'].includes(report.targetType) && /^[a-f0-9]{24}$/i.test(report.campaignId)) {
        interested.push((await CampaignModel.findById(report.campaignId).select('creatorId').lean())?.creatorId);
      }
      if (interested.includes(req.userId)) throw new AppError('Another administrator must review this report.', 403);
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
          const unchanged = !!update && !update.deletedAt && updateSnapshot(update).digest === currentReport.targetDigest;
          // Hiding needs the reported version. Restricting the author does not:
          // it proceeds on a changed update, which then stays visible for a
          // separate review of its current content.
          if (!unchanged && action === 'hide_update') throw new AppError('This update changed or was removed after the report. Resolve or dismiss this report after reviewing the current content; do not hide an unreviewed version.', 409);
          await SafetyReportModel.updateOne({ _id: reportId, reviewAction: { $exists: false } }, { $set: { reviewAction: action, reviewNotes: input.notes, reviewedBy: req.userId, reviewStartedAt: new Date() } });
          if (!unchanged || !update) return;
          const hidden = await CampaignUpdateModel.updateOne({ _id: update.id, updatedAt: update.updatedAt, deletedAt: { $exists: false } }, { $set: { deletedAt: new Date(), deletedBy: req.userId, moderationReportId: reportId } });
          if (hidden.matchedCount !== 1) throw new AppError('The update changed during review. Refresh before trying again.', 409);
          await revokePublicationApproval(update.publicationFingerprint, reportId, req.userId);
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
      if (action === 'restrict_user') await restrictAndStopLive(report.targetUserId!, notes, req.userId!, report.id);
      if (action === 'hide_comment' || (action === 'restrict_user' && report.targetType === 'comment')) {
        if (report.targetType !== 'comment') throw new AppError('Choose a comment report to hide content', 400);
        const reportId = report.id;
        await new MongoUnitOfWork().run(async () => {
          // Keep the original removal time if the author or owner already deleted it.
          await CampaignCommentModel.updateOne({ _id: report!.targetId, deletedAt: null }, { $set: { deletedAt: new Date() } });
          const comment = await CampaignCommentModel.findById(report!.targetId).select('publicationFingerprint').lean();
          await revokePublicationApproval(comment?.publicationFingerprint, reportId, req.userId);
        });
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
      // Outcome notices are best-effort: the decision is already recorded, and
      // deterministic ids keep a retried review from notifying twice.
      for (const notice of safetyReportNotices({ reportId: report.id, reporterId: report.reporterId, targetUserId: report.targetUserId ?? undefined, action })) {
        await recordStaffDecisionNotice(notice).catch(() => undefined);
      }
      res.set('Cache-Control', 'no-store').json({ data: { id: report.id, status } });
    } catch (error) { next(error); }
  });
  /** Currently restricted accounts, newest first, with the account name/email staff need. */
  router.get('/restrictions', async (req, res, next) => {
    try {
      const parsed = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1) }).safeParse(req.query);
      if (!parsed.success) throw new AppError('Invalid restriction filters', 400);
      const { page } = parsed.data;
      const pageSize = queuePageSize(req.query.pageSize);
      const [rows, total] = await Promise.all([
        ContentRestrictionModel.find({}).sort({ updatedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
        ContentRestrictionModel.countDocuments({}),
      ]);
      const ids = rows.map(row => row.userId).filter(id => /^[a-f0-9]{24}$/i.test(id));
      const users = new Map((await UserModel.find({ _id: { $in: ids } }).select('name email deletedAt').lean()).map(user => [String(user._id), user]));
      const items = rows.map(row => {
        const user = users.get(row.userId);
        return { userId: row.userId, name: user?.name, email: user?.email, closed: !!user?.deletedAt, reason: row.reason, restrictedBy: row.restrictedBy, reportId: row.reportId, restrictedAt: row.updatedAt };
      });
      res.set('Cache-Control', 'no-store').json({ data: { items, total, page, pageSize } });
    } catch (error) { next(error); }
  });
  /** Restrict publishing directly (no report needed), with notes for the record. */
  router.post('/restrictions/:userId', validate(z.object({ notes: z.string().trim().min(20).max(2000) })), async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = String(req.params.userId);
      if (!/^[a-f0-9]{24}$/i.test(userId)) throw new AppError('Invalid user', 400);
      if (userId === req.userId) throw new AppError('Another administrator must restrict your account.', 403);
      const { notes } = req.body as { notes: string };
      if (!await UserModel.exists({ _id: userId, deletedAt: null })) throw new AppError('User not found', 404);
      await restrictAndStopLive(userId, notes, req.userId!);
      await AuditLogModel.create({ actorId: req.userId, actorRole: req.userRole, action: 'safety.restrict_user', resource: `user:${userId}`, details: notes, reason: notes, method: 'POST', path: req.originalUrl, statusCode: 200 });
      res.set('Cache-Control', 'no-store').status(201).json({ data: { userId } });
    } catch (error) { next(error); }
  });
  router.post('/restrictions/:userId/restore', validate(z.object({
    notes: z.string().trim().min(20).max(2000), reportId: z.string().regex(/^[a-f0-9]{24}$/i).optional(), confirmSupersede: z.boolean().optional(),
    /** The governing report the moderator was shown and confirmed ('' = a direct staff restriction). */
    supersedeReportId: z.union([z.literal(''), z.string().regex(/^[a-f0-9]{24}$/i)]).optional(),
  })), async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = String(req.params.userId);
      if (!/^[a-f0-9]{24}$/i.test(userId)) throw new AppError('Invalid user', 400);
      if (userId === req.userId) throw new AppError('Another administrator must lift your restriction.', 403);
      const { notes, reportId, confirmSupersede, supersedeReportId } = req.body as { notes: string; reportId?: string; confirmSupersede?: boolean; supersedeReportId?: string };
      await new MongoUnitOfWork().run(async () => {
        const removed = await ContentRestrictionModel.findOneAndDelete({ userId });
        if (!removed) throw new AppError('This account has no active publishing restriction.', 404);
        // Restoring from an older report must not silently lift a newer restriction.
        const governing = removed.reportId ?? '';
        if (reportId && governing !== reportId) {
          // `supersede` marks this refusal for clients, which show the governing
          // decision and offer an explicit lift only for it.
          const details = { supersede: ['required'], currentReportId: governing ? [governing] : [], currentReason: [removed.reason] };
          if (confirmSupersede !== true) {
            throw new AppError('The current restriction came from a different decision. Review it and confirm before lifting it.', 409, details);
          }
          // A confirmation names the decision the moderator saw; a newer one needs a fresh look.
          if (supersedeReportId !== undefined && supersedeReportId !== governing) {
            throw new AppError('The current restriction changed since you confirmed. Review the newer decision and confirm again.', 409, details);
          }
        }
        await ContentRestrictionEventModel.create({ userId, action: 'restore', reason: notes, actorId: req.userId, liftedReason: removed.reason, liftedReportId: removed.reportId });
        await AuditLogModel.create({ actorId: req.userId, actorRole: req.userRole, action: 'safety.restore_public_content', resource: `user:${userId}`, details: notes, reason: notes,
          changes: [{ field: 'publishingRestriction', before: `${removed.reason}${removed.reportId ? ` (report ${removed.reportId})` : ''}`, after: 'lifted' }],
          method: 'POST', path: req.originalUrl, statusCode: 200 });
      });
      res.json({ data: null });
    } catch (error) { next(error); }
  });
  return router;
}
