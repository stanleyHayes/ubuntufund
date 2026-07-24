import { Router } from 'express';
import type { LeaderboardController } from '../controllers/LeaderboardController.js';

// Leaderboard endpoints are public read-only aggregates (no auth required),
// mirroring the public GET routes in campaignRoutes.ts (list/getById).
export function createLeaderboardRoutes(
  controller: LeaderboardController
): Router {
  const router = Router();

  router.get('/', controller.list);
  router.get('/stats', controller.stats);
  router.get('/featured', controller.featured);

  return router;
}
