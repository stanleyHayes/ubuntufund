import type { AffiliateBalance } from '@ubuntu-fund/types';
import type { AffiliateBalanceRepositoryPort } from '../../../../domain/ports/outbound/AffiliateBalanceRepositoryPort.js';
import {
  AffiliateBalanceModel,
  type AffiliateBalanceDocument,
} from '../../../database/models/AffiliateBalanceModel.js';

function toDomain(doc: AffiliateBalanceDocument): AffiliateBalance {
  return {
    id: doc._id!.toString(),
    affiliateId: doc.affiliateId,
    currency: doc.currency,
    totalEarned: doc.totalEarned,
    pendingBalance: doc.pendingBalance,
    availableBalance: doc.availableBalance,
    paidOutBalance: doc.paidOutBalance,
    updatedAt: doc.updatedAt,
  };
}

export class MongoAffiliateBalanceRepository
  implements AffiliateBalanceRepositoryPort
{
  async findByAffiliateId(
    affiliateId: string
  ): Promise<AffiliateBalance | null> {
    const doc = await AffiliateBalanceModel.findOne({ affiliateId });
    return doc ? toDomain(doc) : null;
  }

  async ensure(affiliateId: string, currency: string): Promise<AffiliateBalance> {
    // Atomic upsert: create a zeroed read model on first activity, returning it
    // either way. Callers use the returned id for the guarded bucket moves below.
    const doc = await AffiliateBalanceModel.findOneAndUpdate(
      { affiliateId },
      {
        $setOnInsert: { affiliateId, currency },
        $set: { updatedAt: new Date() },
      },
      { upsert: true, new: true }
    );
    return toDomain(doc!);
  }

  async accrueCommission(id: string, amount: number): Promise<AffiliateBalance> {
    // A newly-held commission: earned, and counted as pending until it matures.
    // Pure additive $inc, so no guard is needed.
    const doc = await AffiliateBalanceModel.findByIdAndUpdate(
      id,
      {
        $set: { updatedAt: new Date() },
        $inc: { totalEarned: amount, pendingBalance: amount },
      },
      { new: true }
    );
    return toDomain(doc!);
  }

  async clearPendingToAvailable(
    id: string,
    amount: number
  ): Promise<AffiliateBalance | null> {
    // Guarded: only clears while pendingBalance covers the amount, so a race can
    // never drive pendingBalance negative.
    const doc = await AffiliateBalanceModel.findOneAndUpdate(
      { _id: id, pendingBalance: { $gte: amount } },
      {
        $set: { updatedAt: new Date() },
        $inc: { pendingBalance: -amount, availableBalance: amount },
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async reserveForPayout(
    id: string,
    amount: number
  ): Promise<AffiliateBalance | null> {
    // Guarded on availableBalance so exactly one payout can reserve a given
    // amount — the money leaves `available` and is now "in transit".
    const doc = await AffiliateBalanceModel.findOneAndUpdate(
      { _id: id, availableBalance: { $gte: amount } },
      {
        $set: { updatedAt: new Date() },
        $inc: { availableBalance: -amount },
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async returnToAvailable(
    id: string,
    amount: number
  ): Promise<AffiliateBalance | null> {
    // Failed transfer: the reserved in-transit funds return to available. No
    // paid-out amount was ever recorded, so this is a pure additive $inc.
    const doc = await AffiliateBalanceModel.findByIdAndUpdate(
      id,
      {
        $set: { updatedAt: new Date() },
        $inc: { availableBalance: amount },
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async markPaidOut(
    id: string,
    amount: number
  ): Promise<AffiliateBalance | null> {
    // Confirmed transfer: the reserved in-transit funds have left the platform.
    const doc = await AffiliateBalanceModel.findByIdAndUpdate(
      id,
      {
        $set: { updatedAt: new Date() },
        $inc: { paidOutBalance: amount },
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async reverseFromPaidOut(
    id: string,
    amount: number
  ): Promise<AffiliateBalance | null> {
    // A PAID transfer was reversed: the funds came back, so move them out of
    // paid-out and back into available (mirrors the campaign payout ledger).
    const doc = await AffiliateBalanceModel.findByIdAndUpdate(
      id,
      {
        $set: { updatedAt: new Date() },
        $inc: { paidOutBalance: -amount, availableBalance: amount },
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async reverseHeld(
    id: string,
    amount: number
  ): Promise<AffiliateBalance | null> {
    // Referred subscription refunded before the commission matured: unwind the
    // held accrual. Guarded so pending / earned can't be driven negative.
    const doc = await AffiliateBalanceModel.findOneAndUpdate(
      {
        _id: id,
        pendingBalance: { $gte: amount },
        totalEarned: { $gte: amount },
      },
      {
        $set: { updatedAt: new Date() },
        $inc: { pendingBalance: -amount, totalEarned: -amount },
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async reverseAvailable(
    id: string,
    amount: number
  ): Promise<AffiliateBalance | null> {
    // Matured, not-yet-paid commission reversed after a refund: unwind from
    // available. Guarded so available / earned can't be driven negative.
    const doc = await AffiliateBalanceModel.findOneAndUpdate(
      {
        _id: id,
        availableBalance: { $gte: amount },
        totalEarned: { $gte: amount },
      },
      {
        $set: { updatedAt: new Date() },
        $inc: { availableBalance: -amount, totalEarned: -amount },
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }
}
