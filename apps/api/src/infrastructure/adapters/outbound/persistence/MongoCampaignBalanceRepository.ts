import type { CampaignBalance } from '@ubuntu-fund/types';
import type {
  CampaignBalanceDelta,
  CampaignBalanceRepositoryPort,
} from '../../../../domain/ports/outbound/CampaignBalanceRepositoryPort.js';
import {
  CampaignBalanceModel,
  type CampaignBalanceDocument,
} from '../../../database/models/CampaignBalanceModel.js';

function toDomain(doc: CampaignBalanceDocument): CampaignBalance {
  return {
    campaignId: doc.campaignId,
    currency: doc.currency,
    totalRaised: doc.totalRaised,
    pendingBalance: doc.pendingBalance,
    availableBalance: doc.availableBalance,
    paidOutBalance: doc.paidOutBalance,
    platformFees: doc.platformFees,
    processorFees: doc.processorFees,
    tips: doc.tips,
    updatedAt: doc.updatedAt,
  };
}

export class MongoCampaignBalanceRepository
  implements CampaignBalanceRepositoryPort
{
  async findByCampaignId(campaignId: string): Promise<CampaignBalance | null> {
    const doc = await CampaignBalanceModel.findOne({ campaignId });
    return doc ? toDomain(doc) : null;
  }

  async applyDonation(
    campaignId: string,
    currency: string,
    delta: CampaignBalanceDelta
  ): Promise<CampaignBalance> {
    // Atomic upsert: fold the donation's split into the running buckets,
    // creating the read model on first activity. Beneficiary-net accrues to
    // pendingBalance until a payout/clearing phase clears it.
    const doc = await CampaignBalanceModel.findOneAndUpdate(
      { campaignId },
      {
        $setOnInsert: { campaignId, currency },
        $set: { updatedAt: new Date() },
        $inc: {
          totalRaised: delta.amount,
          pendingBalance: delta.beneficiaryNet,
          platformFees: delta.platformFee,
          processorFees: delta.processorFee,
          tips: delta.tip,
        },
      },
      { upsert: true, new: true }
    );
    return toDomain(doc!);
  }
}
