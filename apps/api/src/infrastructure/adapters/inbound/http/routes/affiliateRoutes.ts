import { Router } from 'express';
import { z } from 'zod';
import { AffiliateStatus, REFERRAL_CODE_MAX, REFERRAL_CODE_MIN } from '@ubuntu-fund/types';
import type { AffiliateController } from '../controllers/AffiliateController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';
import type { requireAdmin } from '../../middleware/requireRole.js';

// Shape only; the use case applies the shared format/reserved/uniqueness rules
// so the API and both clients cannot drift on what a valid code is.
const referralCodeSchema = z.object({
  referralCode: z.string().trim().min(REFERRAL_CODE_MIN).max(REFERRAL_CODE_MAX),
});

const setRecipientSchema = z.object({
  type: z.enum(['ghipss', 'mobile_money']),
  accountNumber: z.string().min(1).max(50),
  bankCode: z.string().min(1).max(20),
  accountName: z.string().min(1).max(200),
});

const requestPayoutSchema = z.object({
  amount: z.number().positive(),
});

const setCommissionRateSchema = z.object({
  commissionRate: z.number().min(0).max(100),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(AffiliateStatus),
});

/**
 * The owner-facing affiliate resource (all routes gated to the signed-in user):
 *   POST /affiliate/enroll            → join the program (mints a code; idempotent)
 *   GET  /affiliate                   → dashboard (profile, balance, stats, link)
 *   GET  /affiliate/referrals         → the current user's referred signups
 *   GET  /affiliate/commissions       → the current user's commission ledger
 *   POST /affiliate/payout-recipient  → register a payout destination
 *   POST /affiliate/payouts           → request a payout of available commission
 */
export function createAffiliateRoutes(
  affiliateController: AffiliateController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();

  router.post('/enroll', authMiddleware, affiliateController.enroll);
  router.get('/', authMiddleware, affiliateController.dashboard);
  router.put(
    '/referral-code',
    authMiddleware,
    validate(referralCodeSchema),
    affiliateController.updateReferralCode
  );
  router.get('/referrals', authMiddleware, affiliateController.referrals);
  router.get('/commissions', authMiddleware, affiliateController.commissions);
  router.post(
    '/payout-recipient',
    authMiddleware,
    validate(setRecipientSchema),
    affiliateController.setRecipient
  );
  router.post(
    '/payouts',
    authMiddleware,
    validate(requestPayoutSchema),
    affiliateController.requestPayout
  );

  return router;
}

/**
 * The admin /affiliates resource (Resource.AFFILIATES), guarded by requireAdmin:
 *   GET  /affiliates                        → list every affiliate (newest first)
 *   GET  /affiliates/payouts                → every affiliate payout (approval queue)
 *   POST /affiliates/payouts/:id/approve    → approve + initiate a transfer
 *   GET  /affiliates/:id                    → one affiliate's full detail view
 *   PUT  /affiliates/:id/commission-rate    → override the commission rate
 *   PUT  /affiliates/:id/status             → activate or suspend the affiliate
 *
 * The literal `/payouts` routes are declared before `/:id` so the router never
 * mistakes the word "payouts" for an affiliate id.
 */
export function createAdminAffiliateRoutes(
  affiliateController: AffiliateController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  adminGuard: typeof requireAdmin
): Router {
  const router = Router();

  router.get('/', authMiddleware, adminGuard, affiliateController.list);

  // Literal `/payouts` routes must precede the `/:id` matchers below.
  router.get(
    '/payouts',
    authMiddleware,
    adminGuard,
    affiliateController.listPayouts
  );
  router.post(
    '/payouts/:id/approve',
    authMiddleware,
    adminGuard,
    affiliateController.approvePayout
  );

  router.get('/:id', authMiddleware, adminGuard, affiliateController.detail);
  router.put(
    '/:id/commission-rate',
    authMiddleware,
    adminGuard,
    validate(setCommissionRateSchema),
    affiliateController.setRate
  );
  router.put(
    '/:id/status',
    authMiddleware,
    adminGuard,
    validate(updateStatusSchema),
    affiliateController.updateStatus
  );

  return router;
}
