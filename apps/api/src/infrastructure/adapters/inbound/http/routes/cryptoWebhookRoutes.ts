import express, { Router } from 'express';
import type { CryptoWebhookController } from '../controllers/CryptoWebhookController.js';

/**
 * Crypto provider webhooks (Crypto Donations plan §8), mounted at
 * `/webhooks/crypto` BEFORE the global JSON parser. Its own raw-body parser
 * hands the adapter the exact bytes the provider's signature is computed over.
 */
export function createCryptoWebhookRoutes(
  controller: CryptoWebhookController
): Router {
  const router = Router();
  router.post('/:provider', express.raw({ type: () => true }), controller.handle);
  return router;
}
