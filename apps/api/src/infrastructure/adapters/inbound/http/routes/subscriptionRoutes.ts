import { Router } from 'express';
import { z } from 'zod';
import { SubscriptionTier, BillingCycle } from '@ubuntu-fund/types';
import type { SubscriptionController } from '../controllers/SubscriptionController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

const createSubscriptionSchema = z.object({
  tier: z.nativeEnum(SubscriptionTier),
  billingCycle: z.nativeEnum(BillingCycle),
});

const upgradeSubscriptionSchema = z.object({
  tier: z.nativeEnum(SubscriptionTier),
  billingCycle: z.nativeEnum(BillingCycle).optional(),
});

export function createSubscriptionRoutes(
  controller: SubscriptionController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();

  router.get('/mine', authMiddleware, controller.getMine);
  router.post(
    '/',
    authMiddleware,
    validate(createSubscriptionSchema),
    controller.subscribe
  );
  router.put(
    '/upgrade',
    authMiddleware,
    validate(upgradeSubscriptionSchema),
    controller.upgrade
  );
  router.post('/cancel', authMiddleware, controller.cancel);

  return router;
}
