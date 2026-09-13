import type { createOptionalAuthMiddleware } from '../../middleware/authMiddleware.js';
import { Router } from 'express';
import type { LeaderboardController } from '../controllers/LeaderboardController.js';

// Leaderboard endpoints are public read-only aggregates (no auth required),
// mirroring the public GET routes in campaignRoutes.ts (list/getById).
export function createLeaderboardRoutes(
  controller: LeaderboardController,
  optionalAuth: ReturnType<typeof createOptionalAuthMiddleware>
): Router {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  router.use(optionalAuth);

  router.get('/', controller.list);
  router.get('/stats', controller.stats);
  router.get('/featured', controller.featured);

  return router;
}
