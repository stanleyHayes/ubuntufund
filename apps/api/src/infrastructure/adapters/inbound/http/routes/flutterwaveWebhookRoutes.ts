import express, { Router } from 'express';
import type { FlutterwaveWebhookController } from '../controllers/FlutterwaveWebhookController.js';

/**
 * The Flutterwave webhook resource:
 *   POST /webhooks/flutterwave  → authoritative charge settlement
 *
 * Mounted OUTSIDE the JSON body parser (see app.ts) with `express.raw`, so the
 * handler receives the untouched bytes. Flutterwave authenticates with a plain
 * `verif-hash` header (the dashboard secret hash), verified in the use-case.
 */
export function createFlutterwaveWebhookRoutes(
  controller: FlutterwaveWebhookController
): Router {
  const router = Router();

  router.post('/', express.raw({ type: '*/*', limit: '1mb' }), controller.handle);

  return router;
}
