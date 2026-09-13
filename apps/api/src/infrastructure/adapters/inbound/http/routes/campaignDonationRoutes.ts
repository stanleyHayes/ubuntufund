import { Router, type RequestHandler } from 'express';
import type { DonationController } from '../controllers/DonationController.js';

/**
 * Mounted at /campaigns, as a sibling router alongside createCampaignRoutes
 * (both can be `router.use('/campaigns', ...)`-ed onto the same prefix since
 * they own disjoint sub-paths). Kept separate so campaignRoutes.ts — owned by
 * the campaigns slice — doesn't need to be touched.
 *
 * GET /:id/donations — paginated, public donations for a single campaign.
 */
export function createCampaignDonationRoutes(
  controller: DonationController,
  optionalAuth: RequestHandler
): Router {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

  router.get('/:id/donations', optionalAuth, controller.listByCampaign);

  return router;
}
