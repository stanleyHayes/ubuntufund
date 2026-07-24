import { Router } from 'express';
import type { AnalyticsController } from '../controllers/AnalyticsController.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

/**
 * Mounted at /analytics.
 *
 * GET /overview — authenticated (any role). Returns platform-wide totals
 * consumed by both the admin dashboard (PlatformStats shape) and the web
 * app's profile-impact panel, so this is intentionally NOT admin-gated.
 */
export function createAnalyticsRoutes(
  controller: AnalyticsController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();

  router.get('/overview', authMiddleware, controller.overview);

  return router;
}
