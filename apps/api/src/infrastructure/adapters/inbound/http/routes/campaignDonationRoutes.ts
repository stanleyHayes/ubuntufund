import { Router } from 'express';
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
  controller: DonationController
): Router {
  const router = Router();

  router.get('/:id/donations', controller.listByCampaign);

  return router;
}
