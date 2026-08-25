import { Router } from 'express';
import { z } from 'zod';
import type { ShortLinkController } from '../controllers/ShortLinkController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

const createQrCodeSchema = z.object({
  kind: z.enum(['campaign', 'live', 'amount', 'creator', 'event']),
  presetAmount: z.number().positive().optional(),
  label: z.string().max(120).optional(),
  liveSessionId: z.string().max(200).optional(),
});

/**
 * Owner/admin QR-code management for a campaign. Extends the /campaigns
 * resource (mounted alongside the other campaign sub-routers in app.ts).
 */
export function createCampaignQrRoutes(
  controller: ShortLinkController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();

  router.post(
    '/:id/qr-codes',
    authMiddleware,
    validate(createQrCodeSchema),
    controller.createForCampaign
  );
  router.get('/:id/qr-codes', authMiddleware, controller.listForCampaign);

  return router;
}

/**
 * Public short-link surface, mounted at the app root (outside /api/v1) so the
 * URLs stay short and shareable:
 *   GET /r/:code        → 302 redirect (records scan, forwards utm)
 *   GET /qr/:code.svg   → inline SVG QR of the short URL
 *   GET /qr/:code.png   → PNG QR of the short URL
 */
export function createShortLinkPublicRoutes(
  controller: ShortLinkController
): Router {
  const router = Router();

  router.get('/r/:code', controller.redirect);
  router.get('/qr/:code.svg', controller.svg);
  router.get('/qr/:code.png', controller.png);

  return router;
}
