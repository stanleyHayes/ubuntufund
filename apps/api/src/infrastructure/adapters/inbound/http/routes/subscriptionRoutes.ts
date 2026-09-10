import { donationIntentRateLimiter } from '../../middleware/rateLimiter.js';
import { Router } from 'express';
import { z } from 'zod';
import { SubscriptionTier, BillingCycle } from '@ubuntu-fund/types';
import type { SubscriptionController } from '../controllers/SubscriptionController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';
import type { RequestHandler } from 'express';

const createSubscriptionSchema = z.object({
  tier: z.nativeEnum(SubscriptionTier),
  billingCycle: z.nativeEnum(BillingCycle),
});

const upgradeSubscriptionSchema = z.object({
  tier: z.nativeEnum(SubscriptionTier),
  billingCycle: z.nativeEnum(BillingCycle).optional(),
});

const createCheckoutSchema = z.object({
  tier: z.nativeEnum(SubscriptionTier),
  billingCycle: z.nativeEnum(BillingCycle),
  couponCode: z.string().min(1).max(50).optional(),
});

export function createSubscriptionRoutes(
  controller: SubscriptionController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  requireAdmin: RequestHandler
): Router {
  const router = Router();

  router.get('/', authMiddleware, requireAdmin, controller.list);

  router.get('/mine', authMiddleware, controller.getMine);

  // Paid-subscription Paystack checkout rail.
  router.post(
    '/checkout',
    authMiddleware,
    validate(createCheckoutSchema),
    controller.createCheckout
  );
  router.get('/checkout/:id', authMiddleware, controller.getCheckout);
  router.post('/checkout/reference/:reference/verify', authMiddleware, donationIntentRateLimiter, controller.verifyCheckoutReference);
  router.post('/checkout/:id/verify', authMiddleware, donationIntentRateLimiter, controller.verifyCheckout);

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
