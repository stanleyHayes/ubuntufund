import { payoutDestinationRateLimiter } from '../../middleware/rateLimiter.js'
import { Router } from 'express'
import { z } from 'zod'
import type { PayoutController } from '../controllers/PayoutController.js'
import { validate } from '../../middleware/validate.js'
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js'
import type { requireAdmin } from '../../middleware/requireRole.js'
import { PAYOUT_REJECTION_REASON_MIN } from '../../../../../application/use-cases/ClosePendingPayoutUseCase.js'
import { STUCK_PAYOUT_RAILS } from '../../../../../application/use-cases/ResolveStuckPayoutUseCase.js'

const createRecipientSchema = z.object({
  type: z.enum(['ghipss', 'mobile_money']),
  accountNumber: z.string().trim().min(1).max(50),
  bankCode: z.string().trim().min(1).max(20),
  accountName: z.string().trim().min(1).max(200),
})

const requestPayoutSchema = z.object({
  destination: z.enum(['paystack', 'ujimora_wallet']).optional(),
  idempotencyKey: z.string().uuid().optional(),
  amount: z.number().positive(),
  type: z.enum(['standard', 'priority', 'early', 'urgent', 'assisted']).optional(),
  // Discounts the service fee, not the amount withdrawn.
  couponCode: z.string().min(1).max(50).optional(),
})

/**
 * The bank/telco directory:
 *   GET /banks?currency=GHS&type=  → list banks (or mobile-money telcos)
 *
 * Auth-gated (a signed-in owner picks a recipient here), but exposes no
 * campaign-scoped data.
 */
export function createBankRoutes(
  payoutController: PayoutController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
): Router {
  const router = Router()
  router.get('/', authMiddleware, payoutController.listBanks)
  return router
}

/**
 * Payout routes that extend the /campaigns resource (mounted alongside the
 * other campaign sub-routers in app.ts):
 *   POST /campaigns/:id/payout-recipient → register a recipient (owner)
 *   POST /campaigns/:id/payouts          → request a payout (owner)
 *   GET  /campaigns/:id/payouts          → list a campaign's payouts (owner/admin)
 *   POST /campaigns/:id/payouts/:payoutId/cancel → cancel a PENDING request (owner)
 */
export function createCampaignPayoutRoutes(
  payoutController: PayoutController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
): Router {
  const router = Router()

  router.post(
    '/:id/payout-recipient',
    authMiddleware,
    payoutDestinationRateLimiter,
    validate(z.union([z.object({ savedAccountId: z.string().uuid() }), createRecipientSchema])),
    payoutController.createRecipient,
  )
  router.post(
    '/:id/payouts',
    authMiddleware,
    validate(requestPayoutSchema),
    payoutController.requestPayout,
  )
  router.get('/:id/payout-options', authMiddleware, payoutController.getOptions)
  router.get('/:id/payouts', authMiddleware, payoutController.listCampaignPayouts)
  // Refreshing asks the provider and can settle money, so it is a command, not
  // part of the GET above. Bounded server-side by a per-payout lease.
  router.post('/:id/payouts/:payoutId/refresh', authMiddleware, payoutController.refreshPayout)
  // The owner withdraws a request that is still awaiting review.
  router.post(
    '/:id/payouts/:payoutId/cancel',
    authMiddleware,
    validate(z.object({ reason: z.string().trim().max(500).optional() })),
    payoutController.cancelPayout,
  )

  return router
}

/**
 * The admin /payouts resource:
 *   GET  /payouts             → every payout across the platform (admin)
 *   POST /payouts/:id/approve → approve + initiate the transfer (admin)
 *   POST /payouts/:id/reject  → close a PENDING request with a reason (admin)
 *   GET  /payouts/stuck   → escalated (NEEDS_REVIEW) single transfers, every rail (admin)
 *   POST /payouts/stuck/:rail/:id/resolve → settle an escalated (NEEDS_REVIEW)
 *        single transfer from Paystack's authoritative outcome (admin)
 */
export function createPayoutRoutes(
  payoutController: PayoutController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  adminGuard: typeof requireAdmin,
): Router {
  const router = Router()

  router.get('/', authMiddleware, adminGuard, payoutController.listAll)
  router.get('/:id/recipient', authMiddleware, adminGuard, payoutController.recipientDetails)
  router.get('/review-queue', authMiddleware, adminGuard, payoutController.reviewQueue)
  router.get('/stuck', authMiddleware, adminGuard, payoutController.listStuck)
  router.post(
    '/:id/approve',
    authMiddleware,
    adminGuard,
    validate(z.object({ reviewNote: z.string().trim().min(20).max(2000) })),
    payoutController.approvePayout,
  )
  router.post(
    '/stuck/:rail/:id/resolve',
    authMiddleware,
    adminGuard,
    validate(z.object({ note: z.string().trim().min(20).max(2000) })),
    (req, res, next) => {
      if (!(STUCK_PAYOUT_RAILS as readonly string[]).includes(req.params.rail as string))
        return res.status(404).json({ data: null, message: 'Unknown payout rail', status: 404 })
      return payoutController.resolveStuck(req, res, next)
    },
  )
  router.post(
    '/:id/reject',
    authMiddleware,
    adminGuard,
    validate(z.object({ reason: z.string().trim().min(PAYOUT_REJECTION_REASON_MIN).max(2000) })),
    payoutController.rejectPayout,
  )

  return router
}
