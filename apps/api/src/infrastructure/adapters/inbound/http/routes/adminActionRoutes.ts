import { DonationModel } from '../../../../database/models/DonationModel.js'
import { donationContentReviewFilter } from './donationContentReviewRoutes.js'
import { TipModel } from '../../../../database/models/TipModel.js'
import { tipContentReviewFilter } from './tipContentReviewRoutes.js'
import { PublicationReviewModel } from '../../../../database/models/PublicationReviewModel.js'
import { DataRightsRequestModel } from '../../../../database/models/DataRightsRequestModel.js'
import { RefundOperationModel } from '../../../../database/models/RefundOperationModel.js'
import { UserBlockModel } from '../../../../database/models/UserBlockModel.js'
import { LiveSessionModel } from '../../../../database/models/LiveSessionModel.js'
import { SafetyReportModel } from '../../../../database/models/SafetyReportModel.js'
import { AccountDeletionRequestModel } from '../../../../database/models/AccountDeletionRequestModel.js'
import { StorePurchaseModel } from '../../../../database/models/StorePurchaseModel.js'
import { StoreBillingNotificationModel } from '../../../../database/models/StoreBillingNotificationModel.js'
import { storePurchaseIssues } from './storeBillingAdminRoutes.js'
import { Router } from 'express'
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js'
import { requireAdmin } from '../../middleware/requireRole.js'
import { PayoutModel } from '../../../../database/models/PayoutModel.js'
import { BeneficiaryPayoutModel } from '../../../../database/models/BeneficiaryPayoutModel.js'
import { CampaignModel } from '../../../../database/models/CampaignModel.js'
import { KYCVerificationModel } from '../../../../database/models/KYCVerificationModel.js'
import { DisputeModel } from '../../../../database/models/DisputeModel.js'
import { ContactSubmissionModel } from '../../../../database/models/ContactSubmissionModel.js'

/** Live work queues: viewing an alert does not resolve the underlying work. */
export function createAdminActionRoutes(auth: ReturnType<typeof createAuthMiddleware>) {
  const router = Router()
  router.get('/action-center', auth, requireAdmin, async (_req, res, next) => {
    try {
      const counts = await Promise.all([
        DataRightsRequestModel.countDocuments({ active: true }),
        PayoutModel.countDocuments({
          $or: [
            { status: { $in: ['PENDING', 'NEEDS_REVIEW'] } },
            { status: 'PROCESSING', providerStatus: 'otp' },
          ],
        }),
        BeneficiaryPayoutModel.countDocuments({ status: { $in: ['PENDING', 'NEEDS_REVIEW'] } }),
        CampaignModel.countDocuments({ status: 'pending_review', deletedAt: null }),
        KYCVerificationModel.countDocuments({ status: 'pending' }),
        DisputeModel.countDocuments({ status: { $in: ['open', 'under_review'] } }),
        ContactSubmissionModel.countDocuments({ status: 'new' }),
        SafetyReportModel.countDocuments({ status: 'pending' }),
        Promise.all([LiveSessionModel.countDocuments({ providerStopPending: true }), UserBlockModel.countDocuments({ providerCleanupPending: true })]).then(counts => counts.reduce((sum, count) => sum + count, 0)),
        AccountDeletionRequestModel.countDocuments({ $or: [{ status: 'pending' }, { nextReviewAt: { $lte: new Date() } }] }),
        Promise.all([StorePurchaseModel.countDocuments(storePurchaseIssues), StoreBillingNotificationModel.countDocuments()]).then(counts => counts.reduce((sum, count) => sum + count, 0)),
        RefundOperationModel.countDocuments({ active: true }),
        PublicationReviewModel.countDocuments({ status: 'pending' }),
        DonationModel.countDocuments(donationContentReviewFilter('pending')),
        TipModel.countDocuments(tipContentReviewFilter('pending')),

      ])
      const definitions = [
        ['data-rights', 'Data access and privacy requests', '/privacy-requests', 'users'],
        ['payouts', 'Campaign payouts', '/payouts', 'donations'],
        ['beneficiary-payouts', 'Beneficiary payouts', '/payouts?view=beneficiary', 'donations'],
        ['campaigns', 'Campaigns awaiting review', '/campaigns', 'campaigns'],
        ['verifications', 'Identity checks', '/kyc-review', 'verifications'],
        ['disputes', 'Open disputes', '/disputes', 'disputes'],
        ['contact', 'New contact messages', '/contact-submissions', 'contact_submissions'],
        ['safety', 'Community safety reports', '/safety-reports', 'reports'],
        ['live-cleanup', 'Live safety provider cleanup', '/safety-reports', 'reports'],
        ['privacy', 'Privacy requests due for review', '/privacy-requests', 'users'],
        ['store-billing', 'Store billing recovery', '/store-billing', 'subscriptions'],
        ['refund-recovery', 'Refund recovery', '/refund-recovery', 'donations'],
        ['publication-reviews', 'Public content awaiting review', '/publication-reviews', 'reports'],
        ['donation-content-reviews', 'Campaign donor content awaiting review', '/publication-reviews?queue=donation-content-reviews', 'reports'],
        ['tip-content-reviews', 'Supporter names and messages awaiting review', '/publication-reviews?queue=tip-content-reviews', 'reports'],
      ]
      const items = definitions.map(([id, title, href, resource], i) => ({
        id,
        title,
        href,
        resource,
        count: counts[i],
      }))
      res.json({ data: { items }, message: 'Admin actions retrieved', status: 200 })
    } catch (error) {
      next(error)
    }
  })
  return router
}
