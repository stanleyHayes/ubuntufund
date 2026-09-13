import { queuePageSize } from '../../middleware/queuePageSize.js';
import { CampaignModel } from '../../../../database/models/CampaignModel.js';
import { donationContentVersion as version, isDonationContentApproved } from '../../../../../domain/entities/donationPublicContent.js';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { DonationModel } from '../../../../database/models/DonationModel.js';
import { UserModel } from '../../../../database/models/UserModel.js';
import { ContentRestrictionModel } from '../../../../database/models/ContentRestrictionModel.js';
import { AuditLogModel } from '../../../../database/models/AuditLogModel.js';
import { MongoUnitOfWork } from '../../../outbound/persistence/MongoUnitOfWork.js';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';

export function donationContentReviewFilter(status: 'pending' | 'approved' | 'rejected') {
  return { publicContentRevokedAt: { $exists: false }, $and: [
        status === 'pending' ? { $or: [{ publicContentStatus: 'pending' }, { publicContentStatus: { $exists: false } }, { publicContentStatus: 'approved', publicContentFingerprint: { $exists: false } }] } : { publicContentStatus: status },
        { $or: [{ isAnonymous: false, donorName: { $nin: ['', null] } }, { message: { $nin: ['', null] }, messageHiddenAt: { $exists: false } }] },
      ] };
}

export function createDonationContentReviewRoutes(auth: RequestHandler, admin: RequestHandler) {
  const router = Router();
  router.use(auth, admin, (_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  router.get('/', async (req, res, next) => {
    try {
      const status = z.enum(['pending', 'approved', 'rejected']).catch('pending').parse(req.query.status);
      const pageSize = queuePageSize(req.query.pageSize);
      const page = Math.max(1, Math.min(10000, Math.floor(Number(req.query.page)) || 1));
      const filter = donationContentReviewFilter(status);
      const [rows, total] = await Promise.all([DonationModel.find(filter).sort({ createdAt: 1 }).skip((page - 1) * pageSize).limit(pageSize), DonationModel.countDocuments(filter)]);
      res.json({ data: { total, items: rows.map(donation => ({ id: String(donation._id), version: version(donation), action: 'donation.public_content', actorId: donation.donorId === 'guest' ? 'Guest' : donation.donorId, text: JSON.stringify({ donorName: donation.isAnonymous ? 'Anonymous' : donation.donorName ?? '', message: donation.messageHiddenAt ? '' : donation.message ?? '' }), mediaUrls: [], status: donation.publicContentStatus === 'approved' && !isDonationContentApproved(donation) ? 'pending' : donation.publicContentStatus ?? 'pending', reason: 'staff_requested', reviewNotes: donation.publicReviewNotes })) } });
    } catch (error) { next(error); }
  });
  router.put('/:id/review', async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = z.string().regex(/^[a-f0-9]{24}$/i).parse(req.params.id);
      const input = z.object({ version: z.string().regex(/^[a-f0-9]{64}$/), decision: z.enum(['approved', 'rejected']), notes: z.string().trim().min(20).max(2000) }).parse(req.body);
      await new MongoUnitOfWork().run(async () => {
        const staff = await UserModel.findOneAndUpdate({ _id: req.userId, role: 'admin', deletedAt: null, ...(req.authVersion ? { authVersion: req.authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] }) }, { $inc: { publicationWriteVersion: 1 } });
        if (!staff) throw new AppError('Your administrator session has ended.', 401);
        const donation = await DonationModel.findById(id);
        if (!donation || donation.publicContentRevokedAt) throw new AppError('Donor content is unavailable.', 404);
        const campaign = await CampaignModel.findById(donation.campaignId);
        if (!campaign) throw new AppError('Campaign is unavailable.', 404);
        if ([donation.donorId, campaign.creatorId].includes(req.userId!)) throw new AppError('Another administrator must review this content.', 403);
        if (version(donation) !== input.version) throw new AppError('The content changed. Refresh before reviewing.', 409);
        if ((input.decision !== 'approved' || isDonationContentApproved(donation)) && donation.publicContentStatus === input.decision && donation.publicReviewedBy === req.userId && donation.publicReviewNotes === input.notes) return;
        if (donation.publicContentStatus === 'rejected' || isDonationContentApproved(donation)) throw new AppError('This content already has a decision.', 409);
        if (input.decision === 'approved' && donation.donorId !== 'guest') {
          const author = await UserModel.findOneAndUpdate({ _id: donation.donorId, deletedAt: null }, { $inc: { publicationWriteVersion: 1 } });
          if (!author || await ContentRestrictionModel.exists({ userId: donation.donorId })) throw new AppError('This donor cannot publish content.', 409);
        }
        await DonationModel.updateOne({ _id: id }, { $set: { publicContentStatus: input.decision, publicContentFingerprint: input.version, publicReviewedBy: req.userId, publicReviewedAt: new Date(), publicReviewNotes: input.notes } });
        await AuditLogModel.create({ actorId: req.userId, actorRole: 'admin', action: `donation.content.${input.decision}`, resource: id, details: `Reviewed content version ${input.version}`, reason: input.notes, method: 'PUT', path: '/admin/donation-content-reviews/:id/review', statusCode: 200 });
      });
      res.json({ data: { reviewed: true } });
    } catch (error) { next(error instanceof z.ZodError ? new AppError('Choose a version and decision, with at least 20 characters of notes.', 400) : error); }
  });
  return router;
}
