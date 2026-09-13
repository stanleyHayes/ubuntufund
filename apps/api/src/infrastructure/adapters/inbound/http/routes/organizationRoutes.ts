import type { createOptionalAuthMiddleware } from '../../middleware/authMiddleware.js';
import { Router } from 'express';
import type { OrganizationController } from '../controllers/OrganizationController.js';

// Guest access remains available; authenticated viewers receive block-aware results.
export function createOrganizationRoutes(
  controller: OrganizationController,
  optionalAuth: ReturnType<typeof createOptionalAuthMiddleware>
): Router {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

  router.use(optionalAuth);

  router.get('/', controller.list);
  router.get('/:slug', controller.getBySlug);
  router.get('/:id/campaigns', controller.getCampaigns);

  return router;
}
