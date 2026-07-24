import { Router } from 'express';
import type { DonationController } from '../controllers/DonationController.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

/**
 * Mounted at /donations.
 *
 * GET /            — public, recent donations feed (?limit=N)
 * GET /mine         — authenticated donor's own donation history
 * GET /:id          — a single donation owned by the requesting user
 *
 * NOTE: /mine and /:id must be declared in that order so 'mine' isn't
 * swallowed by the /:id param route.
 */
export function createDonationRoutes(
  controller: DonationController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();

  router.get('/', controller.listRecent);
  router.get('/mine', authMiddleware, controller.listMine);
  router.get('/:id', authMiddleware, controller.getById);

  return router;
}
