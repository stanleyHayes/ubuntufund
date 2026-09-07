import { AffiliatePayoutEntity } from '../../../../domain/entities/AffiliatePayout.js';
import type { AffiliatePayoutRepositoryPort } from '../../../../domain/ports/outbound/AffiliatePayoutRepositoryPort.js';
import {
  AffiliatePayoutModel,
  type AffiliatePayoutDocument,
} from '../../../database/models/AffiliatePayoutModel.js';

function toDomain(doc: AffiliatePayoutDocument): AffiliatePayoutEntity {
  return new AffiliatePayoutEntity({
    id: doc._id!.toString(),
    affiliateId: doc.affiliateId,
    amount: doc.amount,
    currency: doc.currency,
    status: doc.status,
    provider: doc.provider,
    providerRef: doc.providerRef,
    transferCode: doc.transferCode,
    requestedBy: doc.requestedBy,
    approvedBy: doc.approvedBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

export class MongoAffiliatePayoutRepository
  implements AffiliatePayoutRepositoryPort
{
  async create(payout: AffiliatePayoutEntity): Promise<AffiliatePayoutEntity> {
    const p = payout.toPlain();
    const doc = await AffiliatePayoutModel.create({
      affiliateId: p.affiliateId,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      provider: p.provider,
      providerRef: p.providerRef,
      transferCode: p.transferCode,
      requestedBy: p.requestedBy,
      approvedBy: p.approvedBy,
    });
    return toDomain(doc);
  }

  async findById(id: string): Promise<AffiliatePayoutEntity | null> {
    const doc = await AffiliatePayoutModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async findByAffiliateId(
    affiliateId: string
  ): Promise<AffiliatePayoutEntity[]> {
    const docs = await AffiliatePayoutModel.find({ affiliateId }).sort({
      createdAt: -1,
    });
    return docs.map(toDomain);
  }

  async findByProviderRef(
    providerRef: string
  ): Promise<AffiliatePayoutEntity | null> {
    const doc = await AffiliatePayoutModel.findOne({ providerRef });
    return doc ? toDomain(doc) : null;
  }

  async findAll(): Promise<AffiliatePayoutEntity[]> {
    const docs = await AffiliatePayoutModel.find().sort({ createdAt: -1 });
    return docs.map(toDomain);
  }

  async findStuckProcessing(olderThan: Date): Promise<AffiliatePayoutEntity[]> {
    const docs = await AffiliatePayoutModel.find({
      status: 'PROCESSING',
      providerRef: { $exists: true },
      updatedAt: { $lt: olderThan },
    }).sort({ updatedAt: 1 });
    return docs.map(toDomain);
  }

  async transitionToProcessing(
    id: string,
    fields: { approvedBy: string; providerRef: string; transferCode?: string }
  ): Promise<AffiliatePayoutEntity | null> {
    const doc = await AffiliatePayoutModel.findOneAndUpdate(
      { _id: id, status: 'PENDING' },
      {
        $set: {
          status: 'PROCESSING',
          approvedBy: fields.approvedBy,
          providerRef: fields.providerRef,
          ...(fields.transferCode ? { transferCode: fields.transferCode } : {}),
        },
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async attachTransferCode(
    id: string,
    transferCode: string
  ): Promise<AffiliatePayoutEntity | null> {
    const doc = await AffiliatePayoutModel.findByIdAndUpdate(
      id,
      { $set: { transferCode } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async transitionToPaid(id: string): Promise<AffiliatePayoutEntity | null> {
    const doc = await AffiliatePayoutModel.findOneAndUpdate(
      { _id: id, status: 'PROCESSING' },
      { $set: { status: 'PAID' } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async transitionToFailed(id: string): Promise<AffiliatePayoutEntity | null> {
    const doc = await AffiliatePayoutModel.findOneAndUpdate(
      { _id: id, status: 'PROCESSING' },
      { $set: { status: 'FAILED' } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async transitionPaidToReversed(
    id: string
  ): Promise<AffiliatePayoutEntity | null> {
    const doc = await AffiliatePayoutModel.findOneAndUpdate(
      { _id: id, status: 'PAID' },
      { $set: { status: 'REVERSED' } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async transitionProcessingToReversed(
    id: string
  ): Promise<AffiliatePayoutEntity | null> {
    const doc = await AffiliatePayoutModel.findOneAndUpdate(
      { _id: id, status: 'PROCESSING' },
      { $set: { status: 'REVERSED' } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }
}
