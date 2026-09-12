import type { DonationIntentStatus } from '@ubuntu-fund/types';
import { DonationIntentEntity } from '../../../../domain/entities/DonationIntent.js';
import type { DonationIntentRepositoryPort } from '../../../../domain/ports/outbound/DonationIntentRepositoryPort.js';
import {
  DonationIntentModel,
  type DonationIntentDocument,
} from '../../../database/models/DonationIntentModel.js';

function toDomain(doc: DonationIntentDocument): DonationIntentEntity {
  return new DonationIntentEntity({
    id: doc._id!.toString(),
    campaignId: doc.campaignId,
    liveSessionId: doc.liveSessionId,
    amount: doc.amount,
    currency: doc.currency,
    donorUserId: doc.donorUserId ?? null,
    donorEmail: doc.donorEmail,
    donorName: doc.donorName,
    message: doc.message,
    isAnonymous: doc.isAnonymous,
    tip: doc.tip,
    status: doc.status,
    provider: doc.provider,
    providerRef: doc.providerRef,
    idempotencyKey: doc.idempotencyKey,
    attribution: doc.attribution,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    originalAmountMinor: doc.originalAmountMinor,
    originalCurrency: doc.originalCurrency,
    settlementAmountMinor: doc.settlementAmountMinor,
    settlementCurrency: doc.settlementCurrency,
    fxRate: doc.fxRate,
    fxSource: doc.fxSource,
    country: doc.country,
    paymentMethod: doc.paymentMethod,
    providerFeeMinor: doc.providerFeeMinor,
    platformFeeMinor: doc.platformFeeMinor,
    platformFeePercentOverride: doc.platformFeePercentOverride,
    couponId: doc.couponId,
    couponCode: doc.couponCode,
    netCampaignAmountMinor: doc.netCampaignAmountMinor,
    refundedAmountMinor: doc.refundedAmountMinor,
    refundKeys: doc.refundKeys,
    paymentRail: doc.paymentRail,
    cryptoAsset: doc.cryptoAsset,
    cryptoNetwork: doc.cryptoNetwork,
    walletAddress: doc.walletAddress,
    transactionHash: doc.transactionHash,
    confirmationCount: doc.confirmationCount,
    requiredConfirmations: doc.requiredConfirmations,
    quoteId: doc.quoteId,
    quoteExpiresAt: doc.quoteExpiresAt,
  });
}

