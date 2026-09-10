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
        PayoutModel.countDocuments({ status: { $in: ['PENDING', 'NEEDS_REVIEW'] } }),
        BeneficiaryPayoutModel.countDocuments({ status: { $in: ['PENDING', 'NEEDS_REVIEW'] } }),
        CampaignModel.countDocuments({ status: 'pending_review', deletedAt: null }),
        KYCVerificationModel.countDocuments({ status: 'pending' }),
        DisputeModel.countDocuments({ status: { $in: ['open', 'under_review'] } }),
        ContactSubmissionModel.countDocuments({ status: 'new' }),
      ])
      const definitions = [
        ['payouts', 'Campaign payouts', '/payouts', 'donations'],
        ['beneficiary-payouts', 'Beneficiary payouts', '/payouts?view=beneficiary', 'donations'],
        ['campaigns', 'Campaigns awaiting review', '/campaigns', 'campaigns'],
        ['verifications', 'Identity checks', '/kyc-review', 'verifications'],
        ['disputes', 'Open disputes', '/disputes', 'disputes'],
        ['contact', 'New contact messages', '/contact-submissions', 'contact_submissions'],
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
