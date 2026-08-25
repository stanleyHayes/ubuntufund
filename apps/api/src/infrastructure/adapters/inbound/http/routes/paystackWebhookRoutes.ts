import express, { Router } from 'express';
import type { PaystackWebhookController } from '../controllers/PaystackWebhookController.js';

/**
 * The Paystack webhook resource:
 *   POST /webhooks/paystack  → authoritative charge settlement
 *
 * Mounted OUTSIDE the JSON body parser (see app.ts) with `express.raw`, so the
 * handler receives the untouched request bytes — the HMAC-SHA512 signature is
 * verified against exactly those bytes. Any content-type is accepted (Paystack
 * sends application/json) and the payload cap guards against oversized bodies.
 */
export function createPaystackWebhookRoutes(
  controller: PaystackWebhookController
): Router {
  const router = Router();

  router.post(
    '/',
    express.raw({ type: '*/*', limit: '1mb' }),
    controller.handle
  );

  return router;
}
