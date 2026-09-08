import { Router } from 'express';
import type { CryptoController } from '../controllers/CryptoController.js';

/**
 * Public crypto capability routes (Crypto Donations plan §17), mounted at
 * `/payments/crypto`. Server-driven asset/network discovery — the frontend never
 * hardcodes supported assets (§22 #4).
 */
export function createCryptoRoutes(controller: CryptoController): Router {
  const router = Router();
  router.get('/assets', controller.getAssets);
  router.get('/assets/:asset/networks', controller.getNetworks);
  return router;
}
