import { Router } from 'express';
import { z } from 'zod';
import type { BeneficiaryPayoutController } from '../controllers/BeneficiaryPayoutController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';
import type { requireAdmin } from '../../middleware/requireRole.js';

const registerRecipientSchema = z.object({
  type: z.enum(['ghipss', 'mobile_money']),
  accountNumber: z.string().min(1).max(50),
  bankCode: z.string().min(1).max(20),
  accountName: z.string().min(1).max(200),
});

const requestPayoutSchema = z.object({ amount: z.number().positive() });

/**
 * Per-beneficiary payout routes composed onto /campaigns (spec §17):
 *   POST /campaigns/:id/split/beneficiaries/:beneficiaryId/recipient   (owner/beneficiary)
 *   POST /campaigns/:id/split/beneficiaries/:beneficiaryId/verify-kyc  (admin)
 *   POST /campaigns/:id/split/beneficiaries/:beneficiaryId/payouts     (owner/beneficiary)
 *   GET  /campaigns/:id/split/payouts                                  (owner/admin)
 */
export function createCampaignBeneficiaryPayoutRoutes(
  controller: BeneficiaryPayoutController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  adminGuard: typeof requireAdmin
): Router {
  const router = Router();
  router.post(
    '/:id/split/beneficiaries/:beneficiaryId/recipient',
    authMiddleware,
    validate(registerRecipientSchema),
    controller.registerRecipient
  );
  router.post(
    '/:id/split/beneficiaries/:beneficiaryId/verify-kyc',
    authMiddleware,
    adminGuard,
    controller.verifyKyc
  );
  router.post(
    '/:id/split/beneficiaries/:beneficiaryId/payouts',
    authMiddleware,
    validate(requestPayoutSchema),
    controller.requestPayout
  );
  router.get('/:id/split/payouts', authMiddleware, controller.listByCampaign);
  return router;
}

/**
 * The admin beneficiary-payout resource:
 *   POST /beneficiary-payouts/:payoutId/approve  (admin)
 */
export function createBeneficiaryPayoutRoutes(
  controller: BeneficiaryPayoutController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  adminGuard: typeof requireAdmin
): Router {
  const router = Router();
  router.get('/', authMiddleware, adminGuard, controller.listAll);
  router.get('/review-queue', authMiddleware, adminGuard, controller.reviewQueue);
  router.post('/:payoutId/approve', authMiddleware, adminGuard, controller.approve);
  return router;
}
