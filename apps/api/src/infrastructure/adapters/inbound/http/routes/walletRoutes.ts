import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { Router } from 'express';
import type { WalletController } from '../controllers/WalletController.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

export function createWalletRoutes(
  controller: WalletController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();

  router.get('/', authMiddleware, controller.getMyWallets);
  router.get('/transactions', authMiddleware, controller.listTransactions);
  router.post('/topups', authMiddleware, validate(z.object({ walletId: z.string().regex(/^[a-f0-9]{24}$/i), amount: z.number().positive().max(10000) })), controller.initializeTopUp);
  router.get('/topups/config', authMiddleware, controller.topUpConfiguration);
  router.get('/topups/:reference', authMiddleware, controller.topUpStatus);
  router.get('/:id', authMiddleware, controller.getById);
  return router;
}
