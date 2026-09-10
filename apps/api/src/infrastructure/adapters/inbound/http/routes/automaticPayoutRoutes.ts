import { CreatorPayoutModel } from '../../../../database/models/CreatorPayoutModel.js'
import { BeneficiaryPayoutModel } from '../../../../database/models/BeneficiaryPayoutModel.js'
import { BeneficiaryRecipientModel } from '../../../../database/models/BeneficiaryRecipientModel.js'
import { AffiliatePayoutModel } from '../../../../database/models/AffiliatePayoutModel.js'
import { AffiliateModel } from '../../../../database/models/AffiliateModel.js'
import { Router } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest, createAuthMiddleware } from '../../middleware/authMiddleware.js'
import { requireAdmin } from '../../middleware/requireRole.js'
import { validate } from '../../middleware/validate.js'
import { donationIntentRateLimiter } from '../../middleware/rateLimiter.js'
import {
  AutomaticPayoutPolicyModel,
  automaticPayoutDefaults,
} from '../../../../database/models/AutomaticPayoutModel.js'
import { PayoutModel } from '../../../../database/models/PayoutModel.js'
import { TransferRecipientModel } from '../../../../database/models/TransferRecipientModel.js'
import type { PayoutTransferControlUseCase } from '../../../../../application/use-cases/PayoutTransferControlUseCase.js'
const policySchema = z
  .object({
    enabled: z.boolean(),
    maxAmount: z.number().positive().max(50000),
    dailyOwnerLimit: z.number().positive().max(1000000),
    dailyPlatformLimit: z.number().positive().max(10000000),
    reviewMaxAgeDays: z.number().int().min(1).max(90),
    mobileMoneyMaxAmount: z.number().min(0).max(50000),
    mobileMoneyReviewMaxAgeHours: z.number().int().min(1).max(168),
  })
  .refine(
    (p) =>
      p.maxAmount <= p.dailyOwnerLimit &&
      p.dailyOwnerLimit <= p.dailyPlatformLimit &&
      p.mobileMoneyMaxAmount <= p.maxAmount,
    'Limits must increase from MoMo to per-request to owner/day to platform/day.',
  )
export function automaticPayoutRoutes(
  auth: ReturnType<typeof createAuthMiddleware>,
  controls: PayoutTransferControlUseCase,
) {
  const router = Router()
  router.get('/admin/automatic-payouts', auth, requireAdmin, async (_req, res, next) => {
    try {
      const doc = await AutomaticPayoutPolicyModel.findById('current').lean()
      res.json({ data: { ...automaticPayoutDefaults, ...doc } })
    } catch (e) {
      next(e)
    }
  })
  router.put(
    '/admin/automatic-payouts',
    auth,
    requireAdmin,
    validate(policySchema),
    async (req, res, next) => {
      try {
        const value = policySchema.parse(req.body)
        const doc = await AutomaticPayoutPolicyModel.findOneAndUpdate(
          { _id: 'current' },
          {
            $set: { ...value, updatedBy: (req as AuthenticatedRequest).userId },
            $inc: { revision: 1 },
            $push: {
              history: {
                $each: [{ ...value, by: (req as AuthenticatedRequest).userId, at: new Date() }],
                $slice: -100,
              },
            },
          },
          { upsert: true, new: true },
        )
        res.json({ data: doc })
      } catch (e) {
        next(e)
      }
    },
  )
  router.post(
    '/payouts/:id/transfer-control',
    auth,
    requireAdmin,
    donationIntentRateLimiter,
    validate(
      z.object({
        action: z.enum(['refresh', 'resend', 'authorize']),
        otp: z
          .string()
          .regex(/^\d{6}$/)
          .optional(),
      }),
    ),
    async (req, res, next) => {
      try {
        res.json({
          data: await controls.execute(req.params.id as string, req.body.action, req.body.otp),
        })
      } catch (e) {
        next(e)
      }
    },
  )
  // Paystack approval requests authorize only a transfer already reserved by Ujimora.
  // No secret in the URL and no transfer/ledger mutation occurs here.
  router.post('/payouts/paystack-approval', async (req, res) => {
    try {
      const body = req.body
      if (
        typeof body?.reference !== 'string' ||
        !Number.isSafeInteger(body.amount) ||
        body.currency !== 'GHS'
      ) {
        res.sendStatus(400)
        return
      }
      const code =
        typeof body.recipient === 'string' ? body.recipient : body.recipient?.recipient_code
      if (typeof code !== 'string') {
        res.sendStatus(400)
        return
      }
      const payout = await PayoutModel.findOne({
        $or: [{ providerRef: body.reference }, { 'legs.reference': body.reference }],
        provider: 'paystack',
        status: 'PROCESSING',
        approvedBy: { $exists: true },
      })
      if (payout) {
        const leg = payout.legs?.find(
          (l) => l.reference === body.reference && ['queued', 'submitted'].includes(l.status),
        )
        const amount = payout.legs?.length ? leg?.amount : payout.netAmount
        const recipient = await TransferRecipientModel.findById(payout.recipientId)
        res.sendStatus(
          payout.currency === body.currency &&
            amount !== undefined &&
            Math.round(amount * 100) === body.amount &&
            code === recipient?.recipientCode
            ? 200
            : 400,
        )
        return
      }
      const creator = await CreatorPayoutModel.findOne({
        providerRef: body.reference,
        status: 'PROCESSING',
        provider: 'paystack',
      })
      if (creator) {
        res.sendStatus(
          creator.currency === body.currency &&
            Math.round((creator.netAmount ?? creator.amount) * 100) === body.amount &&
            creator.recipientCode === code
            ? 200
            : 400,
        )
        return
      }
      const beneficiary = await BeneficiaryPayoutModel.findOne({
        providerRef: body.reference,
        status: 'PROCESSING',
        approvedBy: { $exists: true },
      })
      if (beneficiary) {
        const recipient = await BeneficiaryRecipientModel.findById(beneficiary.recipientId)
        res.sendStatus(
          beneficiary.currency === body.currency &&
            Math.round(beneficiary.amount * 100) === body.amount &&
            recipient?.recipientCode === code
            ? 200
            : 400,
        )
        return
      }
      const affiliate = await AffiliatePayoutModel.findOne({
        providerRef: body.reference,
        status: 'PROCESSING',
        approvedBy: { $exists: true },
      })
      if (affiliate) {
        const recipient = await AffiliateModel.findById(affiliate.affiliateId)
        res.sendStatus(
          affiliate.currency === body.currency &&
            Math.round(affiliate.amount * 100) === body.amount &&
            recipient?.recipientCode === code
            ? 200
            : 400,
        )
        return
      }
      res.sendStatus(400)
    } catch {
      res.sendStatus(400)
    }
  })
  return router
}
