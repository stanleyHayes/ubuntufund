import { Router } from 'express';
import { z } from 'zod';
import type { WalletController } from '../controllers/WalletController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

const walletTransactionSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(2).max(5),
});

export function createWalletRoutes(
  controller: WalletController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();

  router.get('/', authMiddleware, controller.getMyWallets);
  router.get('/:id', authMiddleware, controller.getById);
  router.post(
    '/:id/deposit',
    authMiddleware,
    validate(walletTransactionSchema),
    controller.deposit
  );
  router.post(
    '/:id/withdraw',
    authMiddleware,
    validate(walletTransactionSchema),
    controller.withdraw
  );

  return router;
}
