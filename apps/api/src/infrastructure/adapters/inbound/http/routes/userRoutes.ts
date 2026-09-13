import { Router } from 'express';
import type { ProfileController } from '../controllers/ProfileController.js';
import type { createOptionalAuthMiddleware } from '../../middleware/authMiddleware.js';

// Guests can read public profiles; authenticated reads honor bilateral blocks.
export function createUserRoutes(controller: ProfileController, optionalAuth: ReturnType<typeof createOptionalAuthMiddleware>): Router {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  router.get('/:id/public', optionalAuth, controller.getPublicProfile);

  return router;
}
