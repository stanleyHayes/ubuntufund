import { legalAcceptanceSchema } from './legalAcceptanceSchema.js';
import { Router } from 'express';
import { z } from 'zod';
import { CampaignCategory, CampaignPriority, PaymentMethod } from '@ubuntu-fund/types';
import type { CampaignController } from '../controllers/CampaignController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware, createOptionalAuthMiddleware } from '../../middleware/authMiddleware.js';

const createCampaignSchema = z.object({
  automatedReviewConsent: z.boolean().optional(),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  goalAmount: z.number().positive(),
  currency: z.string().min(2).max(5),
  category: z.nativeEnum(CampaignCategory),
  priority: z.nativeEnum(CampaignPriority),
  beneficiaries: z.array(z.string().max(200)).max(20).default([]),
  endDate: z.string().datetime(),
  imageUrls: z.array(z.string().url()).max(10).optional(),
});

const donateSchema = z.object({
  legalAcceptance: legalAcceptanceSchema.optional(),
  amount: z.number().positive(),
  currency: z.string().min(2).max(5),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.WALLET),
  message: z.string().max(500).optional(),
  isAnonymous: z.boolean().default(false),
  // Optional live-session attribution: drives overlay stats + real-time events.
  liveSessionId: z.string().max(200).optional(),
  attributionSource: z.string().max(64).optional(),
});

const setSlugSchema = z.object({
  automatedReviewConsent: z.boolean().optional(),
  slug: z
    .string()
    .min(3)
    .max(60)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug must be lowercase letters, numbers, and single hyphens'
    ),
});

export function createCampaignRoutes(
  controller: CampaignController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  optionalAuth: ReturnType<typeof createOptionalAuthMiddleware>
): Router {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

  router.get('/', optionalAuth, controller.list);
  router.get('/creation-options', authMiddleware, controller.creationOptions);
  router.get('/mine', authMiddleware, controller.listMine);
  // Public read by vanity slug (distinct 3-segment path — never shadows /:id).
  router.get('/slug/:slug/public', controller.getBySlugPublic);
  router.get('/:id', optionalAuth, controller.getById);
  router.post(
    '/',
    authMiddleware,
    validate(createCampaignSchema),
    controller.create
  );
  router.post(
    '/:id/donate',
    authMiddleware,
    validate(donateSchema),
    controller.donate
  );
  // Owner (or admin) sets a custom vanity slug.
  router.patch(
    '/:id/slug',
    authMiddleware,
    validate(setSlugSchema),
    controller.setSlug
  );

  return router;
}
