import type { CampaignBeneficiaryBalance } from '@ubuntu-fund/types';
import type { CampaignBeneficiaryBalanceRepositoryPort } from '../../../../domain/ports/outbound/CampaignBeneficiaryBalanceRepositoryPort.js';
import {
  CampaignBeneficiaryBalanceModel,
  type CampaignBeneficiaryBalanceDocument,
} from '../../../database/models/CampaignBeneficiaryBalanceModel.js';

function toDomain(
  doc: CampaignBeneficiaryBalanceDocument
): CampaignBeneficiaryBalance {
  return {
    campaignId: doc.campaignId,
    beneficiaryId: doc.beneficiaryId,
    currency: doc.currency,
    pendingBalance: doc.pendingBalance,
    availableBalance: doc.availableBalance,
    paidOutBalance: doc.paidOutBalance,
    updatedAt: doc.updatedAt,
  };
}

export class MongoCampaignBeneficiaryBalanceRepository
  implements CampaignBeneficiaryBalanceRepositoryPort
{
  async accruePending(
    campaignId: string,
    beneficiaryId: string,
    currency: string,
    amount: number
  ): Promise<CampaignBeneficiaryBalance> {
    const doc = await CampaignBeneficiaryBalanceModel.findOneAndUpdate(
      { campaignId, beneficiaryId, currency },
      {
        $setOnInsert: { campaignId, beneficiaryId, currency },
        $set: { updatedAt: new Date() },
        $inc: { pendingBalance: amount },
      },
      { upsert: true, new: true }
    );
    return toDomain(doc!);
  }

  /** Guarded conditional decrement of a bucket; false when it would go negative. */
  private async guardedMove(
    campaignId: string,
    beneficiaryId: string,
    currency: string,
    guardField: 'pendingBalance' | 'availableBalance' | 'paidOutBalance',
    amount: number,
    inc: Record<string, number>
  ): Promise<boolean> {
    const doc = await CampaignBeneficiaryBalanceModel.findOneAndUpdate(
      { campaignId, beneficiaryId, currency, [guardField]: { $gte: amount } },
      { $set: { updatedAt: new Date() }, $inc: inc },
      { new: true }
    );
    return doc !== null;
  }

  reversePending(
    campaignId: string,
    beneficiaryId: string,
    currency: string,
    amount: number
  ): Promise<boolean> {
    return this.guardedMove(campaignId, beneficiaryId, currency, 'pendingBalance', amount, {
      pendingBalance: -amount,
    });
  }

  clearPendingToAvailable(
    campaignId: string,
    beneficiaryId: string,
    currency: string,
    amount: number
  ): Promise<boolean> {
    return this.guardedMove(campaignId, beneficiaryId, currency, 'pendingBalance', amount, {
      pendingBalance: -amount,
      availableBalance: amount,
    });
  }

  reserveForPayout(
    campaignId: string,
    beneficiaryId: string,
    currency: string,
    amount: number
  ): Promise<boolean> {
    return this.guardedMove(campaignId, beneficiaryId, currency, 'availableBalance', amount, {
      availableBalance: -amount,
    });
  }

  /** Idempotency guard for a settlement effect keyed by settleRef (G5). */
  private settleFilter(
    campaignId: string,
    beneficiaryId: string,
    currency: string,
    settleRef?: string
  ) {
    const base = { campaignId, beneficiaryId, currency };
    return settleRef ? { ...base, settledRefs: { $ne: settleRef } } : base;
  }

  private settleAdd(settleRef?: string) {
    return settleRef ? { $addToSet: { settledRefs: settleRef } } : {};
  }

  async returnToAvailable(
    campaignId: string,
    beneficiaryId: string,
    currency: string,
    amount: number,
    settleRef?: string
  ): Promise<void> {
    await CampaignBeneficiaryBalanceModel.updateOne(
      this.settleFilter(campaignId, beneficiaryId, currency, settleRef),
      { $set: { updatedAt: new Date() }, $inc: { availableBalance: amount }, ...this.settleAdd(settleRef) }
    );
  }

  async markPaidOut(
    campaignId: string,
    beneficiaryId: string,
    currency: string,
    amount: number,
    settleRef?: string
  ): Promise<void> {
    await CampaignBeneficiaryBalanceModel.updateOne(
      this.settleFilter(campaignId, beneficiaryId, currency, settleRef),
      { $set: { updatedAt: new Date() }, $inc: { paidOutBalance: amount }, ...this.settleAdd(settleRef) }
    );
  }

  async reverseFromPaidOut(
    campaignId: string,
    beneficiaryId: string,
    currency: string,
    amount: number,
    settleRef?: string
  ): Promise<void> {
    await CampaignBeneficiaryBalanceModel.updateOne(
      this.settleFilter(campaignId, beneficiaryId, currency, settleRef),
      {
        $set: { updatedAt: new Date() },
        $inc: { paidOutBalance: -amount, availableBalance: amount },
        ...this.settleAdd(settleRef),
      }
    );
  }

  async findOne(
    campaignId: string,
    beneficiaryId: string,
    currency: string
  ): Promise<CampaignBeneficiaryBalance | null> {
    const doc = await CampaignBeneficiaryBalanceModel.findOne({
      campaignId,
      beneficiaryId,
      currency,
    });
    return doc ? toDomain(doc) : null;
  }

  async listByCampaign(
    campaignId: string
  ): Promise<CampaignBeneficiaryBalance[]> {
    const docs = await CampaignBeneficiaryBalanceModel.find({ campaignId });
    return docs.map(toDomain);
  }
}
