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
    netCampaignAmountMinor: doc.netCampaignAmountMinor,
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
      netCampaignAmountMinor: p.netCampaignAmountMinor,
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
    // CREATED or PENDING, so exactly one settlement ever wins.
    const doc = await DonationIntentModel.findOneAndUpdate(
      { _id: id, status: { $in: ['CREATED', 'PENDING'] } },
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

  async findStalePending(
    olderThan: Date,
    limit: number
  ): Promise<DonationIntentEntity[]> {
    const docs = await DonationIntentModel.find({
      status: 'PENDING',
      providerRef: { $exists: true, $ne: null },
      provider: { $ne: 'wallet' },
      updatedAt: { $lt: olderThan },
    })
      .sort({ updatedAt: 1 })
      .limit(limit);
    return docs.map(toDomain);
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
