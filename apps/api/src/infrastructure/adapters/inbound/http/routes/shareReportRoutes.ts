import { Router } from 'express';
import { z } from 'zod';
import type { ShareReportController } from '../controllers/ShareReportController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

const shareSchema = z.object({
  platform: z.string().min(1).max(50).optional(),
});

const REPORT_REASONS = [
  'fraudulent',
  'misleading',
  'inappropriate_content',
  'spam',
  'illegal_activity',
  'other',
] as const;

const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
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
