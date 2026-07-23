import { Router } from 'express';
import type { AuthController } from '../controllers/AuthController.js';
import type { CampaignController } from '../controllers/CampaignController.js';
import type { WalletController } from '../controllers/WalletController.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';
import { createAuthRoutes } from './authRoutes.js';
import { createCampaignRoutes } from './campaignRoutes.js';
import { createWalletRoutes } from './walletRoutes.js';

interface RouteControllers {
  authController: AuthController;
  campaignController: CampaignController;
  walletController: WalletController;
  authMiddleware: ReturnType<typeof createAuthMiddleware>;
}

export function createApiRouter(controllers: RouteControllers): Router {
  const router = Router();

  router.use('/auth', createAuthRoutes(controllers.authController));
  router.use(
    '/campaigns',
    createCampaignRoutes(
      controllers.campaignController,
      controllers.authMiddleware
    )
  );
  router.use(
    '/wallets',
    createWalletRoutes(
      controllers.walletController,
      controllers.authMiddleware
    )
  );

  return router;
}
