import { Router } from 'express';
import { z } from 'zod';
import type { DisputeController } from '../controllers/DisputeController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';
import type { Request, Response, NextFunction } from 'express';

const resolveDisputeSchema = z.object({
  status: z.enum(['resolved', 'dismissed']).optional(),
  resolution: z.string().min(1).max(2000),
});

export function createDisputeRoutes(
  controller: DisputeController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  requireAdmin: (req: Request, res: Response, next: NextFunction) => void
): Router {
  const router = Router();

  router.get('/', authMiddleware, requireAdmin, controller.list);
  router.get('/:id', authMiddleware, requireAdmin, controller.getById);
  router.put(
    '/:id/resolve',
    authMiddleware,
    requireAdmin,
    validate(resolveDisputeSchema),
    controller.resolve
  );

  return router;
}
