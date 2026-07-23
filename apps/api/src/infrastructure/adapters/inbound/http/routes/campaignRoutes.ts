import { Router } from 'express';
import { z } from 'zod';
import { CampaignCategory, CampaignPriority } from '@ubuntu-fund/types';
import type { CampaignController } from '../controllers/CampaignController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

const createCampaignSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  goalAmount: z.number().positive(),
  currency: z.string().min(2).max(5),
  category: z.nativeEnum(CampaignCategory),
  priority: z.nativeEnum(CampaignPriority),
  beneficiaries: z.array(z.string()).default([]),
  endDate: z.string().datetime(),
});

const donateSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(2).max(5),
  message: z.string().max(500).optional(),
  isAnonymous: z.boolean().default(false),
});

export function createCampaignRoutes(
  controller: CampaignController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();

  router.get('/', controller.list);
  router.get('/:id', controller.getById);
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

  return router;
}
