import { Router } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest, createAuthMiddleware } from '../../middleware/authMiddleware.js';
import { requireAdmin } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { AccountDeletionRequestModel } from '../../../../database/models/AccountDeletionRequestModel.js';
import type { AccountErasurePort } from '../../../../../domain/ports/outbound/AccountErasurePort.js';
export function createPrivacyRequestRoutes(auth: ReturnType<typeof createAuthMiddleware>, erasure: AccountErasurePort) {
  const router = Router();
  router.use(auth, requireAdmin);
  router.get('/', async (req, res, next) => {
    try {
      const page = Math.max(1, Math.min(10000, Math.floor(Number(req.query.page)) || 1));
      const [items, total] = await Promise.all([
        AccountDeletionRequestModel.find().sort({ nextReviewAt: 1 }).skip((page - 1) * 25).limit(25).lean(),
        AccountDeletionRequestModel.countDocuments(),
      ]);
      res.set('Cache-Control', 'no-store').json({ data: { items, total, page, pageSize: 25 } });
    } catch (error) { next(error); }
  });
  router.post('/retry', async (_req, res, next) => {
    try { res.json({ data: { processed: await erasure.sweepPending() } }); }
    catch (error) { next(error); }
  });
  router.put('/:id/review', validate(z.object({
    reviewNotes: z.string().trim().min(20).max(5000),
    nextReviewAt: z.string().datetime().refine(value => Date.parse(value) > Date.now(), 'Set a future review date'),
  })), async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!/^[a-f0-9]{24}$/i.test(String(req.params.id))) { res.status(400).json({ message: 'Invalid request ID' }); return; }
      const item = await AccountDeletionRequestModel.findByIdAndUpdate(req.params.id, { $set: {
        reviewNotes: req.body.reviewNotes, nextReviewAt: new Date(req.body.nextReviewAt), reviewedBy: req.userId, reviewedAt: new Date(),
      } }, { new: true });
      if (!item) { res.status(404).json({ message: 'Request not found' }); return; }
      res.json({ data: item });
    } catch (error) { next(error); }
  });
  return router;
}
