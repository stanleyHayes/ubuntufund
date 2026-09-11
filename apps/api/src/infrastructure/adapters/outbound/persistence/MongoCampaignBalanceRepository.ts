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
    payoutFees: doc.payoutFees ?? 0,
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

  async applyRefund(
    campaignId: string,
    _currency: string,
    delta: CampaignBalanceDelta
  ): Promise<CampaignBalance | null> {
    // Guarded on pendingBalance so a refund never claws back already-disbursed
    // funds; reverses the donation's buckets when the money is still pending.
    const doc = await CampaignBalanceModel.findOneAndUpdate(
      { campaignId, pendingBalance: { $gte: delta.beneficiaryNet } },
      {
        $set: { updatedAt: new Date() },
        $inc: {
          totalRaised: -delta.amount,
          pendingBalance: -delta.beneficiaryNet,
          platformFees: -delta.platformFee,
          processorFees: -delta.processorFee,
          tips: -delta.tip,
        },
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async clearPendingToAvailable(
    campaignId: string,
    amount: number
  ): Promise<CampaignBalance | null> {
    // Guarded: only clears while pendingBalance covers the amount, so a race can
    // never drive pendingBalance negative.
    const doc = await CampaignBalanceModel.findOneAndUpdate(
      { campaignId, pendingBalance: { $gte: amount } },
      {
        $set: { updatedAt: new Date() },
        $inc: { pendingBalance: -amount, availableBalance: amount },
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async returnAvailableToPending(
    campaignId: string,
    amount: number
  ): Promise<CampaignBalance | null> {
    // Guarded on availableBalance so a race can never drive it negative.
    const doc = await CampaignBalanceModel.findOneAndUpdate(
      { campaignId, availableBalance: { $gte: amount } },
      {
        $set: { updatedAt: new Date() },
        $inc: { availableBalance: -amount, pendingBalance: amount },
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async reserveForPayout(
    campaignId: string,
    amount: number
  ): Promise<CampaignBalance | null> {
    // Guarded on availableBalance so exactly one payout can reserve a given
    // amount — the money leaves `available` and is now "in transit".
    const doc = await CampaignBalanceModel.findOneAndUpdate(
      { campaignId, availableBalance: { $gte: amount } },
      {
        $set: { updatedAt: new Date() },
        $inc: { availableBalance: -amount },
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  /**
   * Build the atomic filter for a settlement effect: when a `settleRef` is
   * given, match only if it has NOT been applied (idempotency guard); the
   * accompanying `$addToSet` records it so a re-run is a no-op.
   */
  private settleFilter(campaignId: string, settleRef?: string) {
    return settleRef
      ? { campaignId, settledRefs: { $ne: settleRef } }
      : { campaignId };
  }

  private settleAdd(settleRef?: string) {
    return settleRef ? { $addToSet: { settledRefs: settleRef } } : {};
  }

  async markPaidOut(
    campaignId: string,
    netAmount: number,
    fee = 0,
    settleRef?: string
  ): Promise<CampaignBalance | null> {
    // The reserved gross (net + fee) already left `availableBalance`; on payout it
    // splits into the beneficiary's disbursed net and Ujimora's retained fee.
    const doc = await CampaignBalanceModel.findOneAndUpdate(
      this.settleFilter(campaignId, settleRef),
      {
        $set: { updatedAt: new Date() },
        $inc: { paidOutBalance: netAmount, payoutFees: fee },
        ...this.settleAdd(settleRef),
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async returnToAvailable(
    campaignId: string,
    amount: number,
    settleRef?: string
  ): Promise<CampaignBalance | null> {
    const doc = await CampaignBalanceModel.findOneAndUpdate(
      this.settleFilter(campaignId, settleRef),
      {
        $set: { updatedAt: new Date() },
        $inc: { availableBalance: amount },
        ...this.settleAdd(settleRef),
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async reverseFromPaidOut(
    campaignId: string,
    netAmount: number,
    fee = 0,
    settleRef?: string
  ): Promise<CampaignBalance | null> {
    // Undo a paid transfer: the disbursed net + retained fee both return to the
    // campaign's available balance (the gross the beneficiary was charged).
    const doc = await CampaignBalanceModel.findOneAndUpdate(
      this.settleFilter(campaignId, settleRef),
      {
        $set: { updatedAt: new Date() },
        $inc: {
          paidOutBalance: -netAmount,
          payoutFees: -fee,
          availableBalance: netAmount + fee,
        },
        ...this.settleAdd(settleRef),
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }
}
