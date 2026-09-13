import { tipContentVersion as version, isTipContentApproved } from '../../../../../domain/entities/tipPublicContent.js';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { TipModel } from '../../../../database/models/TipModel.js';
import { UserModel } from '../../../../database/models/UserModel.js';
import { ContentRestrictionModel } from '../../../../database/models/ContentRestrictionModel.js';
import { AuditLogModel } from '../../../../database/models/AuditLogModel.js';
import { MongoUnitOfWork } from '../../../outbound/persistence/MongoUnitOfWork.js';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';

export function tipContentReviewFilter(status: 'pending' | 'approved' | 'rejected') {
  return { status: 'SUCCEEDED', checkoutRevokedAt: { $exists: false }, $and: [
        status === 'pending' ? { $or: [{ publicContentStatus: 'pending' }, { publicContentStatus: { $exists: false } }, { publicContentStatus: 'approved', publicContentFingerprint: { $exists: false } }] } : { publicContentStatus: status },
        { $or: [{ isAnonymous: false, supporterName: { $nin: ['', null] } }, { message: { $nin: ['', null] }, messageHiddenAt: { $exists: false } }] },
      ] };
}

export function createTipContentReviewRoutes(auth: RequestHandler, admin: RequestHandler) {
  const router = Router();
  router.use(auth, admin, (_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  router.get('/', async (req, res, next) => {
    try {
      const status = z.enum(['pending', 'approved', 'rejected']).catch('pending').parse(req.query.status);
      const page = Math.max(1, Math.min(10000, Math.floor(Number(req.query.page)) || 1));
      const filter = tipContentReviewFilter(status);
      const [rows, total] = await Promise.all([TipModel.find(filter).sort({ createdAt: 1 }).skip((page - 1) * 25).limit(25), TipModel.countDocuments(filter)]);
      res.json({ data: { total, items: rows.map(tip => ({ id: String(tip._id), version: version(tip), action: 'tip.public_content', actorId: tip.supporterUserId ?? 'Guest', text: JSON.stringify({ supporterName: tip.isAnonymous ? 'Anonymous' : tip.supporterName ?? '', message: tip.messageHiddenAt ? '' : tip.message ?? '' }), mediaUrls: [], status: tip.publicContentStatus === 'approved' && !isTipContentApproved(tip) ? 'pending' : tip.publicContentStatus ?? 'pending', reason: 'staff_requested', reviewNotes: tip.publicReviewNotes })) } });
    } catch (error) { next(error); }
  });
  router.put('/:id/review', async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = z.string().regex(/^[a-f0-9]{24}$/i).parse(req.params.id);
      const input = z.object({ version: z.string().regex(/^[a-f0-9]{64}$/), decision: z.enum(['approved', 'rejected']), notes: z.string().trim().min(20).max(2000) }).parse(req.body);
      await new MongoUnitOfWork().run(async () => {
        const staff = await UserModel.findOneAndUpdate({ _id: req.userId, role: 'admin', deletedAt: null, ...(req.authVersion ? { authVersion: req.authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] }) }, { $inc: { publicationWriteVersion: 1 } });
        if (!staff) throw new AppError('Your administrator session has ended.', 401);
        const tip = await TipModel.findById(id);
        if (!tip || tip.status !== 'SUCCEEDED' || tip.checkoutRevokedAt) throw new AppError('Supporter content is unavailable.', 404);
        if ([tip.supporterUserId, tip.creatorUserId].includes(req.userId!)) throw new AppError('Another administrator must review this content.', 403);
        if (version(tip) !== input.version) throw new AppError('The content changed. Refresh before reviewing.', 409);
        if ((input.decision !== 'approved' || isTipContentApproved(tip)) && tip.publicContentStatus === input.decision && tip.publicReviewedBy === req.userId && tip.publicReviewNotes === input.notes) return;
        if (tip.publicContentStatus === 'rejected' || isTipContentApproved(tip)) throw new AppError('This content already has a decision.', 409);
        if (input.decision === 'approved' && tip.supporterUserId) {
          const author = await UserModel.findOneAndUpdate({ _id: tip.supporterUserId, deletedAt: null }, { $inc: { publicationWriteVersion: 1 } });
          if (!author || await ContentRestrictionModel.exists({ userId: tip.supporterUserId })) throw new AppError('This supporter cannot publish content.', 409);
        }
        await TipModel.updateOne({ _id: id }, { $set: { publicContentStatus: input.decision, publicContentFingerprint: input.version, publicReviewedBy: req.userId, publicReviewedAt: new Date(), publicReviewNotes: input.notes } });
        await AuditLogModel.create({ actorId: req.userId, actorRole: 'admin', action: `tip.content.${input.decision}`, resource: id, details: `Reviewed content version ${input.version}`, reason: input.notes, method: 'PUT', path: '/admin/tip-content-reviews/:id/review', statusCode: 200 });
      });
      res.json({ data: { reviewed: true } });
    } catch (error) { next(error instanceof z.ZodError ? new AppError('Choose a version and decision, with at least 20 characters of notes.', 400) : error); }
  });
  return router;
}
