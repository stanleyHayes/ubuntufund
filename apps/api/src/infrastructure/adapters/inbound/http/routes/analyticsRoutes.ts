import { Router, type RequestHandler } from 'express';
import type { AnalyticsController } from '../controllers/AnalyticsController.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

/**
 * Mounted at /analytics. Both routes return platform-wide totals for the staff
 * console, so both are admin-only.
 */
export function createAnalyticsRoutes(
  controller: AnalyticsController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  requireAdmin: RequestHandler
): Router {
  const router = Router();

  router.get('/overview', authMiddleware, requireAdmin, controller.overview);
  router.get('/reports', authMiddleware, requireAdmin, controller.reports);

  return router;
}
