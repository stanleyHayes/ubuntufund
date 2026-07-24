import { Router } from 'express';
import { z } from 'zod';
import type { CollaborationController } from '../controllers/CollaborationController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

const respondToCollaborationSchema = z.object({
  accept: z.boolean(),
  declineReason: z.string().max(1000).optional(),
});

export function createCollaborationRoutes(
  controller: CollaborationController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();

  router.get('/invitations', authMiddleware, controller.listMyInvitations);

  router.put(
    '/:id/respond',
    authMiddleware,
    validate(respondToCollaborationSchema),
    controller.respond
  );

  return router;
}
