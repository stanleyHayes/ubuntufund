import { Router } from 'express';
import type { OrganizationController } from '../controllers/OrganizationController.js';

// Public routes — no authMiddleware required, matching the public
// (unauthenticated) semantics of GET /campaigns and GET /users/:id/public.
export function createOrganizationRoutes(
  controller: OrganizationController
): Router {
  const router = Router();

  router.get('/', controller.list);
  router.get('/:slug', controller.getBySlug);
  router.get('/:id/campaigns', controller.getCampaigns);

  return router;
}