export class MongoDonationIntentRepository
  implements DonationIntentRepositoryPort
{
  async create(intent: DonationIntentEntity): Promise<DonationIntentEntity> {
    const p = intent.toPlain();
    const doc = await DonationIntentModel.create({
      campaignId: p.campaignId,
      liveSessionId: p.liveSessionId,
      amount: p.amount,
      currency: p.currency,
      donorUserId: p.donorUserId,
      donorEmail: p.donorEmail,
      donorName: p.donorName,
      message: p.message,
      isAnonymous: p.isAnonymous,
      tip: p.tip,
      status: p.status,
      provider: p.provider,
      providerRef: p.providerRef,
      idempotencyKey: p.idempotencyKey,
      attribution: p.attribution,
      originalAmountMinor: p.originalAmountMinor,
      originalCurrency: p.originalCurrency,
      settlementAmountMinor: p.settlementAmountMinor,
      settlementCurrency: p.settlementCurrency,
      fxRate: p.fxRate,
      fxSource: p.fxSource,
      country: p.country,
      paymentMethod: p.paymentMethod,
      providerFeeMinor: p.providerFeeMinor,
      platformFeeMinor: p.platformFeeMinor,
      platformFeePercentOverride: p.platformFeePercentOverride,
      couponId: p.couponId,
      couponCode: p.couponCode,
      netCampaignAmountMinor: p.netCampaignAmountMinor,
      paymentRail: p.paymentRail,
      cryptoAsset: p.cryptoAsset,
      cryptoNetwork: p.cryptoNetwork,
      walletAddress: p.walletAddress,
      transactionHash: p.transactionHash,
      confirmationCount: p.confirmationCount,
      requiredConfirmations: p.requiredConfirmations,
      quoteId: p.quoteId,
      quoteExpiresAt: p.quoteExpiresAt,
    });
    return toDomain(doc);
  }

  async findById(id: string): Promise<DonationIntentEntity | null> {
    const doc = await DonationIntentModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async findByIdempotencyKey(
    key: string
  ): Promise<DonationIntentEntity | null> {
    const doc = await DonationIntentModel.findOne({ idempotencyKey: key });
    return doc ? toDomain(doc) : null;
  }

  async findByProviderRef(
    providerRef: string
  ): Promise<DonationIntentEntity | null> {
    const doc = await DonationIntentModel.findOne({ providerRef });
    return doc ? toDomain(doc) : null;
  }

  async transitionToSucceeded(
    id: string,
    providerRef?: string
  ): Promise<DonationIntentEntity | null> {
    // Conditional atomic transition: only fires while the intent is still
    // CREATED, PENDING or PROCESSING (the crypto rail confirms from PROCESSING),
    // so exactly one settlement ever wins.
    const doc = await DonationIntentModel.findOneAndUpdate(
      { _id: id, status: { $in: ['CREATED', 'PENDING', 'PROCESSING'] } },
      {
        $set: {
          status: 'SUCCEEDED',
          ...(providerRef ? { providerRef } : {}),
        },
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async updateStatus(
    id: string,
    status: DonationIntentStatus,
    providerRef?: string
  ): Promise<DonationIntentEntity | null> {
    const doc = await DonationIntentModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status,
          ...(providerRef ? { providerRef } : {}),
        },
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async markFailedIfPending(
    id: string,
    providerRef?: string
  ): Promise<DonationIntentEntity | null> {
    // Conditional atomic transition: only fires while still PENDING, so a stale
    // reconciliation sweep can never clobber a concurrently-SUCCEEDED intent.
    const doc = await DonationIntentModel.findOneAndUpdate(
      { _id: id, status: 'PENDING' },
      { $set: { status: 'FAILED', ...(providerRef ? { providerRef } : {}) } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async findStalePending(
    olderThan: Date,
    limit: number
  ): Promise<DonationIntentEntity[]> {
    const docs = await DonationIntentModel.find({
      status: 'PENDING',
      providerRef: { $exists: true, $ne: null },
      provider: { $ne: 'wallet' },
      // The crypto rail has its own reconciler ({@link findStaleCrypto}); never
      // hand a crypto intent to the fiat gateway verifier.
      paymentRail: { $ne: 'CRYPTO' },
      updatedAt: { $lt: olderThan },
    })
      .sort({ updatedAt: 1 })
      .limit(limit);
    return docs.map(toDomain);
  }

  /**
   * Crypto intents still in flight (PENDING = awaiting payment, or PROCESSING =
   * awaiting confirmations) past `olderThan`. The crypto reconciler re-checks
   * these against the provider to repair a missed webhook (§7/§8).
   */
  async findStaleCrypto(
    olderThan: Date,
    limit: number
  ): Promise<DonationIntentEntity[]> {
    const docs = await DonationIntentModel.find({
      paymentRail: 'CRYPTO',
      status: { $in: ['PENDING', 'PROCESSING'] },
      providerRef: { $exists: true, $ne: null },
      updatedAt: { $lt: olderThan },
    })
      .sort({ updatedAt: 1 })
      .limit(limit);
    return docs.map(toDomain);
  }

  /**
   * Move a crypto intent PENDING → PROCESSING when the provider first detects
   * the deposit, recording the tx hash + confirmations. Atomic on the PENDING
   * guard so a duplicate detection is a no-op.
   */
  async markCryptoProcessing(
    id: string,
    fields: { transactionHash?: string; confirmationCount?: number }
  ): Promise<DonationIntentEntity | null> {
    const set: Record<string, unknown> = { status: 'PROCESSING' };
    if (fields.transactionHash !== undefined) set.transactionHash = fields.transactionHash;
    if (fields.confirmationCount !== undefined) set.confirmationCount = fields.confirmationCount;
    const doc = await DonationIntentModel.findOneAndUpdate(
      { _id: id, status: 'PENDING' },
      { $set: set },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  /** Best-effort update of on-chain progress (tx hash / confirmations). */
  async recordCryptoProgress(
    id: string,
    fields: { transactionHash?: string; confirmationCount?: number }
  ): Promise<void> {
    const set = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined)
    );
    if (Object.keys(set).length === 0) return;
    await DonationIntentModel.updateOne({ _id: id }, { $set: set });
  }

  async searchForAdmin(filters: {
    providerRef?: string;
    campaignId?: string;
    donorEmail?: string;
    status?: DonationIntentStatus;
    provider?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }): Promise<DonationIntentEntity[]> {
    const query: Record<string, unknown> = {};
    if (filters.providerRef) query.providerRef = filters.providerRef;
    if (filters.campaignId) query.campaignId = filters.campaignId;
    if (filters.donorEmail) query.donorEmail = filters.donorEmail;
    if (filters.status) query.status = filters.status;
    if (filters.provider) query.provider = filters.provider;
    if (filters.from || filters.to) {
      query.createdAt = {
        ...(filters.from ? { $gte: filters.from } : {}),
        ...(filters.to ? { $lte: filters.to } : {}),
      };
    }
    const docs = await DonationIntentModel.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(filters.limit ?? 50, 200));
    return docs.map(toDomain);
  }

  async claimRefund(
    id: string,
    amountMinor: number,
    maxMinor: number,
    idempotencyKey?: string
  ): Promise<DonationIntentEntity | null> {
    // Atomic reservation: fires only while refundable, within the cap, and (when
    // a key is given) not already applied. The $expr caps the cumulative total;
    // the refundKeys guard makes a keyed retry an exact no-op (partials included).
    const filter: Record<string, unknown> = {
      _id: id,
      status: { $in: ['SUCCEEDED', 'PARTIALLY_REFUNDED'] },
      $expr: {
        $lte: [
          { $add: [{ $ifNull: ['$refundedAmountMinor', 0] }, amountMinor] },
          maxMinor,
        ],
      },
    };
    if (idempotencyKey) filter.refundKeys = { $ne: idempotencyKey };

    const update: Record<string, unknown> = {
      $inc: { refundedAmountMinor: amountMinor },
    };
    if (idempotencyKey) update.$push = { refundKeys: idempotencyKey };

    const doc = await DonationIntentModel.findOneAndUpdate(filter, update, {
      new: true,
    });
    return doc ? toDomain(doc) : null;
  }

  async releaseRefundClaim(
    id: string,
    amountMinor: number,
    idempotencyKey?: string
  ): Promise<void> {
    const update: Record<string, unknown> = {
      $inc: { refundedAmountMinor: -amountMinor },
    };
    if (idempotencyKey) update.$pull = { refundKeys: idempotencyKey };
    await DonationIntentModel.updateOne({ _id: id }, update);
  }

  async recordSettlementFinancials(
    id: string,
    fields: {
      settlementAmountMinor?: number;
      settlementCurrency?: string;
      fxRate?: number;
      fxSource?: string;
      providerFeeMinor?: number;
      platformFeeMinor?: number;
      netCampaignAmountMinor?: number;
    }
  ): Promise<void> {
    // Only set the keys actually provided, so a partial update never nulls a
    // previously-recorded field.
    const set = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined)
    );
    if (Object.keys(set).length === 0) return;
    await DonationIntentModel.updateOne({ _id: id }, { $set: set });
  }
}
