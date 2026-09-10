import { campaignNeedsEarlyCashout } from '../services/payoutFee.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { CampaignBalanceRepositoryPort } from '../../domain/ports/outbound/CampaignBalanceRepositoryPort.js';
import type { TransferRecipientRepositoryPort } from '../../domain/ports/outbound/TransferRecipientRepositoryPort.js';
import type { PayoutsConfig } from '../../infrastructure/config/index.js';
import type { PayoutRequester } from './CreatePayoutRecipientUseCase.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export class GetCampaignPayoutOptionsUseCase {
  constructor(private readonly campaigns: CampaignRepositoryPort,
    private readonly balances: CampaignBalanceRepositoryPort,
    private readonly recipients: TransferRecipientRepositoryPort,
    private readonly config: { resolvePayoutsConfig(): Promise<PayoutsConfig> }) {}

  async execute(id: string, requester: PayoutRequester) {
    const campaign = await this.campaigns.findById(id);
    if (!campaign) throw new AppError('Campaign not found', 404);
    if (campaign.creatorId !== requester.userId && requester.role !== 'admin') throw new AppError('Only the campaign owner can view payout details', 403);
    const [balance, recipient, fees] = await Promise.all([
      this.balances.findByCampaignId(id), this.recipients.findLatestByCampaignId(id), this.config.resolvePayoutsConfig(),
    ]);
    return {
      currency: balance?.currency ?? 'GHS',
      eligible: Math.round(((balance?.pendingBalance ?? 0) + (balance?.availableBalance ?? 0)) * 100) / 100,
      fees,
      requiresEarlyCashout: campaignNeedsEarlyCashout(campaign),
      recipient: recipient ? { accountName: recipient.accountName, last4: recipient.accountNumber.slice(-4), type: recipient.type } : null,
    };
  }
}
