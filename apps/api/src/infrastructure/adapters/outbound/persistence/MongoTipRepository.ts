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
    message: doc.message,
    isAnonymous: doc.isAnonymous,
    status: doc.status,
    provider: doc.provider,
    providerRef: doc.providerRef,
    platformFee: doc.platformFee,
    netAmount: doc.netAmount,
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
      isAnonymous: p.isAnonymous,
      status: p.status,
      provider: p.provider,
      providerRef: p.providerRef,
      platformFee: p.platformFee,
      netAmount: p.netAmount,
    });
    return toDomain(doc);
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

  async transitionToSucceeded(providerRef: string): Promise<TipEntity | null> {
    const doc = await TipModel.findOneAndUpdate(
      { providerRef, status: 'PENDING' },
      { $set: { status: 'SUCCEEDED' } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async transitionToFailed(providerRef: string): Promise<TipEntity | null> {
    const doc = await TipModel.findOneAndUpdate(
      { providerRef, status: 'PENDING' },
      { $set: { status: 'FAILED' } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }
}
