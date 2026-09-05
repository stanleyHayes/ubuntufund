import { PayoutEntity } from '../../../../domain/entities/Payout.js';
import type { PayoutRepositoryPort } from '../../../../domain/ports/outbound/PayoutRepositoryPort.js';
import {
  PayoutModel,
  type PayoutDocument,
} from '../../../database/models/PayoutModel.js';

function toDomain(doc: PayoutDocument): PayoutEntity {
  return new PayoutEntity({
    id: doc._id!.toString(),
    campaignId: doc.campaignId,
    recipientId: doc.recipientId,
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

export class MongoPayoutRepository implements PayoutRepositoryPort {
  async create(payout: PayoutEntity): Promise<PayoutEntity> {
    const p = payout.toPlain();
    const doc = await PayoutModel.create({
      campaignId: p.campaignId,
      recipientId: p.recipientId,
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

  async findById(id: string): Promise<PayoutEntity | null> {
    const doc = await PayoutModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async findByCampaignId(campaignId: string): Promise<PayoutEntity[]> {
    const docs = await PayoutModel.find({ campaignId }).sort({ createdAt: -1 });
    return docs.map(toDomain);
  }

  async findByProviderRef(providerRef: string): Promise<PayoutEntity | null> {
    const doc = await PayoutModel.findOne({ providerRef });
    return doc ? toDomain(doc) : null;
  }

  async findAll(): Promise<PayoutEntity[]> {
    const docs = await PayoutModel.find().sort({ createdAt: -1 });
    return docs.map(toDomain);
  }

  async transitionToProcessing(
    id: string,
    fields: { approvedBy: string; providerRef: string; transferCode?: string }
  ): Promise<PayoutEntity | null> {
    const doc = await PayoutModel.findOneAndUpdate(
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
  ): Promise<PayoutEntity | null> {
    const doc = await PayoutModel.findByIdAndUpdate(
      id,
      { $set: { transferCode } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async transitionToPaid(id: string): Promise<PayoutEntity | null> {
    const doc = await PayoutModel.findOneAndUpdate(
      { _id: id, status: 'PROCESSING' },
      { $set: { status: 'PAID' } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async transitionToFailed(id: string): Promise<PayoutEntity | null> {
    const doc = await PayoutModel.findOneAndUpdate(
      { _id: id, status: 'PROCESSING' },
      { $set: { status: 'FAILED' } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async transitionPaidToReversed(id: string): Promise<PayoutEntity | null> {
    const doc = await PayoutModel.findOneAndUpdate(
      { _id: id, status: 'PAID' },
      { $set: { status: 'REVERSED' } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async transitionProcessingToReversed(
    id: string
  ): Promise<PayoutEntity | null> {
    const doc = await PayoutModel.findOneAndUpdate(
      { _id: id, status: 'PROCESSING' },
      { $set: { status: 'REVERSED' } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }
}
