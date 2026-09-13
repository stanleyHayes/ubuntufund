import { queuePageSize } from '../../middleware/queuePageSize.js';
import { Router } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest, createAuthMiddleware } from '../../middleware/authMiddleware.js';
import { requireAdmin } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { AccountDeletionRequestModel } from '../../../../database/models/AccountDeletionRequestModel.js';
import type { AccountErasurePort } from '../../../../../domain/ports/outbound/AccountErasurePort.js';
import { UserModel } from '../../../../database/models/UserModel.js';
import { AuditLogModel } from '../../../../database/models/AuditLogModel.js';
import { MongoUnitOfWork } from '../../../outbound/persistence/MongoUnitOfWork.js';
import { AppError } from '../../middleware/errorHandler.js';
export function createPrivacyRequestRoutes(auth: ReturnType<typeof createAuthMiddleware>, erasure: AccountErasurePort) {
  const router = Router();
  router.use(auth, requireAdmin);
  router.get('/', async (req, res, next) => {
    try {
      const pageSize = queuePageSize(req.query.pageSize);
      const page = Math.max(1, Math.min(10000, Math.floor(Number(req.query.page)) || 1));
      const [items, total] = await Promise.all([
        AccountDeletionRequestModel.find().sort({ nextReviewAt: 1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
        AccountDeletionRequestModel.countDocuments(),
      ]);
      res.set('Cache-Control', 'no-store').json({ data: { items, total, page, pageSize } });
    } catch (error) { next(error); }
  });
  router.post('/retry', async (_req, res, next) => {
    try { res.json({ data: { processed: await erasure.sweepPending() } }); }
    catch (error) { next(error); }
  });
  router.put('/:id/review', validate(z.object({
    revision: z.number().int().nonnegative(),
    reviewNotes: z.string().trim().min(20).max(5000),
    nextReviewAt: z.string().datetime().refine(value => Date.parse(value) > Date.now(), 'Set a future review date'),
  }).strict()), async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!/^[a-f0-9]{24}$/i.test(String(req.params.id))) { res.status(400).json({ message: 'Invalid request ID' }); return; }
      const item = await new MongoUnitOfWork().run(async () => {
        const staff = await UserModel.findOneAndUpdate({ _id: req.userId, role: 'admin', deletedAt: null,
          ...(req.authVersion ? { authVersion: req.authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] }),
        }, { $inc: { staffActionVersion: 1 } });
        if (!staff) throw new AppError('Current administrator access is required.', 403);
        const record = await AccountDeletionRequestModel.findOneAndUpdate({ _id: req.params.id,
          ...(req.body.revision === 0 ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] } : { revision: req.body.revision }),
        }, { $set: {
          reviewNotes: req.body.reviewNotes.trim(), nextReviewAt: new Date(req.body.nextReviewAt), reviewedBy: req.userId, reviewedAt: new Date(),
        }, $inc: { revision: 1 } }, { new: true });
        if (!record) throw new AppError('Request changed or is unavailable. Refresh before reviewing.', 409);
        await AuditLogModel.create({ actorId: req.userId, actorRole: 'admin', action: 'privacy.retention_review', resource: String(record._id),
          details: `Saved retention review revision ${record.revision}; next review ${record.nextReviewAt.toISOString()}`, method: 'PUT', path: req.originalUrl, statusCode: 200 });
        return record;
      });
      res.json({ data: item });
    } catch (error) { next(error); }
  });
  return router;
}
