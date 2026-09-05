import { Router } from 'express';
import { z } from 'zod';
import type { PayoutController } from '../controllers/PayoutController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';
import type { requireAdmin } from '../../middleware/requireRole.js';

const createRecipientSchema = z.object({
  type: z.enum(['ghipss', 'mobile_money']),
  accountNumber: z.string().min(1).max(50),
  bankCode: z.string().min(1).max(20),
  accountName: z.string().min(1).max(200),
});

const requestPayoutSchema = z.object({
  amount: z.number().positive(),
});

/**
 * The bank/telco directory:
 *   GET /banks?currency=GHS&type=  → list banks (or mobile-money telcos)
 *
 * Auth-gated (a signed-in owner picks a recipient here), but exposes no
 * campaign-scoped data.
 */
export function createBankRoutes(
  payoutController: PayoutController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();
  router.get('/', authMiddleware, payoutController.listBanks);
  return router;
}

/**
 * Payout routes that extend the /campaigns resource (mounted alongside the
 * other campaign sub-routers in app.ts):
 *   POST /campaigns/:id/payout-recipient → register a recipient (owner)
 *   POST /campaigns/:id/payouts          → request a payout (owner)
 *   GET  /campaigns/:id/payouts          → list a campaign's payouts (owner/admin)
 */
export function createCampaignPayoutRoutes(
  payoutController: PayoutController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();

  router.post(
    '/:id/payout-recipient',
    authMiddleware,
    validate(createRecipientSchema),
    payoutController.createRecipient
  );
  router.post(
    '/:id/payouts',
    authMiddleware,
    validate(requestPayoutSchema),
    payoutController.requestPayout
  );
  router.get('/:id/payouts', authMiddleware, payoutController.listCampaignPayouts);

  return router;
}

/**
 * The admin /payouts resource:
 *   GET  /payouts             → every payout across the platform (admin)
 *   POST /payouts/:id/approve → approve + initiate the transfer (admin)
 */
export function createPayoutRoutes(
  payoutController: PayoutController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  adminGuard: typeof requireAdmin
): Router {
  const router = Router();

  router.get('/', authMiddleware, adminGuard, payoutController.listAll);
  router.post(
    '/:id/approve',
    authMiddleware,
    adminGuard,
    payoutController.approvePayout
  );

  return router;
}
