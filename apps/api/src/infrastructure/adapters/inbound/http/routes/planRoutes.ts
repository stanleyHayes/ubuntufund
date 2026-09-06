import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { PlanController } from '../controllers/PlanController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

// Editable plan fields. `tier` is immutable (it is the route param key) and is
// intentionally absent. Prices ≥ 0, platform fee 0–100%, and the numeric limits
// allow -1 (unlimited). At least one field must be present.
const updatePlanSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(400),
    priceMonthly: z.number().min(0),
    priceYearly: z.number().min(0),
    platformFeePercent: z.number().min(0).max(100),
    maxActiveCampaigns: z.number().int().min(-1),
    maxCampaignGoal: z.number().min(-1),
    maxMediaPerCampaign: z.number().int().min(-1),
    maxTeamMembers: z.number().int().min(-1),
    maxCollaboratorsPerCampaign: z.number().int().min(-1),
    featuredListing: z.boolean(),
    prioritySupport: z.boolean(),
    advancedAnalytics: z.boolean(),
    customBranding: z.boolean(),
    escrowSupport: z.boolean(),
    liveStreaming: z.boolean(),
    campaignCollaboration: z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export function createPlanRoutes(
  controller: PlanController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  requireAdmin: RequestHandler
): Router {
  const router = Router();

  // Authed display: pricing/limits for the web + admin surfaces.
  router.get('/', authMiddleware, controller.list);

  // Admin only: edit a plan's pricing/limits/benefits (Resource.PLANS UPDATE).
  router.put(
    '/:tier',
    authMiddleware,
    requireAdmin,
    validate(updatePlanSchema),
    controller.update
  );

  return router;
}
