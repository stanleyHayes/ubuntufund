import { AffiliateCommissionEntity } from '../../../../domain/entities/AffiliateCommission.js';
import type { AffiliateCommissionRepositoryPort } from '../../../../domain/ports/outbound/AffiliateCommissionRepositoryPort.js';
import {
  AffiliateCommissionModel,
  type AffiliateCommissionDocument,
} from '../../../database/models/AffiliateCommissionModel.js';

function toDomain(doc: AffiliateCommissionDocument): AffiliateCommissionEntity {
  return new AffiliateCommissionEntity({
    id: doc._id!.toString(),
    affiliateId: doc.affiliateId,
    refereeId: doc.refereeId,
    source: doc.source,
    sourceRef: doc.sourceRef,
    amount: doc.amount,
    currency: doc.currency,
    baseAmount: doc.baseAmount,
    commissionRate: doc.commissionRate,
    status: doc.status,
    maturesAt: doc.maturesAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

export class MongoAffiliateCommissionRepository
  implements AffiliateCommissionRepositoryPort
{
  async createIfAbsent(
    commission: AffiliateCommissionEntity
  ): Promise<AffiliateCommissionEntity | null> {
    const c = commission.toPlain();
    try {
      const doc = await AffiliateCommissionModel.create({
        affiliateId: c.affiliateId,
        refereeId: c.refereeId,
        source: c.source,
        sourceRef: c.sourceRef,
        amount: c.amount,
        currency: c.currency,
        baseAmount: c.baseAmount,
        commissionRate: c.commissionRate,
        status: c.status,
        maturesAt: c.maturesAt,
      });
      return toDomain(doc);
    } catch (err) {
      // Duplicate sourceRef (unique index) => a commission was already recorded
      // for this subscription charge; a replayed/duplicate settlement is a no-op.
      if (isDuplicateKeyError(err)) return null;
      throw err;
    }
  }

  async findByAffiliateId(
    affiliateId: string
  ): Promise<AffiliateCommissionEntity[]> {
    const docs = await AffiliateCommissionModel.find({ affiliateId }).sort({
      createdAt: -1,
    });
    return docs.map(toDomain);
  }

  async findBySourceRef(
    sourceRef: string
  ): Promise<AffiliateCommissionEntity | null> {
    const doc = await AffiliateCommissionModel.findOne({ sourceRef });
    return doc ? toDomain(doc) : null;
  }

  async findMaturedHeld(now: Date): Promise<AffiliateCommissionEntity[]> {
    // The maturity sweep's work list: held commissions whose hold window elapsed.
    const docs = await AffiliateCommissionModel.find({
      status: 'held',
      maturesAt: { $lte: now },
    }).sort({ maturesAt: 1 });
    return docs.map(toDomain);
  }

  async update(
    commission: AffiliateCommissionEntity
  ): Promise<AffiliateCommissionEntity | null> {
    // Persists the entity's mutated status; updatedAt is refreshed by timestamps.
    // Balance movements are guarded atomically on the balance repository.
    const c = commission.toPlain();
    const doc = await AffiliateCommissionModel.findByIdAndUpdate(
      c.id,
      { $set: { status: c.status } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }
}
