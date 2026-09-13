import { Router } from 'express';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import type { CampaignModerationController } from '../controllers/CampaignModerationController.js';
import { CampaignReviewModel } from '../../../../database/models/CampaignReviewModel.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

const approveCampaignSchema = z.object({
  action: z.enum(['approve', 'reject', 'block', 'reopen']).optional().default('approve'),
  reason: z.string().trim().min(20).max(2000),
  expectedVersion: z.string().regex(/^[a-f0-9]{64}$/),
  contentReviewed: z.boolean().optional(),
  fundraisingReviewed: z.boolean().optional(),
});

const rejectCampaignSchema = approveCampaignSchema.omit({ action: true });

// NOTE: These endpoints extend the /campaigns resource (PUT /campaigns/:id/approve,
// PUT /campaigns/:id/reject). Since campaignRoutes.ts is an existing file outside
// this slice, this router is mounted separately at the same '/campaigns' base path
// (see mount descriptor returned by this task) rather than added to campaignRoutes.ts.
export function createCampaignModerationRoutes(
  controller: CampaignModerationController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  requireAdmin: (req: Request, res: Response, next: NextFunction) => void
): Router {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  router.get('/:id/reviews', authMiddleware, requireAdmin, async (req, res, next) => {
    try {
      const page = Math.max(1, Math.min(10000, Math.floor(Number(req.query.page)) || 1));
      const filter = { campaignId: req.params.id };
      const [items, total] = await Promise.all([CampaignReviewModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 25).limit(25).select('-__v').lean(), CampaignReviewModel.countDocuments(filter)]);
      res.json({ data: { items: items.map(({ _id, ...item }) => ({ ...item, id: String(_id) })), total } });
    } catch (error) { next(error); }
  });
  router.put('/:id/review', authMiddleware, requireAdmin, validate(approveCampaignSchema), controller.approve);

  router.put(
    '/:id/approve',
    authMiddleware,
    requireAdmin,
    validate(approveCampaignSchema),
    controller.approve
  );
  router.put(
    '/:id/reject',
    authMiddleware,
    requireAdmin,
    validate(rejectCampaignSchema),
    controller.reject
  );

  return router;
}
