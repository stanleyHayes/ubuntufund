import type {
  RefundRepositoryPort,
  RefundRecord,
} from '../../../../domain/ports/outbound/RefundRepositoryPort.js';
import {
  RefundModel,
  type RefundDocument,
} from '../../../database/models/RefundModel.js';

function toDomain(doc: RefundDocument): RefundRecord {
  return {
    id: doc._id!.toString(),
    donationId: doc.donationId,
    campaignId: doc.campaignId,
    requesterId: doc.requesterId,
    reason: doc.reason,
    description: doc.description,
    amount: doc.amount,
    fee: doc.fee,
    netAmount: doc.netAmount,
    currency: doc.currency,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoRefundRepository implements RefundRepositoryPort {
  async save(refund: RefundRecord): Promise<RefundRecord> {
    const doc = await RefundModel.create({
      donationId: refund.donationId,
      campaignId: refund.campaignId,
      requesterId: refund.requesterId,
      reason: refund.reason,
      description: refund.description,
      amount: refund.amount,
      fee: refund.fee,
      netAmount: refund.netAmount,
      currency: refund.currency,
      status: refund.status,
    });
    return toDomain(doc);
  }

  async findById(id: string): Promise<RefundRecord | null> {
    const doc = await RefundModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async findByDonationId(donationId: string): Promise<RefundRecord | null> {
    const doc = await RefundModel.findOne({ donationId });
    return doc ? toDomain(doc) : null;
  }

  async findByRequesterId(requesterId: string): Promise<RefundRecord[]> {
    const docs = await RefundModel.find({ requesterId }).sort({
      createdAt: -1,
    });
    return docs.map(toDomain);
  }
}
