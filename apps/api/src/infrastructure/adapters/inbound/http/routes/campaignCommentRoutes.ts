import { Router } from 'express';
import { z } from 'zod';
import type { CampaignCommentController } from '../controllers/CampaignCommentController.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';
import { validate } from '../../middleware/validate.js';

export function createCampaignCommentRoutes(
  controller: CampaignCommentController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();
  router.get('/:id/comments', controller.list);
  router.post('/:id/comments', authMiddleware, validate(z.object({ content: z.string().trim().min(1).max(1000) })), controller.create);
  router.delete('/:id/comments/:commentId', authMiddleware, controller.remove);
  return router;
}
