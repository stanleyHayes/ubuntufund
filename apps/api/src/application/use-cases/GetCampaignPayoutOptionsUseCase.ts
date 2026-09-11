import { campaignNeedsEarlyCashout } from '../services/payoutFee.js'
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js'
import type { CampaignBalanceRepositoryPort } from '../../domain/ports/outbound/CampaignBalanceRepositoryPort.js'
import type { TransferRecipientRepositoryPort } from '../../domain/ports/outbound/TransferRecipientRepositoryPort.js'
import { roundToCurrency } from '../../domain/value-objects/Money.js'
import type { PayoutsConfig } from '../../infrastructure/config/index.js'
import type { PayoutRequester } from './CreatePayoutRecipientUseCase.js'
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js'

export class GetCampaignPayoutOptionsUseCase {
  constructor(
    private readonly campaigns: CampaignRepositoryPort,
    private readonly balances: CampaignBalanceRepositoryPort,
    private readonly recipients: TransferRecipientRepositoryPort,
    private readonly config: { resolvePayoutsConfig(): Promise<PayoutsConfig> },
  ) {}

  async execute(id: string, requester: PayoutRequester) {
    const campaign = await this.campaigns.findById(id)
    if (!campaign) throw new AppError('Campaign not found', 404)
    if (campaign.creatorId !== requester.userId && requester.role !== 'admin')
      throw new AppError('Only the campaign owner can view payout details', 403)
    const [balance, recipient, fees] = await Promise.all([
      this.balances.findByCampaignId(id),
      this.recipients.findLatestByCampaignId(id),
      this.config.resolvePayoutsConfig(),
    ])
    const currency = balance?.currency ?? 'GHS'
    const round = (value: number) => roundToCurrency(value, currency)
    const accountedRaised = round(balance?.totalRaised ?? 0)
    const platformFees = round(balance?.platformFees ?? 0)
    const processorFees = round(balance?.processorFees ?? 0)
    const eligible = round((balance?.pendingBalance ?? 0) + (balance?.availableBalance ?? 0))
    const netProceeds = round(accountedRaised - platformFees - processorFees)
    const paidOut = round(balance?.paidOutBalance ?? 0)
    const payoutFees = round(balance?.payoutFees ?? 0)
    const raised = round(campaign.raisedAmount.amount)
    return {
      breakdown: {
        lockedPlatformFeePercent: campaign.lockedPlatformFeePercent,
        tips: round(balance?.tips ?? 0),
        raised,
        accountedRaised,
        raisedDifference: round(raised - accountedRaised),
        platformFees,
        processorFees,
        netProceeds,
        paidOut,
        payoutFees,
        reservedOrAdjustments: round(netProceeds - paidOut - payoutFees - eligible),
        pending: round(balance?.pendingBalance ?? 0),
        available: round(balance?.availableBalance ?? 0),
        eligible,
      },
      currency,
      eligible: round((balance?.pendingBalance ?? 0) + (balance?.availableBalance ?? 0)),
      fees,
      requiresEarlyCashout: campaignNeedsEarlyCashout(campaign),
      recipient: recipient
        ? {
            accountName: recipient.accountName,
            last4: recipient.accountNumber.slice(-4),
            type: recipient.type,
            verificationStatus: recipient.toPlain().verificationStatus ?? 'needs_review',
            resolvedAccountName: recipient.toPlain().resolvedAccountName,
          }
        : null,
    }
  }
}
