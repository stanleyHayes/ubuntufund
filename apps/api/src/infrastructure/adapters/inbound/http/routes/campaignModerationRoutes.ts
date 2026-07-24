import { Router } from 'express';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import type { CampaignModerationController } from '../controllers/CampaignModerationController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

const approveCampaignSchema = z.object({
  action: z.enum(['approve', 'reject', 'block']).optional().default('approve'),
  reason: z.string().max(1000).optional(),
});

const rejectCampaignSchema = z.object({
  reason: z.string().min(1).max(1000),
});

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
