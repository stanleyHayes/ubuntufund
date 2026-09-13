import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import { PublicationReviewModel } from '../../../../database/models/PublicationReviewModel.js';
import { AuditLogModel } from '../../../../database/models/AuditLogModel.js';
import { MongoUnitOfWork } from '../../../outbound/persistence/MongoUnitOfWork.js';

export function createPublicationReviewRoutes(auth: RequestHandler, admin?: RequestHandler) {
  const router = Router();
  router.use(auth, (_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  if (admin) router.use(admin);
  router.get('/', async (req: AuthenticatedRequest, res, next) => {
    try {
      const page = Math.max(1, Math.min(10000, Math.floor(Number(req.query.page)) || 1));
      const status = z.enum(['pending', 'approved', 'rejected']).catch('pending').parse(req.query.status);
      const filter = admin ? { status } : { actorId: req.userId };
      const [items, total] = await Promise.all([
        PublicationReviewModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * 25).limit(25).lean(),
        PublicationReviewModel.countDocuments(filter),
      ]);
      res.json({ data: { total, items: items.map(item => ({
        id: String(item._id), action: item.action, resourceId: item.resourceId, text: item.text,
        mediaUrls: item.mediaUrls, status: item.status, reason: item.reason, createdAt: item.createdAt,
        reviewNotes: item.reviewNotes, approvalExpiresAt: item.approvalExpiresAt,
        ...(admin ? { actorId: item.actorId, reviewedBy: item.reviewedBy } : {}),
      })) } });
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
          throw new AppError('A final decision already exists for this version', 409);
        }
        const changed = await PublicationReviewModel.updateOne({ _id: current._id, status: 'pending' }, { $set: {
          status: input.decision, reviewedBy: req.userId, reviewedAt: new Date(), reviewNotes: input.notes,
          ...(input.decision === 'approved' ? { approvalExpiresAt: new Date(Date.now() + 7 * 86400000) } : {}),
        } });
        if (!changed.modifiedCount) throw new AppError('Another reviewer already decided this submission', 409);
        await AuditLogModel.create({ actorId: req.userId, actorRole: 'admin', action: `publication.${input.decision}`, resource: String(current._id), details: 'Publication version reviewed', reason: input.notes, severity: 'info', method: 'PUT', path: '/admin/publication-reviews/:id/review', statusCode: 200 });
      });
      res.json({ data: { reviewed: true } });
    } catch (error) { next(error instanceof z.ZodError ? new AppError('Choose a decision and enter at least 20 characters of review notes', 400) : error); }
  });
  return router;
}
