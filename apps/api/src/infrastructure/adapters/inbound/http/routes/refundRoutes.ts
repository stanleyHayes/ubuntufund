import { Router } from 'express';
import { z } from 'zod';
import type { RefundController } from '../controllers/RefundController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

const requestRefundSchema = z.object({
  donationId: z.string().min(1),
  reason: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export function createRefundRoutes(
  controller: RefundController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();

  // NOTE: registered before any '/:id'-style route (none exist in this slice
  // yet) so a literal 'mine' segment is never swallowed by an id param.
  router.get('/mine', authMiddleware, controller.listMine);
  router.post(
    '/',
    authMiddleware,
    validate(requestRefundSchema),
    controller.create
  );

  return router;
}
