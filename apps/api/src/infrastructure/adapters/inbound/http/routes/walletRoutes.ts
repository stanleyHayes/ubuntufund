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
  router.get('/:id', authMiddleware, controller.getById);
  return router;
}
