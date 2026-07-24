import { Router } from 'express';
import type { ProfileController } from '../controllers/ProfileController.js';

// Public routes — no authMiddleware required, matching the public
// (unauthenticated) semantics of GET /campaigns/:id.
export function createUserRoutes(controller: ProfileController): Router {
  const router = Router();

  router.get('/:id/public', controller.getPublicProfile);

  return router;
}
