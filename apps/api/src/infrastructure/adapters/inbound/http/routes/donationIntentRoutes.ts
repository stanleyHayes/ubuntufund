import { legalAcceptanceSchema } from './legalAcceptanceSchema.js';
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
  legalAcceptance: legalAcceptanceSchema.optional(),
  campaignId: z.string().min(1),
  liveSessionId: z.string().min(1).optional(),
  amount: z.number().positive(),
  tip: z.number().min(0).optional(),
  provider: z.enum(['wallet', 'paystack', 'flutterwave']),
  donorEmail: z.string().email().optional(),
  donorName: z.string().max(120).optional(),
  message: z.string().max(500).optional(),
  isAnonymous: z.boolean().optional(),
  attribution: z.string().max(120).optional(),
  idempotencyKey: z.string().max(200).optional(),
  // Multi-currency / diaspora fields (spec §11). All optional; the use-case
  // rejects a non-campaign currency unless multi-currency is enabled.
  currency: z.string().regex(/^[A-Za-z]{3}$/).optional(),
  country: z.string().regex(/^[A-Za-z]{2}$/).optional(),
  paymentMethod: z.enum(['mobile_money', 'card', 'bank', 'ussd', 'wallet']).optional(),
  providerPreference: z.enum(['wallet', 'paystack', 'flutterwave']).optional(),
  // Waives part of the PLATFORM FEE, not the donation. The campaign receives
  // more; the donor gives exactly what they chose.
  couponCode: z.string().min(1).max(50).optional(),
});

/**
 * The /donation-intents resource (all PUBLIC — guest checkout capable):
 *   POST /                       → create an intent (wallet settles inline)
 *   GET  /:id/public             → poll intent status
 *   POST /:id/verify             → server-verify a hosted checkout by reference
 *
 * There is deliberately no client endpoint to record payment attempts or set a
 * provider reference: only the server's gateway calls mint references, so a
 * caller can never plant another payment's reference on an intent.
 *
 * Create/verify carry a dedicated rate limiter (unauthenticated money writes);
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

  router.get('/:id/public', controller.getPublic);
  router.post(
    '/:id/verify',
    donationIntentRateLimiter,
    validate(z.object({ reference: z.string().min(1).max(200) })),
    controller.verify
  );

  return router;
}

const addDonationMessageSchema = z.object({
  legalAcceptance: legalAcceptanceSchema.optional(),
  message: z.string().trim().min(1).max(500),
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
