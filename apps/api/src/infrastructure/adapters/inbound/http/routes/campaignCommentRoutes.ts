import { Router } from 'express';
import { z } from 'zod';
import type { CampaignCommentController } from '../controllers/CampaignCommentController.js';
import type { createAuthMiddleware, createOptionalAuthMiddleware } from '../../middleware/authMiddleware.js';
import { validate } from '../../middleware/validate.js';

export function createCampaignCommentRoutes(
  controller: CampaignCommentController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  optionalAuth: ReturnType<typeof createOptionalAuthMiddleware>
): Router {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  router.get('/:id/comments', optionalAuth, controller.list);
  router.post('/:id/comments', authMiddleware, validate(z.object({ automatedReviewConsent: z.boolean().optional(), content: z.string().trim().min(1).max(1000) })), controller.create);
  router.delete('/:id/comments/:commentId', authMiddleware, controller.remove);
  return router;
}
