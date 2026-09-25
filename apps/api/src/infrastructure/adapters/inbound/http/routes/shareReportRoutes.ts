import { Router } from 'express';
import { z } from 'zod';
import { CAMPAIGN_REPORT_REASONS } from '@ubuntu-fund/types';
import type { ShareReportController } from '../controllers/ShareReportController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

const shareSchema = z.object({
  platform: z.string().min(1).max(50).optional(),
});

// Shared with the web and native report forms so no client can send a reason
// this validator rejects.
const reportSchema = z.object({
  reason: z.enum(CAMPAIGN_REPORT_REASONS),
  description: z.string().max(2000).optional(),
});

// NOTE: These endpoints extend the /campaigns resource (POST /campaigns/:id/share,
// POST /campaigns/:id/report). Since campaignRoutes.ts is an existing file outside
// this slice, this router is mounted separately at the same '/campaigns' base path
// (see mount descriptor returned by this task) rather than added to campaignRoutes.ts.
export function createShareReportRoutes(
  controller: ShareReportController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();

  router.post(
    '/:id/share',
    authMiddleware,
    validate(shareSchema),
    controller.share
  );

  router.post(
    '/:id/report',
    authMiddleware,
    validate(reportSchema),
    controller.report
  );

  return router;
}
