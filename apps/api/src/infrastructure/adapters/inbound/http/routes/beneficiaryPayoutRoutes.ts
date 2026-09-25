import { Router } from 'express';
import { z } from 'zod';
import type { BeneficiaryPayoutController } from '../controllers/BeneficiaryPayoutController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';
import type { requireAdmin } from '../../middleware/requireRole.js';
import { BENEFICIARY_REJECTION_REASON_MIN } from '../../../../../application/use-cases/BeneficiaryPayoutUseCase.js';

const registerRecipientSchema = z.object({
  type: z.enum(['ghipss', 'mobile_money']),
  accountNumber: z.string().min(1).max(50),
  bankCode: z.string().min(1).max(20),
  accountName: z.string().min(1).max(200),
});

const requestPayoutSchema = z.object({ amount: z.number().positive() });
const approveSchema = z.object({ reviewNote: z.string().trim().min(20).max(2000) });
const rejectSchema = z.object({ reason: z.string().trim().min(BENEFICIARY_REJECTION_REASON_MIN).max(2000) });
const cancelSchema = z.object({ reason: z.string().trim().max(500).optional() });

/**
 * Per-beneficiary payout routes composed onto /campaigns (spec §17):
 *   POST /campaigns/:id/split/beneficiaries/:beneficiaryId/recipient   (owner/beneficiary)
 *   POST /campaigns/:id/split/beneficiaries/:beneficiaryId/verify-kyc  (admin)
 *   POST /campaigns/:id/split/beneficiaries/:beneficiaryId/payouts     (owner/beneficiary)
 *   POST /campaigns/:id/split/beneficiaries/:beneficiaryId/payouts/:payoutId/cancel
 *                                                                      (owner/beneficiary)
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
  // Withdraw a request still awaiting review (e.g. before changing the destination).
  router.post(
    '/:id/split/beneficiaries/:beneficiaryId/payouts/:payoutId/cancel',
    authMiddleware,
    validate(cancelSchema),
    controller.cancel
  );
  router.get('/:id/split/payouts', authMiddleware, controller.listByCampaign);
  return router;
}

/**
 * The admin beneficiary-payout resource:
 *   GET  /beneficiary-payouts/:payoutId/recipient  (admin) destination to review
 *   POST /beneficiary-payouts/:payoutId/approve    (admin) requires reviewNote
 *   POST /beneficiary-payouts/:payoutId/reject     (admin) closes a PENDING request
 */
export function createBeneficiaryPayoutRoutes(
  controller: BeneficiaryPayoutController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  adminGuard: typeof requireAdmin
): Router {
  const router = Router();
  router.get('/', authMiddleware, adminGuard, controller.listAll);
  router.get('/review-queue', authMiddleware, adminGuard, controller.reviewQueue);
  router.get('/:payoutId/recipient', authMiddleware, adminGuard, controller.recipient);
  // Mirrors campaign payouts: each approver records the destination review.
  router.post('/:payoutId/approve', authMiddleware, adminGuard, validate(approveSchema), controller.approve);
  router.post('/:payoutId/reject', authMiddleware, adminGuard, validate(rejectSchema), controller.reject);
  return router;
}
