import type { BeneficiaryRecipient } from '@ubuntu-fund/types'
import type { SplitRequester } from '../../../../application/use-cases/BeneficiaryPayoutUseCase.js'
import { isValidObjectId } from 'mongoose'
import { UserModel } from '../../../database/models/UserModel.js'
import { CampaignModel } from '../../../database/models/CampaignModel.js'
import { BeneficiaryRecipientModel } from '../../../database/models/BeneficiaryRecipientModel.js'
import { AppError } from '../../inbound/middleware/errorHandler.js'
import { assertCampaignPayable } from './MongoPayoutEligibility.js'

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
    // Write-fence the campaign so a dispute opened, or a block applied, while
    // this transaction runs makes it conflict and re-check rather than pay.
    const campaign = isValidObjectId(recipient.campaignId)
      ? await CampaignModel.findOneAndUpdate(
        { _id: recipient.campaignId }, { $inc: { payoutWriteVersion: 1 } },
        { new: true, timestamps: false },
      ).select('creatorId status deletedAt')
      : null
    if (!campaign) throw new AppError('This payout\'s campaign could not be found; review it again before approving.', 409)
    if (campaign.creatorId === requester.userId)
      throw new AppError('Another administrator must approve payouts from your own campaign or request.', 403)
    // Same gate as campaign payouts: a blocked, deleted or disputed campaign
    // pays nobody, including a request queued before the block or dispute.
    await assertCampaignPayable(campaign)
    // Only a destination the beneficiary or the campaign owner entered is ever
    // paid. Staff never enter bank details, so an approver cannot route the
    // money to an account of their choosing.
    if (recipient.createdBy === requester.userId)
      throw new AppError('Another administrator must approve a payout to a destination you entered.', 403)
    if (recipient.createdBy !== recipient.beneficiaryId && recipient.createdBy !== campaign.creatorId)
      throw new AppError('This payout destination was not entered by the beneficiary or the campaign owner; it must be registered again.', 409)
    const current = await BeneficiaryRecipientModel.findOneAndUpdate({
      _id: recipient.id, campaignId: recipient.campaignId, beneficiaryId: recipient.beneficiaryId,
      recipientCode: recipient.recipientCode, currency: recipient.currency, kycVerified: true,
      accountNumber: recipient.accountNumber, bankCode: recipient.bankCode, accountName: recipient.accountName, type: recipient.type,
      createdBy: recipient.createdBy, kycVerifiedBy: recipient.kycVerifiedBy, kycVerifiedAt: recipient.kycVerifiedAt,
    }, { $inc: { payoutWriteVersion: 1 } }, { new: true, timestamps: false })
    if (!current || !current.kycVerifiedBy || !current.kycVerifiedAt)
      throw new AppError('Beneficiary destination or KYC changed; review it again before approving.', 409)
  }
}
