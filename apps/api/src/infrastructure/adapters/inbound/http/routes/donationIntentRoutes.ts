import { Router } from 'express';
import { z } from 'zod';
import type { DonationIntentController } from '../controllers/DonationIntentController.js';
import { validate } from '../../middleware/validate.js';
import { donationIntentRateLimiter } from '../../middleware/rateLimiter.js';
import type {
  createAuthMiddleware,
  createOptionalAuthMiddleware,
} from '../../middleware/authMiddleware.js';

const createDonationIntentSchema = z.object({
  campaignId: z.string().min(1),
  liveSessionId: z.string().min(1).optional(),
  amount: z.number().positive(),
  tip: z.number().min(0).optional(),
  provider: z.enum(['wallet', 'paystack']),
  donorEmail: z.string().email().optional(),
  donorName: z.string().max(120).optional(),
  message: z.string().max(500).optional(),
  isAnonymous: z.boolean().optional(),
  attribution: z.string().max(120).optional(),
  idempotencyKey: z.string().max(200).optional(),
});

const recordPaymentAttemptSchema = z.object({
  provider: z.enum(['wallet', 'paystack']),
  providerRef: z.string().max(200).optional(),
  status: z.enum(['initiated', 'succeeded', 'failed']),
  raw: z.record(z.unknown()).optional(),
});

/**
 * The /donation-intents resource (all PUBLIC — guest checkout capable):
 *   POST /                       → create an intent (wallet settles inline)
 *   POST /:id/payment-attempts   → record a checkout attempt
 *   GET  /:id/public             → poll intent status
 *
 * Create/record carry a dedicated rate limiter (unauthenticated money writes);
 * create takes optional auth so an authenticated wallet donor is recognized
 * while guests still pass through.
 */
export function createDonationIntentRoutes(
  controller: DonationIntentController,
  optionalAuthMiddleware: ReturnType<typeof createOptionalAuthMiddleware>
): Router {
  const router = Router();

  router.post(
    '/',
    donationIntentRateLimiter,
    optionalAuthMiddleware,
    validate(createDonationIntentSchema),
    controller.create
  );

  router.post(
    '/:id/payment-attempts',
    donationIntentRateLimiter,
    validate(recordPaymentAttemptSchema),
    controller.recordAttempt
  );

  router.get('/:id/public', controller.getPublic);

  return router;
}

const addDonationMessageSchema = z.object({
  message: z.string().min(1).max(500),
});

/**
 * Extends the /donations resource with the post-donation message endpoint,
 * mounted alongside the read-only donation routes:
 *   POST /donations/:id/message  → donor adds/edits their donation's message
 * Authenticated; only the donation's owner may edit (enforced in the use-case).
 */
export function createDonationMessageRoutes(
  controller: DonationIntentController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();

  router.post(
    '/:id/message',
    authMiddleware,
    validate(addDonationMessageSchema),
    controller.addMessage
  );

  return router;
}
