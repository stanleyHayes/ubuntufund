import { Router } from 'express';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import type { AdminReportController } from '../controllers/AdminReportController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

const reviewReportSchema = z.object({
  status: z.enum(['reviewed', 'dismissed']),
});

/**
 * Moderation console listing for campaign reports (Resource.REPORTS).
 * Distinct from the donor-facing POST /campaigns/:id/report endpoint
 * (see shareReportRoutes.ts) which creates these records.
 */
export function createAdminReportRoutes(
  controller: AdminReportController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  requireAdmin: (req: Request, res: Response, next: NextFunction) => void
): Router {
  const router = Router();

  router.get('/', authMiddleware, requireAdmin, controller.list);
  router.get('/:id', authMiddleware, requireAdmin, controller.getById);
  router.put(
    '/:id/review',
    authMiddleware,
    requireAdmin,
    validate(reviewReportSchema),
    controller.review
  );

  return router;
}
