import { isTipContentApproved } from '../../../../domain/entities/tipPublicContent.js';
import { TipEntity } from '../../../../domain/entities/Tip.js';
import type { TipRepositoryPort } from '../../../../domain/ports/outbound/TipRepositoryPort.js';
import { TipModel, type TipDocument } from '../../../database/models/TipModel.js';

function toDomain(doc: TipDocument): TipEntity {
  return new TipEntity({
    id: doc._id!.toString(),
    creatorUserId: doc.creatorUserId,
    amount: doc.amount,
    currency: doc.currency,
    supporterUserId: doc.supporterUserId,
    supporterName: doc.supporterName,
    supporterEmail: doc.supporterEmail,
    message: doc.messageHiddenAt ? undefined : doc.message,
    publicContentStatus: isTipContentApproved(doc) ? 'approved' : doc.publicContentStatus === 'rejected' ? 'rejected' : 'pending',
    messageAgreement: doc.messageAgreement,
    isAnonymous: doc.isAnonymous,
    status: doc.status,
    provider: doc.provider,
    providerRef: doc.providerRef,
    requestFingerprint: doc.requestFingerprint,
    checkout: doc.checkout,
    platformFee: doc.platformFee,
    netAmount: doc.netAmount,
    settlementApplied: doc.settlementApplied,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

export class MongoTipRepository implements TipRepositoryPort {
  async create(tip: TipEntity): Promise<TipEntity> {
    const p = tip.toPlain();
    const doc = await TipModel.create({
      creatorUserId: p.creatorUserId,
      amount: p.amount,
      currency: p.currency,
      supporterUserId: p.supporterUserId,
      supporterName: p.supporterName,
      supporterEmail: p.supporterEmail,
      message: p.message,
      messageAgreement: p.messageAgreement,
      isAnonymous: p.isAnonymous,
      status: p.status,
      provider: p.provider,
      providerRef: p.providerRef,
      requestFingerprint: p.requestFingerprint,
      platformFee: p.platformFee,
      netAmount: p.netAmount,
    });
    return toDomain(doc);
  }

  async saveCheckout(providerRef: string, checkout: { checkoutUrl: string; accessCode: string }): Promise<boolean> {
    const result = await TipModel.updateOne({ providerRef, status: 'PENDING', checkoutRevokedAt: { $exists: false } }, { $set: { checkout } });
    return result.matchedCount === 1;
  }

  /** Bounded catch-up for credentials retained by older terminal records. */
  async clearTerminalCheckoutCredentials(): Promise<number> {
    const filter = { status: { $in: ['SUCCEEDED', 'FAILED'] }, checkout: { $exists: true } };
    const batch = await TipModel.find(filter).select('_id').limit(500).lean();
    if (!batch.length) return 0;
    const result = await TipModel.updateMany(
      { ...filter, _id: { $in: batch.map(tip => tip._id) } },
      { $unset: { checkout: 1 } },
    );
    return result.modifiedCount;
  }

  async findByProviderRef(providerRef: string): Promise<TipEntity | null> {
    const doc = await TipModel.findOne({ providerRef });
    return doc ? toDomain(doc) : null;
  }

  async findByCreator(
    creatorUserId: string,
    limit = 20
  ): Promise<TipEntity[]> {
    const docs = await TipModel.find({ creatorUserId, status: 'SUCCEEDED' })
      .sort({ createdAt: -1 })
      .limit(limit);
    return docs.map(toDomain);
  }

  async creatorStats(
    creatorUserId: string
  ): Promise<{ count: number; totalNet: number }> {
    const [row] = await TipModel.aggregate<{ count: number; totalNet: number }>([
      { $match: { creatorUserId, status: 'SUCCEEDED' } },
      { $group: { _id: null, count: { $sum: 1 }, totalNet: { $sum: '$netAmount' } } },
    ]);
    return { count: row?.count ?? 0, totalNet: row?.totalNet ?? 0 };
  }

  async transitionToSucceeded(
    providerRef: string,
    opts: { allowFromFailed?: boolean } = {}
  ): Promise<TipEntity | null> {
    // FAILED is admitted only for a provider-verified late success; the caller
    // (HandleTipWebhookUseCase) owns that verification.
    const from = opts.allowFromFailed ? ['PENDING', 'FAILED'] : ['PENDING'];
    const doc = await TipModel.findOneAndUpdate(
      { providerRef, status: { $in: from } },
      { $set: { status: 'SUCCEEDED' }, $unset: { checkout: 1 } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async transitionToFailed(providerRef: string): Promise<TipEntity | null> {
    const doc = await TipModel.findOneAndUpdate(
      { providerRef, status: 'PENDING' },
      { $set: { status: 'FAILED' }, $unset: { checkout: 1 } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async markSettlementApplied(id: string): Promise<void> {
    // CAS on SUCCEEDED so a non-terminal tip is never flagged settled.
    await TipModel.updateOne(
      { _id: id, status: 'SUCCEEDED' },
      { $set: { settlementApplied: true }, $unset: { checkout: 1 } }
    );
  }

  async findSucceededUnsettled(olderThan: Date, limit = 100): Promise<TipEntity[]> {
    const docs = await TipModel.find({
      status: 'SUCCEEDED',
      settlementApplied: false,
      updatedAt: { $lt: olderThan },
    })
      .sort({ updatedAt: 1 })
      .limit(limit);
    return docs.map(toDomain);
  }

  async findStalePending(olderThan: Date, limit: number): Promise<TipEntity[]> {
    // Never-reconciled rows (field absent) sort first, then the least recently
    // visited — the same fairness rule as the crypto and fiat donation sweeps.
    const docs = await TipModel.find({ status: 'PENDING', updatedAt: { $lt: olderThan } })
      .sort({ reconciledAt: 1, updatedAt: 1, _id: 1 })
      .limit(limit);
    return docs.map(toDomain);
  }

  async recordReconciliationAttempt(id: string, attemptedAt: Date): Promise<void> {
    await TipModel.updateOne(
      { _id: id, status: 'PENDING' },
      { $max: { reconciledAt: attemptedAt } },
      { timestamps: false }
    );
  }
}
