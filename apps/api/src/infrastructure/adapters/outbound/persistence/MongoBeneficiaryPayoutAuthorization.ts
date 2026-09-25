import type { BeneficiaryRecipient } from '@ubuntu-fund/types'
import type { SplitRequester } from '../../../../application/use-cases/BeneficiaryPayoutUseCase.js'
import { isValidObjectId } from 'mongoose'
import { UserModel } from '../../../database/models/UserModel.js'
import { CampaignModel } from '../../../database/models/CampaignModel.js'
import { BeneficiaryRecipientModel } from '../../../database/models/BeneficiaryRecipientModel.js'
import { AppError } from '../../inbound/middleware/errorHandler.js'

/** Called inside the final reservation transaction, before any balance moves. */
export class MongoBeneficiaryPayoutAuthorization {
  async assertCurrent(requester: SplitRequester, recipient: BeneficiaryRecipient): Promise<void> {
    if (!recipient.kycVerifiedBy || !recipient.kycVerifiedAt)
      throw new AppError('Beneficiary KYC review evidence is missing.', 409)
    const staff = await UserModel.updateOne({
      _id: requester.userId, role: 'admin', deletedAt: null,
      ...(requester.authVersion ? { authVersion: requester.authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] }),
    }, { $inc: { staffActionVersion: 1 } })
    if (!staff.matchedCount) throw new AppError('Current administrator access is required.', 403)
    // Segregation of duties, checked fail-closed inside the transaction: no admin
    // approves a payout to themselves or from their own campaign, and a payout
    // whose campaign cannot be found is never approved.
    if (recipient.beneficiaryId === requester.userId)
      throw new AppError('Another administrator must approve a payout to you.', 403)
    const campaign = isValidObjectId(recipient.campaignId)
      ? await CampaignModel.findById(recipient.campaignId).select('creatorId').lean()
      : null
    if (!campaign) throw new AppError('This payout\'s campaign could not be found; review it again before approving.', 409)
    if (campaign.creatorId === requester.userId)
      throw new AppError('Another administrator must approve payouts from your own campaign or request.', 403)
    const current = await BeneficiaryRecipientModel.findOneAndUpdate({
      _id: recipient.id, campaignId: recipient.campaignId, beneficiaryId: recipient.beneficiaryId,
      recipientCode: recipient.recipientCode, currency: recipient.currency, kycVerified: true,
      accountNumber: recipient.accountNumber, bankCode: recipient.bankCode, accountName: recipient.accountName, type: recipient.type,
      kycVerifiedBy: recipient.kycVerifiedBy, kycVerifiedAt: recipient.kycVerifiedAt,
    }, { $inc: { payoutWriteVersion: 1 } }, { new: true, timestamps: false })
    if (!current || !current.kycVerifiedBy || !current.kycVerifiedAt)
      throw new AppError('Beneficiary destination or KYC changed; review it again before approving.', 409)
  }
}
