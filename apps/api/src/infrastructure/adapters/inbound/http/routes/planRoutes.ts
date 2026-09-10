import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { PlanController } from '../controllers/PlanController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

// The editable attributes of a plan. `tier` is the immutable key (route param on
// update / body field on create). Prices ≥ 0, platform fee 0–100%, numeric limits
// allow -1 (unlimited). Presentation fields (sortOrder/active/isPublic/accentColor/
// popular) let admins order, hide and colour any tier — including added ones.
const planAttributes = {
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400),
  priceMonthly: z.number().min(0),
  priceYearly: z.number().min(0),
  platformFeePercent: z.number().min(0).max(100),
  maxActiveCampaigns: z.number().int().min(-1),
  maxCampaignGoal: z.number().min(-1),
  maxMediaPerCampaign: z.number().int().min(-1),
  maxTeamMembers: z.number().int().min(-1),
  maxPayoutAccounts: z.number().int().min(-1).optional(),
  maxCollaboratorsPerCampaign: z.number().int().min(-1),
  featuredListing: z.boolean(),
  prioritySupport: z.boolean(),
  advancedAnalytics: z.boolean(),
  customBranding: z.boolean(),
  escrowSupport: z.boolean(),
  liveStreaming: z.boolean(),
  campaignCollaboration: z.boolean(),
  sortOrder: z.number().int().min(0),
  active: z.boolean(),
  isPublic: z.boolean(),
  accentColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be a hex colour'),
  popular: z.boolean(),
} as const;

// Update: every field optional, at least one present. `tier` can never be edited.
const updatePlanSchema = z
  .object(planAttributes)
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

// Create: a new tier id plus the required commercial fields; the rest optional.
const createPlanSchema = z.object({
  tier: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z][a-z0-9_-]*$/, 'Tier id must be lowercase letters, digits, - or _'),
  name: planAttributes.name,
  description: planAttributes.description.optional(),
  priceMonthly: planAttributes.priceMonthly,
  priceYearly: planAttributes.priceYearly,
  platformFeePercent: planAttributes.platformFeePercent,
  maxActiveCampaigns: planAttributes.maxActiveCampaigns,
  maxCampaignGoal: planAttributes.maxCampaignGoal,
  maxMediaPerCampaign: planAttributes.maxMediaPerCampaign.optional(),
  maxTeamMembers: planAttributes.maxTeamMembers.optional(),
  maxPayoutAccounts: planAttributes.maxPayoutAccounts,
  maxCollaboratorsPerCampaign: planAttributes.maxCollaboratorsPerCampaign.optional(),
  featuredListing: planAttributes.featuredListing.optional(),
  prioritySupport: planAttributes.prioritySupport.optional(),
  advancedAnalytics: planAttributes.advancedAnalytics.optional(),
  customBranding: planAttributes.customBranding.optional(),
  escrowSupport: planAttributes.escrowSupport.optional(),
  liveStreaming: planAttributes.liveStreaming.optional(),
  campaignCollaboration: planAttributes.campaignCollaboration.optional(),
  sortOrder: planAttributes.sortOrder.optional(),
  active: planAttributes.active.optional(),
  isPublic: planAttributes.isPublic.optional(),
  accentColor: planAttributes.accentColor.optional(),
  popular: planAttributes.popular.optional(),
});

export function createPlanRoutes(
  controller: PlanController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  requireAdmin: RequestHandler
): Router {
  const router = Router();

  router.get('/public', controller.publicList);

  // Authed display: pricing/limits for the web + admin surfaces.
  router.get('/', authMiddleware, controller.list);

  // Admin only: add a new plan/tier (Resource.PLANS CREATE).
  router.post(
    '/',
    authMiddleware,
    requireAdmin,
    validate(createPlanSchema),
    controller.create
  );

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
