import { Router } from 'express';
import type { CryptoController } from '../controllers/CryptoController.js';

/**
 * Campaign-scoped crypto contribution routes (Crypto Donations plan §17),
 * composed onto the `/campaigns` resource. PUBLIC — guests may contribute, like
 * the fiat donation flow. The global API rate limiter covers quote/deposit.
 */
export function createCryptoDonationRoutes(controller: CryptoController): Router {
  const router = Router();
  router.post('/:id/donations/crypto/quote', controller.createQuote);
  router.post('/:id/donations/crypto', controller.createDeposit);
  return router;
}
